from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

from linkpad_agent.drivers.base import IndustrialDriver
from linkpad_agent.protocol.models import TargetDescriptor


@dataclass(slots=True)
class PoolEntry:
    key: str
    driver: IndustrialDriver
    connection: Any
    endpoint: str
    references: int
    created_at: float
    last_used: float


class ConnectionPool:
    def __init__(self, idle_ttl_seconds: int):
        self._idle_ttl_seconds = idle_ttl_seconds
        self._entries: dict[str, PoolEntry] = {}
        self._target_locks: dict[str, asyncio.Lock] = {}
        self._lock = asyncio.Lock()
        self._closed = False

    @staticmethod
    def key_for(target: TargetDescriptor) -> str:
        canonical = json.dumps(
            target.model_dump(mode="json", exclude_none=True),
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    async def acquire(
        self, driver: IndustrialDriver, target: TargetDescriptor
    ) -> tuple[str, Any]:
        key = self.key_for(target)
        async with self._lock:
            if self._closed:
                raise RuntimeError("O pool de conexões está encerrado.")
            target_lock = self._target_locks.setdefault(key, asyncio.Lock())

        async with target_lock:
            async with self._lock:
                if self._closed:
                    raise RuntimeError("O pool de conexões está encerrado.")
                entry = self._entries.get(key)
                if entry is not None:
                    entry.references += 1
                    entry.last_used = time.monotonic()
                    return key, entry.connection

            # Conectar pode aguardar a rede. Somente o lock deste target fica
            # ocupado; outros PLCs e consultas ao pool continuam livres.
            connection = await driver.connect(target)
            now = time.monotonic()
            entry = PoolEntry(
                key=key,
                driver=driver,
                connection=connection,
                endpoint=target.endpoint,
                references=1,
                created_at=now,
                last_used=now,
            )

            async with self._lock:
                if not self._closed:
                    self._entries[key] = entry
                    return key, entry.connection

            await driver.disconnect(connection)
            raise RuntimeError("O pool de conexões foi encerrado durante a conexão.")

    async def release(self, key: str) -> None:
        async with self._lock:
            entry = self._entries.get(key)
            if entry is not None:
                entry.references = max(0, entry.references - 1)
                entry.last_used = time.monotonic()

    async def close_idle(self) -> int:
        now = time.monotonic()
        async with self._lock:
            candidates = [
                entry.key
                for entry in self._entries.values()
                if entry.references == 0
                and now - entry.last_used >= self._idle_ttl_seconds
            ]

        closed = 0
        for key in candidates:
            target_lock = self._target_locks[key]
            async with target_lock:
                async with self._lock:
                    entry = self._entries.get(key)
                    if (
                        entry is None
                        or entry.references != 0
                        or time.monotonic() - entry.last_used
                        < self._idle_ttl_seconds
                    ):
                        continue
                    self._entries.pop(key, None)
                await entry.driver.disconnect(entry.connection)
                closed += 1
        return closed

    async def diagnostics(self) -> list[dict]:
        async with self._lock:
            return [
                {
                    "connectionId": entry.key[:12],
                    "driver": entry.driver.id,
                    "endpoint": entry.endpoint,
                    "references": entry.references,
                    "idleSeconds": round(time.monotonic() - entry.last_used, 3),
                }
                for entry in self._entries.values()
            ]

    async def shutdown(self) -> None:
        async with self._lock:
            entries = list(self._entries.values())
            self._entries.clear()
            self._closed = True
        await asyncio.gather(
            *(entry.driver.disconnect(entry.connection) for entry in entries),
            return_exceptions=True,
        )
