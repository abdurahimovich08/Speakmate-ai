"""
SpeakMate AI - Telegram Webhook Router for FastAPI
"""
import logging
from fastapi import APIRouter, Request, Response
from aiogram.types import Update

from app.telegram.bot import get_bot, get_dispatcher

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(request: Request) -> Response:
    """
    Receive Telegram updates via webhook.
    
    Telegram sends JSON updates to this endpoint.
    We feed them into the aiogram dispatcher.
    """
    try:
        body = await request.json()
        update = Update.model_validate(body, context={"bot": get_bot()})
        dp = get_dispatcher()
        await dp.feed_update(bot=get_bot(), update=update)
    except Exception as e:
        logger.error(f"Error processing Telegram update: {e}", exc_info=True)

    # Always return 200 so Telegram doesn't retry
    return Response(status_code=200)
