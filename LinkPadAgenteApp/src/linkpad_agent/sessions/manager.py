from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass
from typing import Any

from linkpad_agent.drivers.base import IndustrialDriver
from linkpad_agent.drivers.registry import DriverRegistry
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import SessionCreateRequest, TargetDescriptor
from linkpad_agent.security.target_policy import TargetPolicy
from linkpad_agent.sessions.connection_pool import ConnectionPool


@dataclass(slots=True)
class AgentSession:
    id: str
    device_id: str
    project_id: str | None
    target: TargetDescriptor
    driver: IndustrialDriver
    connection_key: str
    connection: Any
    created_at: float
    last_used: float


class SessionManager:
    def __init__(
        self,
        registry: DriverRegistry,
        pool: ConnectionPool,
        policy: TargetPolicy,
        ttl_seconds: int,
        max_sessions: int,
    ) -> None:
        self._registry = registry
        self._pool = pool
        self._policy = policy
        self._ttl_seconds = ttl_seconds
        self._max_sessions = max_sessions
        self._sessions: dict[str, AgentSession] = {}
        self._lock = asyncio.Lock()
        self._pending_creates = 0
        self._stopping = False

    async def create(self, request: SessionCreateRequest) -> AgentSession:
        if request.contract_version != "0.1.0":
            raise ProtocolError(
                422,
                "contract_version_not_supported",
                f"A versão '{request.contract_version}' não é suportada.",
            )
        self._policy.validate_device(request.device_id)
        self._policy.validate_driver(request.target)
        driver = self._registry.get(request.target.driver)
        driver.validate_target(request.target)
        self._policy.validate_target(request.target, driver)

        async with self._lock:
            if self._stopping:
                raise ProtocolError(503, "agent_stopping", "O Agent está encerrando.")
            if len(self._sessions) + self._pending_creates >= self._max_sessions:
                raise ProtocolError(429, "session_limit", "Limite de sessões atingido.")
            self._pending_creates += 1

        try:
            connection_key, connection = await self._pool.acquire(
                driver, request.target
            )
        except BaseException:
            async with self._lock:
                self._pending_creates -= 1
            raise

        release_connection = False
        async with self._lock:
            self._pending_creates -= 1
            if self._stopping:
                release_connection = True
            else:
                now = time.monotonic()
                session = AgentSession(
                    id=secrets.token_urlsafe(24),
                    device_id=request.device_id,
                    project_id=request.project_id,
                    target=request.target,
                    driver=driver,
                    connection_key=connection_key,
                    connection=connection,
                    created_at=now,
                    last_used=now,
                )
                self._sessions[session.id] = session

        if release_connection:
            await self._pool.release(connection_key)
            raise ProtocolError(503, "agent_stopping", "O Agent está encerrando.")
        return session

    async def get(self, session_id: str) -> AgentSession:
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise ProtocolError(404, "session_not_found", "Sessão não encontrada.")
            if time.monotonic() - session.last_used >= self._ttl_seconds:
                self._sessions.pop(session_id, None)
                await self._pool.release(session.connection_key)
                raise ProtocolError(410, "session_expired", "A sessão expirou.")
            session.last_used = time.monotonic()
            return session

    async def close(self, session_id: str) -> bool:
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if session is None:
                return False
            await self._pool.release(session.connection_key)
            return True

    async def cleanup_expired(self) -> int:
        now = time.monotonic()
        async with self._lock:
            expired = [
                session
                for session in self._sessions.values()
                if now - session.last_used >= self._ttl_seconds
            ]
            for session in expired:
                self._sessions.pop(session.id, None)
                await self._pool.release(session.connection_key)
            return len(expired)

    async def diagnostics(self) -> list[dict]:
        now = time.monotonic()
        async with self._lock:
            return [
                {
                    "sessionId": session.id,
                    "deviceId": session.device_id,
                    "projectId": session.project_id,
                    "driver": session.driver.id,
                    "endpoint": session.target.endpoint,
                    "idleSeconds": round(now - session.last_used, 3),
                    "expiresInSeconds": max(
                        0, round(self._ttl_seconds - (now - session.last_used), 3)
                    ),
                }
                for session in self._sessions.values()
            ]

    async def count(self) -> int:
        async with self._lock:
            return len(self._sessions)

    async def shutdown(self) -> None:
        async with self._lock:
            self._stopping = True
            sessions = list(self._sessions.values())
            self._sessions.clear()
            for session in sessions:
                await self._pool.release(session.connection_key)
