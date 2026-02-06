"""
SpeakMate AI - Authentication Routes (Telegram)
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.telegram_auth import validate_telegram_init_data, create_internal_jwt
from app.db.supabase import db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class TelegramAuthRequest(BaseModel):
    init_data: str


class TelegramAuthResponse(BaseModel):
    token: str
    user: dict


@router.post("/telegram", response_model=TelegramAuthResponse)
async def authenticate_telegram(body: TelegramAuthRequest):
    """
    Authenticate a Telegram Web App user.

    1. Validate Telegram initData (HMAC-SHA256)
    2. Find or create user in the database
    3. Return JWT token for subsequent API calls
    """
    # 1. Validate
    tg_user = validate_telegram_init_data(body.init_data)
    telegram_id = tg_user["id"]
    full_name = (
        f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip()
        or "User"
    )
    username = tg_user.get("username")

    # 2. Find or create
    user = await _get_or_create_user(telegram_id, full_name, username)
    user_id = user["id"]

    # 3. Issue JWT
    token = create_internal_jwt(
        user_id=user_id,
        telegram_id=telegram_id,
        extra={"full_name": full_name},
    )

    return TelegramAuthResponse(token=token, user=user)


async def _get_or_create_user(
    telegram_id: int,
    full_name: str,
    username: str | None,
) -> dict:
    """Lookup by telegram_id; create if missing."""
    try:
        response = (
            db_service.client.table("users")
            .select("*")
            .eq("telegram_id", telegram_id)
            .single()
            .execute()
        )
        if response.data:
            return response.data
    except Exception:
        pass  # not found — will create below

    # Create
    user_data = {
        "id": str(uuid.uuid4()),
        "telegram_id": telegram_id,
        "telegram_username": username,
        "full_name": full_name,
        "native_language": "uz",
        "target_band": 7.0,
        "auth_provider": "telegram",
    }
    try:
        response = db_service.client.table("users").insert(user_data).execute()
        return response.data[0] if response.data else user_data
    except Exception as e:
        logger.error(f"Failed to create user for tg:{telegram_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account",
        )
