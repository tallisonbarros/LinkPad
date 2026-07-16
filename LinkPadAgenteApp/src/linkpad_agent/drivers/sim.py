from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

from linkpad_agent.drivers.base import DriverValue, IndustrialDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor


@dataclass(slots=True)
class SimConnection:
    endpoint: str
    values: dict[str, Any] = field(default_factory=dict)


class SimDriver(IndustrialDriver):
    id = "sim"
    display_name = "Simulador LinkPad"

    def validate_target(self, target: TargetDescriptor) -> None:
        if not target.endpoint.startswith("memory://"):
            raise ProtocolError(
                422,
                "invalid_target",
                "O driver sim requer um endpoint no formato memory://nome.",
            )

    async def connect(self, target: TargetDescriptor) -> SimConnection:
        self.validate_target(target)
        return SimConnection(endpoint=target.endpoint)

    async def disconnect(self, connection: SimConnection) -> None:
        return None

    async def read(
        self,
        connection: SimConnection,
        point_id: str,
        protocol: dict[str, Any],
        declared_type: str | None = None,
    ) -> DriverValue:
        address = self._address(point_id, protocol)
        if address not in connection.values:
            connection.values[address] = self._initial_value(address)
        return DriverValue(connection.values[address])

    async def write(
        self,
        connection: SimConnection,
        point_id: str,
        protocol: dict[str, Any],
        value: Any,
        declared_type: str | None = None,
    ) -> DriverValue:
        address = self._address(point_id, protocol)
        connection.values[address] = value
        return DriverValue(value)

    def capability(self) -> dict[str, Any]:
        capability = super().capability()
        capability["target"] = {"endpointScheme": "memory"}
        capability["pointFields"] = ["key", "address", "nodeId", "tag"]
        return capability

    @staticmethod
    def _address(point_id: str, protocol: dict[str, Any]) -> str:
        for field_name in ("key", "address", "nodeId", "tag"):
            value = protocol.get(field_name)
            if value is not None and str(value).strip():
                return str(value)
        return point_id

    @staticmethod
    def _initial_value(address: str) -> Any:
        normalized = address.lower()
        if normalized.endswith(("alarme", "alarm", "select", "enabled")):
            return False
        digest = hashlib.sha256(address.encode("utf-8")).digest()
        if normalized.endswith(("hz", "amp", "current", "speed")):
            return round(int.from_bytes(digest[:2], "big") / 1000, 2)
        return 0
