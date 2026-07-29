from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import deque
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import AsyncIterator

from linkpad_agent import __version__
from linkpad_agent.config import AgentConfig
from linkpad_agent.drivers.base import DriverError
from linkpad_agent.drivers.opcua import OpcUaDriver
from linkpad_agent.drivers.registry import DriverRegistry
from linkpad_agent.drivers.siemens_s7 import SiemensS7Driver
from linkpad_agent.drivers.sim import SimDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import (
    ReadRequest,
    SessionCreateRequest,
    WriteRequest,
)
from linkpad_agent.security.target_policy import TargetPolicy
from linkpad_agent.sessions.connection_pool import ConnectionPool
from linkpad_agent.sessions.manager import SessionManager


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class SlidingWindowLimiter:
    def __init__(self, requests_per_second: int):
        self._limit = requests_per_second
        self._events: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def check(self) -> None:
        now = time.monotonic()
        async with self._lock:
            while self._events and now - self._events[0] >= 1:
                self._events.popleft()
            if len(self._events) >= self._limit:
                raise ProtocolError(
                    429, "rate_limit", "Limite de requisições por segundo atingido."
                )
            self._events.append(now)


class AgentRuntime:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.registry = DriverRegistry()
        self.registry.register(SimDriver())
        self.registry.register(SiemensS7Driver())
        self.registry.register(OpcUaDriver())
        self.pool = ConnectionPool(config.limits.idle_connection_ttl_seconds)
        self.sessions = SessionManager(
            registry=self.registry,
            pool=self.pool,
            policy=TargetPolicy(config.security),
            ttl_seconds=config.limits.session_ttl_seconds,
            max_sessions=config.limits.max_sessions,
        )
        self._read_limiter = SlidingWindowLimiter(config.limits.read_rps)
        self._write_limiter = SlidingWindowLimiter(config.limits.write_rps)
        self._pending = asyncio.Semaphore(config.limits.max_pending_requests)
        self._dedup: dict[tuple[str, str], tuple[float, str, dict]] = {}
        self._inflight_writes: dict[
            tuple[str, str], tuple[str, asyncio.Future[dict]]
        ] = {}
        self._dedup_lock = asyncio.Lock()
        self._cleanup_task: asyncio.Task | None = None
        self._started_at = utc_now_iso()
        self._started_monotonic = time.monotonic()
        self._metrics = {
            "readRequests": 0,
            "writeRequests": 0,
            "deduplicatedWrites": 0,
            "rateLimitBlocks": 0,
            "errors": 0,
        }

    async def start(self) -> None:
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(
                self._cleanup_loop(), name="linkpad-agent-cleanup"
            )

    async def stop(self) -> None:
        if self._cleanup_task is not None:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
        await self.sessions.shutdown()
        await self.pool.shutdown()

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(1)
            await self.sessions.cleanup_expired()
            await self.pool.close_idle()
            await self._purge_dedup()

    async def _purge_dedup(self) -> None:
        now = time.monotonic()
        async with self._dedup_lock:
            stale = [
                key for key, (expires, _, _) in self._dedup.items() if expires <= now
            ]
            for key in stale:
                self._dedup.pop(key, None)

    @asynccontextmanager
    async def _request_slot(self) -> AsyncIterator[None]:
        try:
            await asyncio.wait_for(self._pending.acquire(), timeout=0.1)
        except TimeoutError as exc:
            raise ProtocolError(
                503, "agent_busy", "O Agent está com muitas requisições pendentes."
            ) from exc
        try:
            yield
        finally:
            self._pending.release()

    async def create_session(self, request: SessionCreateRequest) -> dict:
        session = await self.sessions.create(request)
        return {
            "ok": True,
            "status": "ok",
            "contractVersion": "0.1.0",
            "sessionId": session.id,
            "state": "ready",
            "expiresIn": self.config.limits.session_ttl_seconds,
            "expiresInSeconds": self.config.limits.session_ttl_seconds,
            "driver": session.driver.id,
        }

    async def read(self, request: ReadRequest) -> dict:
        try:
            await self._read_limiter.check()
        except ProtocolError:
            self._metrics["rateLimitBlocks"] = (
                self._metrics.get("rateLimitBlocks", 0) + 1
            )
            raise
        async with self._request_slot():
            session = await self.sessions.get(request.session_id)
            results = []
            for point in request.points:
                try:
                    item = await session.driver.read(
                        session.connection,
                        point.id,
                        point.driver_descriptor(),
                        point.type,
                    )
                    results.append(
                        {
                            "id": point.id,
                            "status": "ok",
                            "value": item.value,
                            "valor": item.value,
                            "quality": item.quality,
                            "timestamp": item.timestamp,
                        }
                    )
                except DriverError as exc:
                    self._metrics["errors"] += 1
                    results.append(
                        {
                            "id": point.id,
                            "status": "error",
                            "quality": exc.quality,
                            "error": {
                                "code": exc.code,
                                "message": exc.message,
                                "retryable": exc.retryable,
                            },
                        }
                    )
                except Exception as exc:  # isolamento por ponto
                    self._metrics["errors"] += 1
                    results.append(
                        {
                            "id": point.id,
                            "status": "error",
                            "error": {
                                "code": "read_failed",
                                "message": str(exc),
                            },
                        }
                    )
            self._metrics["readRequests"] += 1
            return {
                "ok": all(r["status"] == "ok" for r in results),
                "status": "ok"
                if all(r["status"] == "ok" for r in results)
                else "partial",
                "requestId": request.request_id,
                "values": results,
            }

    async def write(self, request: WriteRequest) -> dict:
        session = await self.sessions.get(request.session_id)
        dedup_key = (session.device_id, request.request_id)
        fingerprint = hashlib.sha256(
            json.dumps(
                [
                    item.model_dump(mode="json", exclude_none=True)
                    for item in request.writes
                ],
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        owner = False
        async with self._dedup_lock:
            cached = self._dedup.get(dedup_key)
            if cached and cached[0] > time.monotonic():
                if cached[1] != fingerprint:
                    raise ProtocolError(
                        409,
                        "request_id_conflict",
                        "O requestId já foi usado para outra intenção de escrita.",
                    )
                self._metrics["deduplicatedWrites"] += 1
                return deepcopy(cached[2])
            inflight = self._inflight_writes.get(dedup_key)
            if inflight is not None:
                if inflight[0] != fingerprint:
                    raise ProtocolError(
                        409,
                        "request_id_conflict",
                        "O requestId já está em uso por outra intenção de escrita.",
                    )
                future = inflight[1]
            else:
                future = asyncio.get_running_loop().create_future()
                self._inflight_writes[dedup_key] = (fingerprint, future)
                owner = True

        if not owner:
            self._metrics["deduplicatedWrites"] += 1
            return deepcopy(await asyncio.shield(future))

        try:
            try:
                await self._write_limiter.check()
            except ProtocolError:
                self._metrics["rateLimitBlocks"] = (
                    self._metrics.get("rateLimitBlocks", 0) + 1
                )
                raise
            async with self._request_slot():
                results = []
                for write in request.writes:
                    try:
                        if isinstance(write.value, (int, float)) and not isinstance(
                            write.value, bool
                        ):
                            if write.min is not None and write.value < write.min:
                                raise ValueError(
                                    f"Valor menor que o mínimo {write.min}."
                                )
                            if write.max is not None and write.value > write.max:
                                raise ValueError(
                                    f"Valor maior que o máximo {write.max}."
                                )
                        item = await session.driver.write(
                            session.connection,
                            write.id,
                            write.driver_descriptor(),
                            write.value,
                            write.type,
                        )
                        results.append(
                            {
                                "id": write.id,
                                "status": "written",
                                "value": item.value,
                                "valor": item.value,
                                "quality": item.quality,
                                "timestamp": item.timestamp,
                            }
                        )
                    except DriverError as exc:
                        self._metrics["errors"] += 1
                        results.append(
                            {
                                "id": write.id,
                                "status": "error",
                                "quality": exc.quality,
                                "error": {
                                    "code": exc.code,
                                    "message": exc.message,
                                    "retryable": exc.retryable,
                                },
                            }
                        )
                    except Exception as exc:  # isolamento por ponto
                        self._metrics["errors"] += 1
                        results.append(
                            {
                                "id": write.id,
                                "status": "error",
                                "error": {
                                    "code": "write_failed",
                                    "message": str(exc),
                                },
                            }
                        )
                response = {
                    "ok": all(r["status"] == "written" for r in results),
                    "status": "ok"
                    if all(r["status"] == "written" for r in results)
                    else "partial",
                    "requestId": request.request_id,
                    "results": results,
                }
                self._metrics["writeRequests"] += 1
                async with self._dedup_lock:
                    if self.config.limits.dedup_window_ms > 0:
                        expires = (
                            time.monotonic() + self.config.limits.dedup_window_ms / 1000
                        )
                        self._dedup[dedup_key] = (
                            expires,
                            fingerprint,
                            deepcopy(response),
                        )
                    if not future.done():
                        future.set_result(deepcopy(response))
                return response
        except BaseException as exc:
            if not future.done():
                future.set_exception(exc)
                future.exception()
            raise
        finally:
            async with self._dedup_lock:
                current = self._inflight_writes.get(dedup_key)
                if current is not None and current[1] is future:
                    self._inflight_writes.pop(dedup_key, None)

    async def public_status(self) -> dict:
        session_count = await self.sessions.count()
        connection_count = len(await self.pool.diagnostics())
        return {
            "ok": True,
            "status": "ok",
            "service": "online",
            "state": "ready",
            "product": "LinkPad Agent",
            "version": __version__,
            "protocolVersion": "0.1.0",
            "startedAt": self._started_at,
            "uptime": round(time.monotonic() - self._started_monotonic, 3),
            "drivers": self.registry.ids(),
            "activeSessions": session_count,
            "pooledConnections": connection_count,
            "reads": self._metrics["readRequests"],
            "writes": self._metrics["writeRequests"],
            "dedupHits": self._metrics["deduplicatedWrites"],
            "rateLimitBlocks": self._metrics.get("rateLimitBlocks", 0),
            "lastError": "",
        }

    def capabilities(self) -> dict:
        return {
            "ok": True,
            "status": "ok",
            "protocolVersion": "0.1.0",
            "protocol": {
                "id": "linkpad-protocol",
                "version": "0.1.0",
                "supportedVersions": ["0.1.0"],
            },
            "drivers": self.registry.capabilities(),
            "limits": {
                "maxSessions": self.config.limits.max_sessions,
                "readRps": self.config.limits.read_rps,
                "writeRps": self.config.limits.write_rps,
            },
        }

    async def management_status(self) -> dict:
        sessions = await self.sessions.count()
        connections = await self.pool.diagnostics()
        warnings = []
        if not self.config.security.token:
            warnings.append("public_api_authentication_disabled")
        return {
            **(await self.public_status()),
            "sessions": sessions,
            "connections": len(connections),
            "metrics": dict(self._metrics),
            "warnings": warnings,
        }
