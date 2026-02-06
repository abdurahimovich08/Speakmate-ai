"""
SpeakMate AI - Telegram Bot Handlers
"""
import logging
from aiogram import Router, F
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, CallbackQuery

from app.db.supabase import db_service
from app.telegram.keyboards import (
    main_menu_keyboard,
    start_inline_keyboard,
    practice_mode_keyboard,
)

logger = logging.getLogger(__name__)
router = Router(name="main_handlers")


# ---------------------------------------------------------------------------
# /start
# ---------------------------------------------------------------------------
@router.message(CommandStart())
async def cmd_start(message: Message):
    """Handle /start command — register user & show main menu."""
    tg_user = message.from_user
    telegram_id = tg_user.id
    full_name = tg_user.full_name or "User"

    # Check if user exists in DB
    user = await _get_or_create_telegram_user(
        telegram_id=telegram_id,
        full_name=full_name,
        username=tg_user.username,
    )

    welcome = (
        f"👋 <b>Xush kelibsiz, {full_name}!</b>\n\n"
        "🎙 <b>SpeakMate AI</b> — IELTS Speaking mashq qilish uchun AI coach.\n\n"
        "🔹 Real-time suhbat\n"
        "🔹 Xatolarni aniqlash\n"
        "🔹 IELTS baholash (0-9 band)\n"
        "🔹 Shaxsiy mashg'ulot rejasi\n\n"
        "Pastdagi tugmalardan birini bosing yoki <b>🎙 Open SpeakMate</b> "
        "tugmasini bosib ilovani oching!"
    )

    # Send welcome with inline keyboard
    await message.answer(welcome, reply_markup=start_inline_keyboard())
    # Set persistent reply keyboard
    await message.answer(
        "⬇️ Mini App'ni pastdagi tugma orqali oching:",
        reply_markup=main_menu_keyboard(),
    )


# ---------------------------------------------------------------------------
# /help
# ---------------------------------------------------------------------------
@router.message(Command("help"))
async def cmd_help(message: Message):
    """Handle /help command."""
    help_text = (
        "📖 <b>SpeakMate AI — Yordam</b>\n\n"
        "<b>Buyruqlar:</b>\n"
        "/start — Boshlash\n"
        "/help — Yordam\n"
        "/stats — Statistika\n"
        "/practice — Mashq boshlash\n"
        "/settings — Sozlamalar\n\n"
        "<b>Qanday ishlaydi?</b>\n"
        "1. 🎙 Open SpeakMate tugmasini bosing\n"
        "2. Mashq turini tanlang (Free / IELTS / Training)\n"
        "3. Mavzuni tanlang va gaplashing!\n"
        "4. AI sizning xatolaringizni topadi va ball beradi\n\n"
        "<b>Mashq turlari:</b>\n"
        "💬 <b>Free Speaking</b> — erkin suhbat\n"
        "📝 <b>IELTS Mock Test</b> — haqiqiy test simulyatsiyasi\n"
        "🏋️ <b>Training</b> — xatolaringiz bo'yicha mashqlar"
    )
    await message.answer(help_text)


# ---------------------------------------------------------------------------
# /stats
# ---------------------------------------------------------------------------
@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Handle /stats command — show quick stats."""
    telegram_id = message.from_user.id
    user = await _find_user_by_telegram_id(telegram_id)

    if not user:
        await message.answer("❌ Avval /start buyrug'ini bering.")
        return

    user_id = user["id"]
    sessions = await db_service.get_user_sessions(user_id, limit=100)

    total = len(sessions)
    total_min = sum(s.get("duration_seconds", 0) for s in sessions) // 60

    # Average band
    bands = []
    for s in sessions:
        sc = s.get("overall_scores")
        if sc and sc.get("overall_band"):
            bands.append(sc["overall_band"])
    avg_band = round(sum(bands) / len(bands), 1) if bands else 0

    last_band = bands[0] if bands else "—"

    text = (
        "📊 <b>Sizning statistikangiz</b>\n\n"
        f"📚 Jami sessiyalar: <b>{total}</b>\n"
        f"⏱ Jami mashq vaqti: <b>{total_min} daqiqa</b>\n"
        f"🎯 O'rtacha band: <b>{avg_band}</b>\n"
        f"📈 Oxirgi band: <b>{last_band}</b>\n"
    )
    await message.answer(text)


# ---------------------------------------------------------------------------
# /practice
# ---------------------------------------------------------------------------
@router.message(Command("practice"))
async def cmd_practice(message: Message):
    """Handle /practice — show mode selector."""
    await message.answer(
        "🎙 <b>Mashq turini tanlang:</b>",
        reply_markup=practice_mode_keyboard(),
    )


# ---------------------------------------------------------------------------
# /settings
# ---------------------------------------------------------------------------
@router.message(Command("settings"))
async def cmd_settings(message: Message):
    """Handle /settings command."""
    telegram_id = message.from_user.id
    user = await _find_user_by_telegram_id(telegram_id)

    if not user:
        await message.answer("❌ Avval /start buyrug'ini bering.")
        return

    target_band = user.get("target_band", 7.0)
    native_lang = user.get("native_language", "uz")

    text = (
        "⚙️ <b>Sozlamalar</b>\n\n"
        f"🎯 Maqsad band: <b>{target_band}</b>\n"
        f"🌐 Ona tili: <b>{native_lang}</b>\n\n"
        "Sozlamalarni Web App ichida o'zgartiring."
    )
    await message.answer(text)


# ---------------------------------------------------------------------------
# Callback: help
# ---------------------------------------------------------------------------
@router.callback_query(F.data == "help")
async def callback_help(callback: CallbackQuery):
    """Inline help button callback."""
    await callback.answer()
    await cmd_help(callback.message)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _find_user_by_telegram_id(telegram_id: int) -> dict | None:
    """Find user by Telegram ID."""
    try:
        response = (
            db_service.client.table("users")
            .select("*")
            .eq("telegram_id", telegram_id)
            .single()
            .execute()
        )
        return response.data if response.data else None
    except Exception:
        return None


async def _get_or_create_telegram_user(
    telegram_id: int,
    full_name: str,
    username: str | None = None,
) -> dict:
    """Get existing user or create a new one for this Telegram account."""
    existing = await _find_user_by_telegram_id(telegram_id)
    if existing:
        return existing

    # Create new user
    import uuid

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
        logger.error(f"Failed to create Telegram user: {e}")
        return user_data
