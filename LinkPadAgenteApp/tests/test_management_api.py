from __future__ import annotations

import httpx
import pytest

from linkpad_agent.api.management import create_management_app
from linkpad_agent.protocol.models import SessionCreateRequest
from linkpad_agent.runtime.agent import AgentRuntime


@pytest.mark.asyncio
async def test_management_reports_sessions_connections_and_auth_warning(agent_config):
    agent_config.security.token = ""
    runtime = AgentRuntime(agent_config)
    await runtime.create_session(
        SessionCreateRequest.model_validate(
            {
                "contractVersion": "0.1.0",
                "deviceId": "test-device",
                "target": {"driver": "sim", "endpoint": "memory://management"},
            }
        )
    )
    transport = httpx.ASGITransport(app=create_management_app(runtime))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        status = await client.get("/management/v1/status")
        sessions = await client.get("/management/v1/sessions")
        connections = await client.get("/management/v1/connections")

    assert status.json()["sessions"] == 1
    assert status.json()["connections"] == 1
    assert "public_api_authentication_disabled" in status.json()["warnings"]
    assert len(sessions.json()["sessions"]) == 1
    assert len(connections.json()["connections"]) == 1
    await runtime.stop()
