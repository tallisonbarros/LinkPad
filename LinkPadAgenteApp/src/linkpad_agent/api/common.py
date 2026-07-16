from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from linkpad_agent.drivers.base import DriverError
from linkpad_agent.protocol.errors import ProtocolError, error_payload


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DriverError)
    async def driver_error_handler(
        request: Request, exc: DriverError
    ) -> JSONResponse:
        payload = error_payload(exc.code, exc.message)
        payload["error"].update(
            {"quality": exc.quality, "retryable": exc.retryable}
        )
        return JSONResponse(
            status_code=503 if exc.retryable else 422,
            content=payload,
        )

    @app.exception_handler(ProtocolError)
    async def protocol_error_handler(
        request: Request, exc: ProtocolError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.code, exc.message),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=error_payload("invalid_request", "Requisição inválida."),
        )
