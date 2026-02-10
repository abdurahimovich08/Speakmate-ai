"""
SpeakMate AI - Configuration Settings (Production)
"""
import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings import NoDecode
from pydantic import field_validator
from functools import lru_cache
from typing import Optional, List
from typing import Annotated

# Find .env file
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # App settings
    APP_NAME: str = "SpeakMate AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Supabase settings
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None  # From Supabase Dashboard -> Settings -> API
    
    # Google Cloud settings
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    
    # Speech settings
    SPEECH_LANGUAGE_CODE: str = "en-US"
    SPEECH_SAMPLE_RATE: int = 16000
    
    # Gemini settings
    GEMINI_MODEL: str = "gemini-pro"
    
    # Redis settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False
    
    # Storage settings
    STORAGE_BUCKET: str = "speakmate-assets"
    PDF_RETENTION_DAYS: int = 30
    AUDIO_RETENTION_DAYS: int = 7
    
    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    
    # CORS settings
    # Accepts JSON array, comma-separated string, or single URL.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = ["*"]
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_WEBHOOK_URL: Optional[str] = None
    TELEGRAM_WEBAPP_URL: Optional[str] = None

    # Scheduled jobs / cron triggers
    CRON_SECRET: Optional[str] = None
    
    # Sentry
    SENTRY_DSN: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        def normalize_origin(origin_value) -> Optional[str]:
            origin = str(origin_value).strip().strip('"').strip("'")
            if not origin:
                return None
            if origin != "*":
                origin = origin.rstrip("/")
            return origin

        if value is None:
            return ["*"]
        if isinstance(value, list):
            normalized = [normalize_origin(item) for item in value]
            cleaned = [item for item in normalized if item]
            return cleaned or ["*"]
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return ["*"]

            # Render/env often stores JSON as plain string.
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        normalized = [normalize_origin(item) for item in parsed]
                        cleaned = [item for item in normalized if item]
                        return cleaned or ["*"]
                except json.JSONDecodeError:
                    pass

            # Fallback: comma-separated or single origin.
            parts = [normalize_origin(part) for part in raw.split(",")]
            parts = [part for part in parts if part]
            if parts:
                return parts

        raise ValueError("CORS_ORIGINS must be a list, JSON array, or comma-separated string")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
