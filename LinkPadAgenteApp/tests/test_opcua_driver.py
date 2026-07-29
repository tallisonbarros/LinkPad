from __future__ import annotations

from datetime import datetime, timezone

import pytest
import httpx
from asyncua import Server, ua

from linkpad_agent.api.public import create_public_app
from linkpad_agent.config import AgentConfig
from linkpad_agent.drivers.base import DriverError
from linkpad_agent.drivers.opcua import OpcUaDriver
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import TargetDescriptor
from linkpad_agent.runtime.agent import AgentRuntime
from linkpad_agent.security.target_policy import TargetPolicy


def target(endpoint: str = "opc.tcp://192.168.0.10:4840") -> TargetDescriptor:
    return TargetDescriptor(
        driver="opcua",
        endpoint=endpoint,
        options={
            "securityPolicy": "None",
            "securityMode": "None",
            "sessionTimeoutMs": 30_000,
            "requestTimeoutMs": 2_000,
        },
        auth={"mode": "anonymous"},
    )


def test_opcua_capability_and_target_policy() -> None:
    driver = OpcUaDriver()
    capability = driver.capability()

    assert capability["id"] == "opcua"
    assert capability["target"]["endpointScheme"] == "opc.tcp"
    assert capability["point"]["fields"] == ["nodeId"]
    TargetPolicy(AgentConfig().security).validate_target(target(), driver)


def test_opcua_rejects_unsafe_or_unsupported_target_options() -> None:
    driver = OpcUaDriver()

    with pytest.raises(ProtocolError, match="porta TCP 4840"):
        driver.validate_target(target("opc.tcp://192.168.0.10:4841"))
    with pytest.raises(ProtocolError, match="autenticação anônima"):
        driver.validate_target(
            TargetDescriptor(
                driver="opcua",
                endpoint="opc.tcp://192.168.0.10:4840",
                options={},
                auth={"mode": "username", "username": "operator"},
            )
        )
    with pytest.raises(ProtocolError, match="SecurityPolicy None"):
        driver.validate_target(
            TargetDescriptor(
                driver="opcua",
                endpoint="opc.tcp://192.168.0.10:4840",
                options={
                    "securityPolicy": "Basic256Sha256",
                    "securityMode": "SignAndEncrypt",
                },
            )
        )


def test_runtime_advertises_opcua() -> None:
    runtime = AgentRuntime(AgentConfig())
    assert "opcua" in runtime.registry.ids()
    assert any(item["id"] == "opcua" for item in runtime.capabilities()["drivers"])


def test_maps_uncertain_datavalue_without_discarding_the_value() -> None:
    data_value = ua.DataValue(
        ua.Variant(12.5, ua.VariantType.Double),
        ua.StatusCode(0x40920000),  # UncertainInitialValue
        SourceTimestamp=datetime(2026, 7, 16, tzinfo=timezone.utc),
    )

    value = OpcUaDriver._driver_value(data_value, ua.VariantType.Double, "float")

    assert value.value == 12.5
    assert value.quality == "uncertain"
    assert value.timestamp == "2026-07-16T00:00:00Z"


@pytest.mark.asyncio
async def test_reads_and_writes_a_real_asyncua_server() -> None:
    server = Server()
    await server.init()
    server.set_endpoint("opc.tcp://127.0.0.1:4840/linkpad/")
    namespace_uri = "urn:linkpad:test"
    namespace_index = await server.register_namespace(namespace_uri)
    line = await server.nodes.objects.add_object(namespace_index, "Line")
    speed = await line.add_variable(
        ua.NodeId("Motor.Speed", namespace_index),
        "Motor.Speed",
        12.5,
        ua.VariantType.Double,
    )
    count = await line.add_variable(
        ua.NodeId("Motor.Count", namespace_index),
        "Motor.Count",
        7,
        ua.VariantType.Int32,
    )
    enabled = await line.add_variable(
        ua.NodeId("Motor.Enabled", namespace_index),
        "Motor.Enabled",
        True,
        ua.VariantType.Boolean,
    )
    label = await line.add_variable(
        ua.NodeId("Motor.Label", namespace_index),
        "Motor.Label",
        "Linha 1",
        ua.VariantType.String,
    )
    await line.add_variable(
        ua.NodeId("Motor.ReadOnly", namespace_index),
        "Motor.ReadOnly",
        1,
        ua.VariantType.Int32,
    )
    for node in (speed, count, enabled, label):
        await node.set_writable()

    await server.start()
    driver = OpcUaDriver()
    connection = await driver.connect(target("opc.tcp://127.0.0.1:4840/linkpad/"))
    try:
        speed_id = {"nodeId": f"nsu={namespace_uri};s=Motor.Speed"}
        count_id = {"nodeId": f"ns={namespace_index};s=Motor.Count"}
        enabled_id = {"nodeId": f"ns={namespace_index};s=Motor.Enabled"}
        label_id = {"nodeId": f"ns={namespace_index};s=Motor.Label"}

        assert (await driver.read(connection, "Speed", speed_id, "float")).value == 12.5
        assert (await driver.read(connection, "Count", count_id, "int")).value == 7
        assert (await driver.read(connection, "Enabled", enabled_id, "bool")).value is True
        assert (await driver.read(connection, "Label", label_id, "string")).value == "Linha 1"
        assert (await driver.write(connection, "Speed", speed_id, 42.5, "float")).value == 42.5
        assert (await driver.write(connection, "Count", count_id, 11, "int")).value == 11

        with pytest.raises(DriverError, match="não é compatível"):
            await driver.read(connection, "Speed", speed_id, "int")
        with pytest.raises(DriverError) as missing:
            await driver.read(
                connection,
                "Missing",
                {"nodeId": f"ns={namespace_index};s=Missing"},
                "float",
            )
        assert missing.value.code == "node_not_found"
        with pytest.raises(DriverError) as denied:
            await driver.write(
                connection,
                "ReadOnly",
                {"nodeId": f"ns={namespace_index};s=Motor.ReadOnly"},
                2,
                "int",
            )
        assert denied.value.code == "access_denied"
    finally:
        await driver.disconnect(connection)
        await server.stop()


@pytest.mark.asyncio
async def test_linkpad_protocol_reaches_a_real_opcua_server(monkeypatch) -> None:
    server = Server()
    await server.init()
    server.set_endpoint("opc.tcp://127.0.0.1:4840/linkpad/")
    namespace_index = await server.register_namespace("urn:linkpad:lpp-test")
    line = await server.nodes.objects.add_object(namespace_index, "Line")
    speed = await line.add_variable(
        ua.NodeId("Motor.Speed", namespace_index),
        "Motor.Speed",
        10.0,
        ua.VariantType.Double,
    )
    await speed.set_writable()
    await server.start()

    # O core bloqueia loopback por segurança. Este teste libera somente o servidor
    # efêmero local; a política real para IPv4 privado é coberta separadamente.
    monkeypatch.setattr(TargetPolicy, "validate_target", lambda self, target, driver: None)
    config = AgentConfig.model_validate({
        "security": {
            "token": "opc-test",
            "allowedTargetNetworks": ["private"],
            "allowedDrivers": ["opcua"],
        }
    })
    runtime = AgentRuntime(config)
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_public_app(runtime, config)),
        base_url="http://test",
    )
    headers = {"X-LINKPAD-TOKEN": "opc-test"}
    try:
        created = await client.post(
            "/lpp/v1/sessions",
            headers=headers,
            json={
                "contractVersion": "0.1.0",
                "deviceId": "linkpad-opc-test",
                "projectId": "opc-project",
                "target": {
                    "driver": "opcua",
                    "endpoint": "opc.tcp://127.0.0.1:4840/linkpad/",
                    "options": {},
                    "auth": {"mode": "anonymous"},
                },
            },
        )
        assert created.status_code == 201
        session_id = created.json()["sessionId"]
        address = {"nodeId": f"ns={namespace_index};s=Motor.Speed"}

        read = await client.post(
            "/lpp/v1/read",
            headers=headers,
            json={
                "requestId": "opc-read-1",
                "sessionId": session_id,
                "points": [{"id": "Speed", "address": address, "type": "float"}],
            },
        )
        assert read.status_code == 200
        assert read.json()["values"][0]["value"] == 10.0
        assert read.json()["values"][0]["valor"] == 10.0

        write = await client.post(
            "/lpp/v1/write",
            headers=headers,
            json={
                "requestId": "opc-write-1",
                "sessionId": session_id,
                "writes": [{
                    "id": "Speed",
                    "address": address,
                    "type": "float",
                    "value": 25.5,
                    "min": 0,
                    "max": 100,
                }],
            },
        )
        assert write.status_code == 200
        assert write.json()["results"][0]["value"] == 25.5

        closed = await client.delete(f"/lpp/v1/sessions/{session_id}", headers=headers)
        assert closed.status_code == 200
    finally:
        await client.aclose()
        await runtime.stop()
        await server.stop()
