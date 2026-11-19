from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process-environment settings (no .env auto-loading)."""

    model_config = SettingsConfigDict(extra="ignore")

    app_name: str = "python-worker"
    app_env: str = "development"
    tick_interval_seconds: float = 5.0
    log_level: str = "info"


@lru_cache
def get_settings() -> Settings:
    return Settings()
