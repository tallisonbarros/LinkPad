from __future__ import annotations

from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class TargetDescriptor(ContractModel):
    driver: str
    endpoint: str
    options: dict[str, Any] = Field(default_factory=dict)
    auth: dict[str, Any] | None = None


class SessionCreateRequest(ContractModel):
    contract_version: str = Field(alias="contractVersion")
    device_id: str = Field(alias="deviceId", min_length=1, max_length=128)
    project_id: str | None = Field(default=None, alias="projectId", max_length=128)
    target: TargetDescriptor


class ProtocolPoint(ContractModel):
    id: str = Field(min_length=1, max_length=128)
    address: dict[str, Any] = Field(default_factory=dict)
    protocol: dict[str, Any] = Field(default_factory=dict)
    type: str | None = None

    def driver_descriptor(self) -> dict[str, Any]:
        return self.address or self.protocol


class ReadRequest(ContractModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=128)
    session_id: str = Field(alias="sessionId", min_length=1)
    points: list[ProtocolPoint] = Field(min_length=1)


class WriteItem(ContractModel):
    id: str = Field(min_length=1, max_length=128)
    value: Any = Field(validation_alias=AliasChoices("value", "valor"))
    address: dict[str, Any] = Field(default_factory=dict)
    protocol: dict[str, Any] = Field(default_factory=dict)
    type: str | None = None
    min: float | None = None
    max: float | None = None

    def driver_descriptor(self) -> dict[str, Any]:
        return self.address or self.protocol


class WriteRequest(ContractModel):
    request_id: str = Field(alias="requestId", min_length=1, max_length=128)
    session_id: str = Field(alias="sessionId", min_length=1)
    writes: list[WriteItem] = Field(min_length=1)
