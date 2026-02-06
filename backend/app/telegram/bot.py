"""
SpeakMate AI - Telegram Bot Instance & Dispatcher
"""
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bot and dispatcher instances (initialized lazily)
_bot: Bot | None = None
_dp: Dispatcher | None = None


def get_bot() -> Bot:
    """Get or create Bot instance."""
    global _bot
    if _bot is None:
        if not settings.TELEGRAM_BOT_TOKEN:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
        _bot = Bot(
            token=settings.TELEGRAM_BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
    return _bot


def get_dispatcher() -> Dispatcher:
    """Get or create Dispatcher instance."""
    global _dp
    if _dp is None:
        _dp = Dispatcher()
        # Register handlers
        from app.telegram.handlers import router as handlers_router
        _dp.include_router(handlers_router)
        logger.info("Telegram bot handlers registered")
    return _dp


async def setup_webhook():
    """Set up webhook for the bot."""
    bot = get_bot()
    webhook_url = settings.TELEGRAM_WEBHOOK_URL
    if not webhook_url:
        logger.warning("TELEGRAM_WEBHOOK_URL not set, skipping webhook setup")
        return

    current = await bot.get_webhook_info()
    if current.url != webhook_url:
        await bot.set_webhook(
            url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"]
        )
        logger.info(f"Telegram webhook set to: {webhook_url}")
    else:
        logger.info("Telegram webhook already set")


async def shutdown_bot():
    """Clean up bot resources."""
    global _bot, _dp
    if _bot:
        await _bot.session.close()
        _bot = None
    _dp = None
    logger.info("Telegram bot shut down")
