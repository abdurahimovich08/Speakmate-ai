"""
SpeakMate AI - Telegram Bot Notifications

Send proactive messages to users:
- session results
- daily mission reminders
- streak milestones
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.db.supabase import db_service
from app.services.coach_engine import coach_engine
from app.telegram.bot import get_bot
from app.telegram.keyboards import session_result_keyboard

logger = logging.getLogger(__name__)


def _parse_dt(value: object) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


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
        "<b>Sessiya yakunlandi</b>\n\n"
        f"Duration: <b>{minutes} min</b>\n"
        f"Errors: <b>{error_count}</b>\n\n"
        "<b>IELTS Scores</b>\n"
        f"Fluency & Coherence: <b>{fluency}</b>\n"
        f"Lexical Resource: <b>{lexical}</b>\n"
        f"Grammatical Range: <b>{grammar}</b>\n"
        f"Pronunciation: <b>{pronunciation}</b>\n"
        f"\nOverall Band: <b>{overall}</b>"
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
        "<b>Haftalik hisobot</b>\n\n"
        f"Sessiyalar: <b>{total_sessions}</b>\n"
        f"Mashq vaqti: <b>{total_minutes} daqiqa</b>\n"
        f"O'rtacha band: <b>{avg_band}</b>\n"
        f"Trend: <b>{improvement}</b>\n\n"
        "Mashqni davom ettiring."
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send weekly report to {telegram_id}: {e}")


async def send_reminder(telegram_id: int, message: Optional[str] = None):
    """Send a generic reminder."""
    bot = get_bot()
    text = message or (
        "<b>Eslatma</b>\n\n"
        "Bugun hali mashq qilmadingiz. "
        "Har kuni 15 daqiqa mashq katta natija beradi."
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send reminder to {telegram_id}: {e}")


async def send_daily_mission_reminder(
    telegram_id: int,
    mission: dict,
    streak_days: Optional[int] = None,
):
    """Send a daily mission reminder with adaptive best-time hint."""
    bot = get_bot()
    tasks = mission.get("tasks", [])
    best_window = (mission.get("best_time_to_practice") or {}).get("window", "18:00-20:00")

    task_lines = []
    for task in tasks:
        task_lines.append(
            f"- <b>{task.get('title')}</b> ({task.get('duration_min', 0)} min): {task.get('instruction', '')}"
        )

    streak_text = f"\nCurrent streak: <b>{streak_days} days</b>\n" if streak_days else "\n"
    text = (
        "<b>Today's Super Coach Mission</b>\n\n"
        f"Best time: <b>{best_window}</b>\n"
        f"Difficulty: <b>{str(mission.get('difficulty', 'balanced')).title()}</b>\n"
        f"{streak_text}\n"
        + "\n".join(task_lines)
        + "\n\nOpen app and complete all 3 blocks."
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send daily mission reminder to {telegram_id}: {e}")


async def send_streak_milestone(
    telegram_id: int,
    streak_days: int,
    longest_streak_days: Optional[int] = None,
):
    """Send streak milestone notification."""
    bot = get_bot()
    longest = longest_streak_days or streak_days

    text = (
        "<b>Streak milestone reached</b>\n\n"
        f"You are on a <b>{streak_days}-day</b> speaking streak.\n"
        f"Best streak so far: <b>{longest} days</b>\n\n"
        "Keep momentum and do today's mission."
    )

    try:
        await bot.send_message(chat_id=telegram_id, text=text)
    except Exception as e:
        logger.error(f"Failed to send streak milestone to {telegram_id}: {e}")


async def run_daily_mission_reminders_batch(limit: int = 200, force: bool = False) -> dict:
    """Send daily mission reminders to Telegram users who are inactive today."""
    today = datetime.now(timezone.utc).date().isoformat()
    users = await db_service.list_telegram_users(limit=limit)

    sent = 0
    skipped = 0

    for user in users:
        telegram_id = user.get("telegram_id")
        user_id = user.get("id")
        if not telegram_id or not user_id:
            skipped += 1
            continue

        last_practice = _parse_dt(user.get("last_practice_at"))
        if not force and last_practice and last_practice.date().isoformat() == today:
            skipped += 1
            continue

        already_sent = await db_service.get_notification_event(
            user_id=user_id,
            event_type="daily_mission_reminder",
            event_date=today,
        )
        if already_sent and not force:
            skipped += 1
            continue

        profile = await db_service.get_user_profile(user_id)
        if not profile:
            skipped += 1
            continue

        preferences = profile.get("preferences") if isinstance(profile.get("preferences"), dict) else {}
        sessions = await db_service.get_user_sessions(user_id, limit=80)
        error_profiles = await db_service.get_user_error_profile(user_id)
        mission = coach_engine.build_daily_mission(profile, sessions, error_profiles, preferences)

        await send_daily_mission_reminder(
            telegram_id=int(telegram_id),
            mission=mission,
            streak_days=int(profile.get("current_streak_days") or 0),
        )

        await db_service.upsert_notification_event(
            user_id=user_id,
            telegram_id=int(telegram_id),
            event_type="daily_mission_reminder",
            event_date=today,
            payload={
                "mission_id": mission.get("mission_id"),
                "best_window": (mission.get("best_time_to_practice") or {}).get("window"),
            },
        )
        sent += 1

    return {"sent": sent, "skipped": skipped, "users_scanned": len(users)}


async def run_streak_notifications_batch(limit: int = 200, force: bool = False) -> dict:
    """Send streak milestone notifications to Telegram users."""
    today = datetime.now(timezone.utc).date().isoformat()
    users = await db_service.list_telegram_users(limit=limit)
    milestones = {3, 7, 14, 21, 30, 50, 100}

    sent = 0
    skipped = 0

    for user in users:
        telegram_id = user.get("telegram_id")
        user_id = user.get("id")
        if not telegram_id or not user_id:
            skipped += 1
            continue

        streak_days = int(user.get("current_streak_days") or 0)
        if streak_days <= 0:
            skipped += 1
            continue

        if streak_days not in milestones and not force:
            skipped += 1
            continue

        event_type = "streak_milestone"
        already_sent = await db_service.get_notification_event(
            user_id=user_id,
            event_type=event_type,
            event_date=today,
        )
        if already_sent and not force:
            skipped += 1
            continue

        await send_streak_milestone(
            telegram_id=int(telegram_id),
            streak_days=streak_days,
            longest_streak_days=int(user.get("longest_streak_days") or streak_days),
        )
        await db_service.upsert_notification_event(
            user_id=user_id,
            telegram_id=int(telegram_id),
            event_type=event_type,
            event_date=today,
            payload={"streak_days": streak_days},
        )
        sent += 1

    return {"sent": sent, "skipped": skipped, "users_scanned": len(users)}
