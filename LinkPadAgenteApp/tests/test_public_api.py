from __future__ import annotations

import asyncio

import httpx
import pytest

from linkpad_agent.api.public import create_public_app
from linkpad_agent.config import AgentConfig
from linkpad_agent.runtime.agent import AgentRuntime


def api_client(config: AgentConfig) -> tuple[AgentRuntime, httpx.AsyncClient]:
    runtime = AgentRuntime(config)
    transport = httpx.ASGITransport(app=create_public_app(runtime, config))
    return runtime, httpx.AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_status_and_capabilities_announce_installed_drivers(agent_config, headers):
    runtime, client = api_client(agent_config)
    async with client:
        status = await client.get("/lpp/v1/status", headers=headers)
        capabilities = await client.get("/lpp/v1/capabilities", headers=headers)

    assert status.status_code == 200
    assert status.json()["drivers"] == ["sim", "siemens-s7"]
    assert capabilities.status_code == 200
    assert [item["id"] for item in capabilities.json()["drivers"]] == [
        "sim",
        "siemens-s7",
    ]
    await runtime.stop()


@pytest.mark.asyncio
async def test_token_is_required(agent_config):
    runtime, client = api_client(agent_config)
    async with client:
        response = await client.get("/lpp/v1/status")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
    await runtime.stop()


@pytest.mark.asyncio
async def test_session_read_write_and_legacy_value_alias(
    agent_config, headers, session_payload
):
    runtime, client = api_client(agent_config)
    async with client:
        created = await client.post(
            "/lpp/v1/sessions", headers=headers, json=session_payload
        )
        assert created.status_code == 201
        session_id = created.json()["sessionId"]

        initial = await client.post(
            "/lpp/v1/read",
            headers=headers,
            json={
                "requestId": "read-1",
                "sessionId": session_id,
                "points": [{"id": "motor-speed", "address": {"key": "motor.speed"}}],
            },
        )
        assert initial.status_code == 200

        written = await client.post(
            "/lpp/v1/write",
            headers=headers,
            json={
                "requestId": "write-1",
                "sessionId": session_id,
                "writes": [
                    {
                        "id": "motor-speed",
                        "valor": 42.5,
                        "address": {"key": "motor.speed"},
                    }
                ],
            },
        )
        assert written.status_code == 200
        assert written.json()["results"][0]["value"] == 42.5
        assert written.json()["results"][0]["valor"] == 42.5

        reread = await client.post(
            "/lpp/v1/read",
            headers=headers,
            json={
                "requestId": "read-2",
                "sessionId": session_id,
                "points": [{"id": "motor-speed", "address": {"key": "motor.speed"}}],
            },
        )
        item = reread.json()["values"][0]
        assert item["value"] == 42.5
        assert item["valor"] == 42.5
        assert item["quality"] == "good"

        closed = await client.delete(f"/lpp/v1/sessions/{session_id}", headers=headers)
        assert closed.status_code == 200
        assert closed.json()["status"] == "closed"
    await runtime.stop()


@pytest.mark.asyncio
async def test_write_request_is_deduplicated(agent_config, headers, session_payload):
    runtime, client = api_client(agent_config)
    async with client:
        created = await client.post(
            "/lpp/v1/sessions", headers=headers, json=session_payload
        )
        session_id = created.json()["sessionId"]
        request = {
            "requestId": "same-write-id",
            "sessionId": session_id,
            "writes": [{"id": "select", "value": True, "address": {"key": "select"}}],
        }
        first = await client.post("/lpp/v1/write", headers=headers, json=request)
        second = await client.post("/lpp/v1/write", headers=headers, json=request)

    assert first.json() == second.json()
    assert runtime._metrics["deduplicatedWrites"] == 1
    await runtime.stop()


@pytest.mark.asyncio
async def test_request_id_cannot_be_reused_for_another_write(
    agent_config, headers, session_payload
):
    runtime, client = api_client(agent_config)
    async with client:
        created = await client.post(
            "/lpp/v1/sessions", headers=headers, json=session_payload
        )
        session_id = created.json()["sessionId"]
        first = {
            "requestId": "conflicting-id",
            "sessionId": session_id,
            "writes": [{"id": "speed", "value": 10}],
        }
        conflicting = {
            "requestId": "conflicting-id",
            "sessionId": session_id,
            "writes": [{"id": "speed", "value": 20}],
        }
        assert (
            await client.post("/lpp/v1/write", headers=headers, json=first)
        ).status_code == 200
        response = await client.post("/lpp/v1/write", headers=headers, json=conflicting)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "request_id_conflict"
    await runtime.stop()


@pytest.mark.asyncio
async def test_pool_reuses_equal_targets(agent_config, headers, session_payload):
    runtime, client = api_client(agent_config)
    async with client:
        first = await client.post(
            "/lpp/v1/sessions", headers=headers, json=session_payload
        )
        second_payload = {**session_payload, "deviceId": "m5stick-test-02"}
        second = await client.post(
            "/lpp/v1/sessions", headers=headers, json=second_payload
        )
        connections = await runtime.pool.diagnostics()

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(connections) == 1
    assert connections[0]["references"] == 2
    await runtime.stop()


@pytest.mark.asyncio
async def test_rejects_unimplemented_driver(agent_config, headers, session_payload):
    runtime, client = api_client(agent_config)
    payload = {
        **session_payload,
        "target": {
            "driver": "siemens-s7-opcua",
            "endpoint": "opc.tcp://192.168.0.10:4840",
        },
    }
    async with client:
        response = await client.post("/lpp/v1/sessions", headers=headers, json=payload)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "driver_not_allowed"
    await runtime.stop()


@pytest.mark.asyncio
async def test_expired_session_returns_gone(headers, session_payload):
    config = AgentConfig.model_validate(
        {
            "limits": {"sessionTtlSeconds": 1},
            "security": {"token": "test-token", "allowedDrivers": ["sim"]},
        }
    )
    runtime, client = api_client(config)
    async with client:
        created = await client.post(
            "/lpp/v1/sessions", headers=headers, json=session_payload
        )
        await asyncio.sleep(1.05)
        response = await client.post(
            "/lpp/v1/read",
            headers=headers,
            json={
                "requestId": "expired-read",
                "sessionId": created.json()["sessionId"],
                "points": [{"id": "x"}],
            },
        )

    assert response.status_code == 410
    assert response.json()["error"]["code"] == "session_expired"
    await runtime.stop()
