from __future__ import annotations

import asyncio
from typing import Any

import pytest

from linkpad_agent.config import AgentConfig
from linkpad_agent.drivers.base import DriverValue, IndustrialDriver
from linkpad_agent.protocol.models import SessionCreateRequest, TargetDescriptor
from linkpad_agent.runtime.agent import AgentRuntime
from linkpad_agent.sessions.connection_pool import ConnectionPool


class ControlledDriver(IndustrialDriver):
    id = "controlled"
    display_name = "Controlled test driver"

    def __init__(self) -> None:
        self.started: set[str] = set()
        self.started_event = asyncio.Event()
        self.two_started = asyncio.Event()
        self.release = asyncio.Event()

    def validate_target(self, target: TargetDescriptor) -> None:
        return None

    async def connect(self, target: TargetDescriptor) -> dict[str, str]:
        self.started.add(target.endpoint)
        self.started_event.set()
        if len(self.started) >= 2:
            self.two_started.set()
        await self.release.wait()
        return {"endpoint": target.endpoint}

    async def disconnect(self, connection: Any) -> None:
        return None

    async def read(
        self,
        connection: Any,
        point_id: str,
        protocol: dict[str, Any],
        declared_type: str | None = None,
    ) -> DriverValue:
        return DriverValue(0)

    async def write(
        self,
        connection: Any,
        point_id: str,
        protocol: dict[str, Any],
        value: Any,
        declared_type: str | None = None,
    ) -> DriverValue:
        return DriverValue(value)


def session_request(driver: str, endpoint: str, device_id: str) -> SessionCreateRequest:
    return SessionCreateRequest.model_validate(
        {
            "contractVersion": "0.1.0",
            "deviceId": device_id,
            "target": {"driver": driver, "endpoint": endpoint, "options": {}},
        }
    )


@pytest.mark.asyncio
async def test_slow_new_connection_does_not_block_existing_session() -> None:
    config = AgentConfig.model_validate(
        {"security": {"allowedDrivers": ["sim", "controlled"]}}
    )
    runtime = AgentRuntime(config)
    controlled = ControlledDriver()
    runtime.registry.register(controlled)
    existing = await runtime.sessions.create(
        session_request("sim", "memory://existing", "existing-device")
    )
    pending = asyncio.create_task(
        runtime.sessions.create(
            session_request("controlled", "memory://slow", "slow-device")
        )
    )

    try:
        await asyncio.wait_for(controlled.started_event.wait(), 0.1)
        recovered = await asyncio.wait_for(runtime.sessions.get(existing.id), 0.1)
        assert recovered.id == existing.id
    finally:
        controlled.release.set()
        await pending
        await runtime.stop()


@pytest.mark.asyncio
async def test_different_targets_connect_in_parallel() -> None:
    pool = ConnectionPool(idle_ttl_seconds=0)
    driver = ControlledDriver()
    first_target = TargetDescriptor(
        driver="controlled", endpoint="memory://first", options={}
    )
    second_target = TargetDescriptor(
        driver="controlled", endpoint="memory://second", options={}
    )
    first = asyncio.create_task(pool.acquire(driver, first_target))
    second = asyncio.create_task(pool.acquire(driver, second_target))

    try:
        await asyncio.wait_for(driver.two_started.wait(), 0.1)
    finally:
        driver.release.set()
    await asyncio.gather(first, second)
    assert driver.started == {"memory://first", "memory://second"}
    await pool.shutdown()
