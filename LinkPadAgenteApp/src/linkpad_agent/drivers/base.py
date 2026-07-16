from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from linkpad_agent.protocol.models import TargetDescriptor


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(slots=True)
class DriverValue:
    value: Any
    quality: str = "good"
    timestamp: str | None = None

    def __post_init__(self) -> None:
        self.timestamp = self.timestamp or utc_now_iso()


class DriverError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        quality: str = "bad",
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.quality = quality
        self.retryable = retryable


class IndustrialDriver(ABC):
    id: str
    display_name: str

    @abstractmethod
    def validate_target(self, target: TargetDescriptor) -> None:
        """Valida um descritor antes de abrir a conexão."""

    def network_endpoint(self, target: TargetDescriptor) -> tuple[str, int] | None:
        """Devolve host/porta para a politica de rede, ou None para drivers locais."""
        return None

    @abstractmethod
    async def connect(self, target: TargetDescriptor) -> Any:
        """Abre a conexão física ou lógica."""

    @abstractmethod
    async def disconnect(self, connection: Any) -> None:
        """Fecha a conexão."""

    @abstractmethod
    async def read(
        self,
        connection: Any,
        point_id: str,
        protocol: dict[str, Any],
        declared_type: str | None = None,
    ) -> DriverValue:
        """Lê um ponto."""

    @abstractmethod
    async def write(
        self,
        connection: Any,
        point_id: str,
        protocol: dict[str, Any],
        value: Any,
        declared_type: str | None = None,
    ) -> DriverValue:
        """Escreve um ponto e devolve o valor confirmado."""

    def capability(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "displayName": self.display_name,
            "operations": ["read", "write"],
            "addressSchemaVersion": "0.1.0",
        }
