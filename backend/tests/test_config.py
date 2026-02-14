"""Tests for configuration and settings."""

from app.core.config import Settings


def test_default_settings():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
    )
    assert s.APP_NAME == "SpeakMate AI"
    assert s.ENVIRONMENT == "development"
    assert s.PORT == 8000


def test_cors_origins_wildcard():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
        CORS_ORIGINS=["*"],
    )
    assert "*" in s.CORS_ORIGINS


def test_cors_origins_comma_string():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
        CORS_ORIGINS="http://localhost:3000,https://example.com",  # type: ignore
    )
    assert len(s.CORS_ORIGINS) == 2
    assert "http://localhost:3000" in s.CORS_ORIGINS


def test_cors_origins_json_array():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
        CORS_ORIGINS='["http://a.com", "http://b.com"]',  # type: ignore
    )
    assert len(s.CORS_ORIGINS) == 2


def test_redis_disabled_by_default():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
    )
    assert s.REDIS_ENABLED is False


def test_debug_defaults_to_false():
    s = Settings(
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_KEY="test-key",
    )
    assert s.DEBUG is False
