from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from growthos_ai.config import get_settings
from growthos_ai.logging import configure_logging


def timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.LOG_LEVEL)
    logger = structlog.get_logger("ai-service")

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await logger.ainfo("service_started", provider=settings.AI_PROVIDER)
        yield
        await logger.ainfo("service_stopped")

    application = FastAPI(
        title="zero2one Growth OS AI service",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )

    @application.exception_handler(Exception)
    async def safe_exception_handler(request: Request, error: Exception) -> JSONResponse:
        await logger.aerror(
            "request_failed",
            error_class=type(error).__name__,
            method=request.method,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={
                "statusCode": 500,
                "error": "Internal Server Error",
                "message": "Internal server error",
                "timestamp": timestamp(),
            },
        )

    @application.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "ok", "service": "ai-service", "timestamp": timestamp()}

    @application.get("/health/ready")
    async def ready() -> dict[str, str | bool]:
        return {
            "status": "ok",
            "service": "ai-service",
            "timestamp": timestamp(),
            "providerConfigured": settings.provider_configured,
        }

    return application


app = create_app()
