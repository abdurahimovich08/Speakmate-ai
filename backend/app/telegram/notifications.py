"""
SpeakMate AI - Telegram Bot Notifications

Send proactive messages to users (session results, reminders, weekly reports).
"""
import logging
from typing import Optional

from app.telegram.bot import get_bot
from app.telegram.keyboards import session_result_keyboard

logger = logging.getLogger(__name__)


async def send_session_result(
    telegram_id: int,
    session_id: str,
    scores: dict,
    duration_seconds: int,
    error_count: int,
):
    """Send session result notification to a Telegram user."""
    bot = get_bot()

    overall = scores.get("overall_band", 0)
    fluency = scores.get("fluency_coherence", 0)
    lexical = scores.get("lexical_resource", 0)
    grammar = scores.get("grammatical_range", 0)
    pronunciation = scores.get("pronunciation", 0)
    minutes = duration_seconds // 60

    text = (
        "🎉 <b>Sessiya yakunlandi!</b>\n\n"
        f"⏱ Davomiylik: <b>{minutes} daqiqa</b>\n"
        f"❌ Xatolar: <b>{error_count}</b>\n\n"
        "📊 <b>IELTS Ballar:</b>\n"
        f"  🗣 Fluency & Coherence: <b>{fluency}</b>\n"
        f"  📖 Lexical Resource: <b>{lexical}</b>\n"
        f"  ✏️ Grammatical Range: <b>{grammar}</b>\n"
        f"  🔊 Pronunciation: <b>{pronunciation}</b>\n"
        f"\n🏆 <b>Overall Band: {overall}</b>"
    )

    try:
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            reply_markup=session_result_keyboard(session_id),
        )
    except Exception as e:
        logger.error(f"Failed to send session result to {telegram_id}: {e}")


async def send_weekly_report(
    telegram_id: int,
    total_sessions: int,
    total_minutes: int,
    avg_band: float,
    improvement: str,
):
    """Send weekly progress report."""
    bot = get_bot()

    text = (
        "📅 <b>Haftalik hisobot</b>\n\n"
        f"📚 Sessiyalar: <b>{total_sessions}</b>\n"
        f"⏱ Mashq vaqti: <b>{total_minutes} daqiqa</b>\n"
        f"🎯 O'rtacha band: <b>{avg_band}</b>\n"
        f"📈 Trend: <b>{improvement}</b>\n\n"
        "Mashq qilishni davom eting! 💪"
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send weekly report to {telegram_id}: {e}")


async def send_reminder(telegram_id: int, message: Optional[str] = None):
    """Send a practice reminder."""
    bot = get_bot()
    text = message or (
        "🔔 <b>Eslatma!</b>\n\n"
        "Bugun hali mashq qilmadingiz. "
        "Har kuni 15 daqiqa mashq — katta natija beradi! 🎯"
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send reminder to {telegram_id}: {e}")
