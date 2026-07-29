from __future__ import annotations

from copy import deepcopy
import json
import os
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PRODUCT_NAME = "LinkPad Agent"


class ConfigModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ServerConfig(ConfigModel):
    bind: str = "0.0.0.0"
    port: int = Field(default=8008, ge=1, le=65535)


class ManagementConfig(ConfigModel):
    bind: Literal["127.0.0.1", "localhost"] = "127.0.0.1"
    port: int = Field(default=8009, ge=1, le=65535)


class LimitsConfig(ConfigModel):
    max_sessions: int = Field(default=100, alias="maxSessions", ge=1)
    session_ttl_seconds: int = Field(default=300, alias="sessionTtlSeconds", ge=1)
    idle_connection_ttl_seconds: int = Field(
        default=120, alias="idleConnectionTtlSeconds", ge=0
    )
    read_rps: int = Field(default=50, alias="readRps", ge=1)
    write_rps: int = Field(default=10, alias="writeRps", ge=1)
    dedup_window_ms: int = Field(default=500, alias="dedupWindowMs", ge=0)
    max_pending_requests: int = Field(default=200, alias="maxPendingRequests", ge=1)
    write_confirm_timeout_ms: int = Field(
        default=3000, alias="writeConfirmTimeoutMs", ge=1
    )


class SecurityConfig(ConfigModel):
    token: str = ""
    device_whitelist: list[str] = Field(default_factory=list, alias="deviceWhitelist")
    allowed_target_networks: list[str] = Field(
        default_factory=lambda: ["private"],
        alias="allowedTargetNetworks",
    )
    allowed_drivers: list[str] = Field(
        default_factory=lambda: ["sim", "siemens-s7", "opcua"], alias="allowedDrivers"
    )


class LoggingConfig(ConfigModel):
    level: str = "INFO"
    retention_days: int = Field(default=14, alias="retentionDays", ge=1)
    max_file_mb: int = Field(default=10, alias="maxFileMb", ge=1)


class LegacyConfig(ConfigModel):
    enabled: bool = False
    default_target: dict | None = Field(default=None, alias="defaultTarget")


class AgentConfig(ConfigModel):
    schema_version: str = Field(default="0.4.0", alias="schemaVersion")
    product: str = PRODUCT_NAME
    server: ServerConfig = Field(default_factory=ServerConfig)
    management: ManagementConfig = Field(default_factory=ManagementConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    legacy: LegacyConfig = Field(default_factory=LegacyConfig)


class AppPaths(BaseModel):
    data_dir: Path
    config_file: Path
    log_dir: Path

    @classmethod
    def discover(cls) -> "AppPaths":
        configured = os.getenv("LINKPAD_AGENT_CONFIG")
        if configured:
            config_file = Path(configured).expanduser().resolve()
            data_dir = config_file.parent
        else:
            program_data = Path(os.getenv("PROGRAMDATA", Path.home() / ".linkpad"))
            data_dir = program_data / "LinkPad" / "Agent"
            config_file = data_dir / "config.json"
        return cls(
            data_dir=data_dir,
            config_file=config_file,
            log_dir=data_dir / "logs",
        )


def load_config(paths: AppPaths | None = None) -> tuple[AgentConfig, AppPaths]:
    paths = paths or AppPaths.discover()
    paths.data_dir.mkdir(parents=True, exist_ok=True)
    paths.log_dir.mkdir(parents=True, exist_ok=True)

    if not paths.config_file.exists():
        default = AgentConfig()
        paths.config_file.write_text(
            json.dumps(default.model_dump(by_alias=True), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    raw = json.loads(paths.config_file.read_text(encoding="utf-8"))
    migrated = _migrate_config(raw)
    if migrated != raw:
        backup_dir = paths.data_dir / ".migration-backup"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = backup_dir / f"config-{raw.get('schemaVersion', 'legacy')}.json"
        if not backup_file.exists():
            backup_file.write_text(
                json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        paths.config_file.write_text(
            json.dumps(migrated, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        raw = migrated
    return AgentConfig.model_validate(raw), paths


def _migrate_config(raw: dict) -> dict:
    if raw.get("schemaVersion") not in {"0.2.0", "0.3.0"}:
        return raw

    migrated = deepcopy(raw)
    security = migrated.setdefault("security", {})
    if security.get("allowedDrivers") == ["sim"]:
        security["allowedDrivers"] = ["sim", "siemens-s7"]
    if security.get("allowedDrivers") == ["sim", "siemens-s7"]:
        security["allowedDrivers"] = ["sim", "siemens-s7", "opcua"]
    if security.get("allowedTargetNetworks") == ["private", "same-subnet"]:
        security["allowedTargetNetworks"] = ["private"]
    migrated["schemaVersion"] = "0.4.0"
    return migrated
