import pytest
from pydantic import ValidationError

from growthos_ai.config import Settings


def test_valid_configuration_defaults_to_openai_without_credentials() -> None:
    settings = Settings()
    assert settings.AI_PROVIDER == "openai"
    assert settings.provider_configured is False


def test_invalid_port_fails_validation() -> None:
    with pytest.raises(ValidationError):
        Settings(AI_SERVICE_PORT=70_000)


def test_unsupported_provider_fails_validation() -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({"AI_PROVIDER": "unsupported"})
