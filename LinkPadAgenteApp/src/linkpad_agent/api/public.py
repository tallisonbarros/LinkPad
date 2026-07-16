from __future__ import annotations

import secrets
from collections.abc import Callable

from fastapi import Depends, FastAPI, Header, status

from linkpad_agent.config import AgentConfig
from linkpad_agent.protocol.errors import ProtocolError
from linkpad_agent.protocol.models import (
    ReadRequest,
    SessionCreateRequest,
    WriteRequest,
)
from linkpad_agent.runtime.agent import AgentRuntime
from linkpad_agent.api.common import install_error_handlers


def _auth_dependency(config: AgentConfig) -> Callable:
    async def verify_token(x_linkpad_token: str | None = Header(default=None)) -> None:
        configured = config.security.token
        if configured and (
            x_linkpad_token is None
            or not secrets.compare_digest(x_linkpad_token, configured)
        ):
            raise ProtocolError(401, "unauthorized", "Token inválido ou ausente.")

    return verify_token


def create_public_app(runtime: AgentRuntime, config: AgentConfig) -> FastAPI:
    app = FastAPI(
        title="LinkPad Protocol API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        dependencies=[Depends(_auth_dependency(config))],
    )
    install_error_handlers(app)

    @app.get("/lpp/v1/status")
    async def status_endpoint() -> dict:
        return await runtime.public_status()

    @app.get("/lpp/v1/capabilities")
    async def capabilities_endpoint() -> dict:
        return runtime.capabilities()

    @app.post("/lpp/v1/sessions", status_code=status.HTTP_201_CREATED)
    async def create_session_endpoint(request: SessionCreateRequest) -> dict:
        return await runtime.create_session(request)

    @app.delete("/lpp/v1/sessions/{session_id}")
    async def close_session_endpoint(session_id: str) -> dict:
        closed = await runtime.sessions.close(session_id)
        return {
            "ok": True,
            "status": "closed" if closed else "already_closed",
            "sessionId": session_id,
        }

    @app.post("/lpp/v1/read")
    async def read_endpoint(request: ReadRequest) -> dict:
        return await runtime.read(request)

    @app.post("/lpp/v1/write")
    async def write_endpoint(request: WriteRequest) -> dict:
        return await runtime.write(request)

    return app
