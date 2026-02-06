"""
SpeakMate AI - Telegram Web App Authentication

Validates Telegram initData using HMAC-SHA256 and issues JWT tokens.
"""
import hmac
import hashlib
import json
import time
import uuid
import logging
from urllib.parse import parse_qs, unquote
from typing import Optional

from fastapi import HTTPException, status
from jose import jwt as jose_jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# How long initData is considered valid (seconds)
INIT_DATA_EXPIRY = 3600  # 1 hour


def validate_telegram_init_data(init_data: str) -> dict:
    """
    Validate Telegram Web App initData using HMAC-SHA256.

    Args:
        init_data: Raw init_data string from Telegram.WebApp.initData

    Returns:
        Parsed user dict from the validated data.

    Raises:
        HTTPException if validation fails.
    """
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TELEGRAM_BOT_TOKEN not configured",
        )

    try:
        # Parse the query-string style data
        parsed = parse_qs(init_data, keep_blank_values=True)
        received_hash = parsed.get("hash", [None])[0]

        if not received_hash:
            raise ValueError("Missing hash in initData")

        # Build the data-check-string (all params except hash, sorted, newline-separated)
        data_pairs = []
        for key, values in parsed.items():
            if key == "hash":
                continue
            data_pairs.append(f"{key}={values[0]}")
        data_pairs.sort()
        data_check_string = "\n".join(data_pairs)

        # Compute HMAC-SHA256
        secret_key = hmac.new(
            b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
        ).digest()
        computed_hash = hmac.new(
            secret_key, data_check_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            raise ValueError("Hash mismatch")

        # Optionally check auth_date freshness
        auth_date_str = parsed.get("auth_date", [None])[0]
        if auth_date_str:
            auth_date = int(auth_date_str)
            if time.time() - auth_date > INIT_DATA_EXPIRY:
                raise ValueError("initData expired")

        # Parse user JSON
        user_str = parsed.get("user", [None])[0]
        if not user_str:
            raise ValueError("No user in initData")

        user = json.loads(unquote(user_str))
        return user

    except ValueError as e:
        logger.warning(f"Telegram initData validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Telegram initData: {e}",
        )
    except Exception as e:
        logger.error(f"Unexpected error validating initData: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to validate Telegram initData",
        )


def create_internal_jwt(user_id: str, telegram_id: int, extra: dict | None = None) -> str:
    """
    Create an internal JWT for Telegram users so they can use the existing API.

    The token is signed with the Supabase JWT secret (or a fallback for dev).
    """
    secret = settings.SUPABASE_JWT_SECRET or "dev-secret-key-not-for-production"

    payload = {
        "sub": user_id,
        "telegram_id": telegram_id,
        "role": "authenticated",
        "iss": "speakmate-telegram",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 7,  # 7 days
    }
    if extra:
        payload.update(extra)

    return jose_jwt.encode(payload, secret, algorithm="HS256")
