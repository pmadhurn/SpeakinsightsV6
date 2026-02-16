"""
SpeakInsights v3 — Application Configuration
Uses pydantic-settings to load from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:speakinsights@localhost:5432/speakinsights"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # LiveKit
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_EXTERNAL_URL: str = "ws://localhost:7880"  # URL returned to browsers
    LIVEKIT_API_KEY: str = "devkey"
    LIVEKIT_API_SECRET: str = "devsecret1234567890"

    # WhisperX
    WHISPERX_URL: str = "http://localhost:9000"

    # Ollama
    OLLAMA_URL: str = "http://host.docker.internal:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    EMBEDDING_MODEL: str = "nomic-embed-text"

    # Storage
    STORAGE_PATH: str = "/app/storage"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Transcription
    DEFAULT_LANGUAGE: str = "auto"
    WHISPERX_CHUNK_SECONDS: int = 20

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


settings = get_settings()
