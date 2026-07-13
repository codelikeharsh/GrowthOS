from fastapi.testclient import TestClient

from growthos_ai.main import create_app


def test_liveness() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "ai-service"


def test_readiness_does_not_require_provider_credentials() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["providerConfigured"] is False


def test_safe_error_format_does_not_expose_exception() -> None:
    application = create_app()

    @application.get("/test-failure")
    async def fail() -> None:
        raise RuntimeError("private provider detail")

    with TestClient(application, raise_server_exceptions=False) as client:
        response = client.get("/test-failure")
    assert response.status_code == 500
    assert "private provider detail" not in response.text
    assert response.json()["message"] == "Internal server error"
