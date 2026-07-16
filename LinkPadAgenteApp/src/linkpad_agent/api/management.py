from __future__ import annotations

from fastapi import FastAPI

from linkpad_agent.api.common import install_error_handlers
from linkpad_agent.runtime.agent import AgentRuntime


def create_management_app(runtime: AgentRuntime) -> FastAPI:
    app = FastAPI(
        title="LinkPad Agent Local Management",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    install_error_handlers(app)

    @app.get("/management/v1/status")
    async def status_endpoint() -> dict:
        return await runtime.management_status()

    @app.get("/management/v1/sessions")
    async def sessions_endpoint() -> dict:
        return {"status": "ok", "sessions": await runtime.sessions.diagnostics()}

    @app.get("/management/v1/connections")
    async def connections_endpoint() -> dict:
        return {"status": "ok", "connections": await runtime.pool.diagnostics()}

    return app
