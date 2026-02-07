from fastapi import HTTPException
from jose import jwt

from app.core import security


def test_verify_supabase_token_string_with_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", "test-secret")
    token = jwt.encode(
        {
            "sub": "user-123",
            "email": "user@example.com",
            "role": "authenticated",
            "aud": "authenticated",
        },
        "test-secret",
        algorithm="HS256",
    )

    payload = security.verify_supabase_token_string(token)

    assert payload["user_id"] == "user-123"
    assert payload["email"] == "user@example.com"
    assert payload["role"] == "authenticated"


def test_verify_supabase_token_string_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", "test-secret")

    try:
        security.verify_supabase_token_string("invalid.token.value")
        assert False, "Expected HTTPException for invalid token"
    except HTTPException as exc:
        assert exc.status_code == 401


def test_verify_supabase_token_string_dev_mode_without_secret(monkeypatch):
    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", None)
    token = jwt.encode(
        {"sub": "dev-user", "role": "authenticated"},
        "any-secret",
        algorithm="HS256",
    )

    payload = security.verify_supabase_token_string(token)
    assert payload["user_id"] == "dev-user"
