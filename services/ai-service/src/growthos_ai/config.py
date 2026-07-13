from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated AI service runtime settings; provider credentials are optional in Phase 1."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore", case_sensitive=True)

    NODE_ENV: Literal["development", "test", "production"] = "development"
    AI_SERVICE_PORT: int = Field(default=8000, ge=1, le=65_535)
    LOG_LEVEL: Literal["debug", "info", "warning", "error", "critical"] = "info"
    AI_PROVIDER: Literal["openai"] = "openai"
    OPENAI_API_KEY: SecretStr | None = None
    OPENAI_MODEL: str | None = None

    @property
    def provider_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.OPENAI_MODEL)


@lru_cache
def get_settings() -> Settings:
    return Settings()
