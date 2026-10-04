"""Settings come from environment variables (the .env file locally, the dashboard on Render)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str  # SECRET. Never put this in the frontend or on GitHub.
    # Websites allowed to call this API, comma separated.
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:5500"
    resume_bucket: str = "resumes"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
