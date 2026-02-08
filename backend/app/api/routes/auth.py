"""
SpeakMate AI - Authentication Routes (Telegram)
"""
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
    2. Find or create user in Supabase auth + public.users
    3. Return JWT token for subsequent API calls
    """
    tg_user = validate_telegram_init_data(body.init_data)
    telegram_id = tg_user["id"]
    full_name = (
        f"{tg_user.get('first_name', '')} {tg_user.get('last_name', '')}".strip()
        or "User"
    )
    username = tg_user.get("username")

    try:
        user = await db_service.ensure_telegram_user(
            telegram_id=telegram_id,
            full_name=full_name,
            username=username,
        )
    except Exception as exc:
        message = str(exc)
        logger.error("Telegram user provisioning failed: %s", message, exc_info=True)
        if any(token in message.lower() for token in ("telegram_id", "telegram_username", "auth_provider")):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Telegram columns are missing in public.users. Run Telegram migration SQL first.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Telegram authentication setup failed. Check SUPABASE_SERVICE_ROLE_KEY and user schema.",
        )

    token = create_internal_jwt(
        user_id=user["id"],
        telegram_id=telegram_id,
        extra={"full_name": full_name},
    )

    return TelegramAuthResponse(token=token, user=user)
