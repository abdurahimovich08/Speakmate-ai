"""
SpeakMate AI - Telegram Coach Commands
"""
from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

from app.db.supabase import db_service
from app.services.coach_engine import coach_engine
from app.telegram.keyboards import get_webapp_url

router = Router(name="coach_handlers")


def _coach_open_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Open Super Coach",
                    web_app=WebAppInfo(url=get_webapp_url("/coach")),
                )
            ]
        ]
    )


@router.message(Command("mission"))
async def cmd_mission(message: Message):
    """Show today's adaptive mission summary."""
    tg = message.from_user
    if not tg:
        return

    user = await db_service.get_user_by_telegram_id(tg.id)
    if not user:
        await message.answer("Run /start first, then try /mission.")
        return

    sessions = await db_service.get_user_sessions(user["id"], limit=60)
    errors = await db_service.get_user_error_profile(user["id"])
    prefs = user.get("preferences") if isinstance(user.get("preferences"), dict) else {}
    mission = coach_engine.build_daily_mission(user, sessions, errors, prefs)

    tasks = mission.get("tasks", [])
    task_lines = [f"- {t.get('title')} ({t.get('duration_min', 0)}m)" for t in tasks]
    text = (
        "<b>Today's Mission</b>\n\n"
        f"Difficulty: <b>{str(mission.get('difficulty', 'balanced')).title()}</b>\n"
        f"Best time: <b>{(mission.get('best_time_to_practice') or {}).get('window', '18:00-20:00')}</b>\n\n"
        + "\n".join(task_lines)
    )
    await message.answer(text, reply_markup=_coach_open_keyboard())


@router.message(Command("streak"))
async def cmd_streak(message: Message):
    """Show current streak status."""
    tg = message.from_user
    if not tg:
        return

    user = await db_service.get_user_by_telegram_id(tg.id)
    if not user:
        await message.answer("Run /start first, then try /streak.")
        return

    current_streak = int(user.get("current_streak_days") or 0)
    longest_streak = int(user.get("longest_streak_days") or 0)
    last_practice = user.get("last_practice_at") or "N/A"

    text = (
        "<b>Streak Status</b>\n\n"
        f"Current streak: <b>{current_streak} days</b>\n"
        f"Best streak: <b>{longest_streak} days</b>\n"
        f"Last practice: <b>{last_practice}</b>\n\n"
        "Keep your streak alive today."
    )
    await message.answer(text, reply_markup=_coach_open_keyboard())

