from __future__ import annotations

import pytest

from linkpad_agent.config import AgentConfig


@pytest.fixture
def agent_config() -> AgentConfig:
    return AgentConfig.model_validate(
        {
            "limits": {
                "maxSessions": 10,
                "sessionTtlSeconds": 30,
                "idleConnectionTtlSeconds": 0,
                "readRps": 50,
                "writeRps": 20,
                "dedupWindowMs": 1000,
                "maxPendingRequests": 20,
                "writeConfirmTimeoutMs": 3000,
            },
            "security": {
                "token": "test-token",
                "deviceWhitelist": [],
                "allowedTargetNetworks": ["private"],
                "allowedDrivers": ["sim"],
            },
        }
    )


@pytest.fixture
def headers() -> dict[str, str]:
    return {"X-LINKPAD-TOKEN": "test-token"}


@pytest.fixture
def session_payload() -> dict:
    return {
        "contractVersion": "0.1.0",
        "deviceId": "m5stick-test-01",
        "projectId": "project-test",
        "target": {
            "driver": "sim",
            "endpoint": "memory://pytest",
            "options": {},
        },
    }
