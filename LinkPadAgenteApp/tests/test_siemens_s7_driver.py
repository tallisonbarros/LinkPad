from __future__ import annotations

import struct
from pathlib import Path

import httpx
import pytest

from linkpad_agent.api.public import create_public_app
from linkpad_agent.config import AgentConfig, AppPaths, SecurityConfig, load_config
from linkpad_agent.drivers.base import DriverError
from linkpad_agent.drivers.siemens_s7 import SiemensS7Driver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor
from linkpad_agent.security.target_policy import TargetPolicy
from linkpad_agent.runtime.agent import AgentRuntime


class FakeS7Client:
    def __init__(
        self,
        memory: dict[int, bytearray],
        *,
        fail_read_once: bool = False,
        fail_write_after_commit: bool = False,
    ) -> None:
        self.memory = memory
        self.fail_read_once = fail_read_once
        self.fail_write_after_commit = fail_write_after_commit
        self.connected = False
        self.params: dict[object, int] = {}

    def set_param(self, param, value: int) -> int:
        self.params[param] = value
        return 0


    def connect(self, host: str, rack: int, slot: int, tcp_port: int = 102):
        self.connected = True
        return self

    def disconnect(self) -> None:
        self.connected = False

    def db_read(self, db_number: int, start: int, size: int) -> bytearray:
        if self.fail_read_once:
            self.fail_read_once = False
            raise ConnectionError("conexão interrompida")
        return bytearray(self.memory[db_number][start : start + size])

    def db_write(self, db_number: int, start: int, data: bytearray) -> int:
        self.memory[db_number][start : start + len(data)] = data
        if self.fail_write_after_commit:
            raise ConnectionError("confirmação perdida")
        return 0


class OfflineS7Client(FakeS7Client):
    def connect(self, host: str, rack: int, slot: int, tcp_port: int = 102):
        raise ConnectionError("PLC não respondeu")


def target(endpoint: str = "s7://192.168.0.10:102") -> TargetDescriptor:
    return TargetDescriptor.model_validate(
        {
            "driver": "siemens-s7",
            "endpoint": endpoint,
            "options": {"rack": 0, "slot": 1, "timeoutMs": 500},
        }
    )


@pytest.mark.asyncio
async def test_reads_and_writes_supported_db_types() -> None:
    memory = {100: bytearray(32)}
    memory[100][0:4] = struct.pack(">f", 12.5)
    driver = SiemensS7Driver(lambda: FakeS7Client(memory))
    connection = await driver.connect(target())

    read = await driver.read(
        connection,
        "temperature",
        {"area": "DB", "dbNumber": 100, "byteOffset": 0, "dataType": "REAL"},
        "float",
    )
    written = await driver.write(
        connection,
        "counter",
        {"area": "DB", "dbNumber": 100, "byteOffset": 4, "dataType": "DINT"},
        123456,
        "int",
    )
    boolean = await driver.write(
        connection,
        "running",
        {
            "area": "DB",
            "dbNumber": 100,
            "byteOffset": 8,
            "bitOffset": 3,
            "dataType": "BOOL",
        },
        True,
        "bool",
    )

    assert read.value == pytest.approx(12.5)
    assert written.value == 123456
    assert boolean.value is True
    assert memory[100][8] == 0b00001000


@pytest.mark.asyncio
async def test_read_reconnects_once() -> None:
    memory = {1: bytearray(struct.pack(">h", 321))}
    clients: list[FakeS7Client] = []

    def factory() -> FakeS7Client:
        client = FakeS7Client(memory, fail_read_once=not clients)
        clients.append(client)
        return client

    driver = SiemensS7Driver(factory)
    connection = await driver.connect(target())
    result = await driver.read(
        connection,
        "value",
        {"area": "DB", "dbNumber": 1, "byteOffset": 0, "dataType": "INT"},
        "int",
    )

    assert result.value == 321
    assert len(clients) == 2


@pytest.mark.asyncio
async def test_write_is_not_retried_when_confirmation_is_uncertain() -> None:
    memory = {1: bytearray(8)}
    clients: list[FakeS7Client] = []

    def factory() -> FakeS7Client:
        client = FakeS7Client(memory, fail_write_after_commit=True)
        clients.append(client)
        return client

    driver = SiemensS7Driver(factory)
    connection = await driver.connect(target())

    with pytest.raises(DriverError) as error:
        await driver.write(
            connection,
            "setpoint",
            {"area": "DB", "dbNumber": 1, "byteOffset": 0, "dataType": "DINT"},
            42,
            "int",
        )

    assert error.value.code == "write_confirmation_failed"
    assert error.value.quality == "uncertain"
    assert len(clients) == 1
    assert struct.unpack(">i", memory[1][0:4])[0] == 42


@pytest.mark.asyncio
async def test_s7_runs_through_linkpad_protocol_and_keeps_value_alias() -> None:
    memory = {100: bytearray(8)}
    memory[100][0:4] = struct.pack(">f", 33.25)
    config = AgentConfig.model_validate(
        {
            "security": {
                "token": "test-token",
                "allowedDrivers": ["siemens-s7"],
                "allowedTargetNetworks": ["private"],
            }
        }
    )
    runtime = AgentRuntime(config)
    runtime.registry.register(SiemensS7Driver(lambda: FakeS7Client(memory)))
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_public_app(runtime, config)),
        base_url="http://test",
    )
    headers = {"X-LINKPAD-TOKEN": "test-token"}

    async with client:
        created = await client.post(
            "/lpp/v1/sessions",
            headers=headers,
            json={
                "contractVersion": "0.1.0",
                "deviceId": "m5-s7-test",
                "target": target().model_dump(mode="json"),
            },
        )
        response = await client.post(
            "/lpp/v1/read",
            headers=headers,
            json={
                "requestId": "s7-read-1",
                "sessionId": created.json()["sessionId"],
                "points": [
                    {
                        "id": "temperature",
                        "type": "float",
                        "address": {
                            "area": "DB",
                            "dbNumber": 100,
                            "byteOffset": 0,
                            "dataType": "REAL",
                        },
                    }
                ],
            },
        )

    assert created.status_code == 201
    assert response.status_code == 200
    assert response.json()["values"][0]["value"] == pytest.approx(33.25)
    assert response.json()["values"][0]["valor"] == pytest.approx(33.25)
    await runtime.stop()


@pytest.mark.asyncio
async def test_offline_s7_session_returns_normalized_json_error() -> None:
    config = AgentConfig.model_validate(
        {
            "security": {
                "token": "test-token",
                "allowedDrivers": ["siemens-s7"],
                "allowedTargetNetworks": ["private"],
            }
        }
    )
    runtime = AgentRuntime(config)
    runtime.registry.register(
        SiemensS7Driver(lambda: OfflineS7Client({100: bytearray(8)}))
    )
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_public_app(runtime, config)),
        base_url="http://test",
    )

    async with client:
        response = await client.post(
            "/lpp/v1/sessions",
            headers={"X-LINKPAD-TOKEN": "test-token"},
            json={
                "contractVersion": "0.1.0",
                "deviceId": "studio-connection-test",
                "target": target().model_dump(mode="json"),
            },
        )

    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "target_offline",
        "message": "Não foi possível conectar ao PLC S7 em 192.168.0.10:102: PLC não respondeu",
        "quality": "offline",
        "retryable": True,
    }
    await runtime.stop()


def test_rejects_invalid_address_and_type_mismatch() -> None:
    driver = SiemensS7Driver()

    with pytest.raises(DriverError, match="somente a área DB"):
        driver._parse_address(
            {"area": "M", "dbNumber": 1, "byteOffset": 0, "dataType": "BOOL"}
        )
    with pytest.raises(DriverError) as error:
        address = driver._parse_address(
            {"area": "DB", "dbNumber": 1, "byteOffset": 0, "dataType": "REAL"}
        )
        driver._validate_declared_type(address, "string")
    assert error.value.code == "type_mismatch"


def test_target_policy_allows_private_ipv4_and_blocks_public() -> None:
    policy = TargetPolicy(
        SecurityConfig.model_validate(
            {
                "allowedDrivers": ["siemens-s7"],
                "allowedTargetNetworks": ["private"],
            }
        )
    )
    driver = SiemensS7Driver()

    policy.validate_target(target(), driver)
    with pytest.raises(ProtocolError) as error:
        policy.validate_target(target("s7://8.8.8.8:102"), driver)
    assert error.value.code == "target_network_not_allowed"


def test_config_020_is_migrated_with_backup(tmp_path: Path) -> None:
    paths = AppPaths(
        data_dir=tmp_path,
        config_file=tmp_path / "config.json",
        log_dir=tmp_path / "logs",
    )
    paths.config_file.write_text(
        """{
  "schemaVersion": "0.2.0",
  "security": {
    "allowedTargetNetworks": ["private", "same-subnet"],
    "allowedDrivers": ["sim"]
  }
}""",
        encoding="utf-8",
    )

    config, _ = load_config(paths)

    assert config.schema_version == "0.3.0"
    assert config.security.allowed_drivers == ["sim", "siemens-s7"]
    assert config.security.allowed_target_networks == ["private"]
    assert (tmp_path / ".migration-backup" / "config-0.2.0.json").exists()
