"""
SpeakMate AI - Notification Worker

Background jobs for Telegram engagement loops:
- daily mission reminders
- streak milestone notifications
"""
from __future__ import annotations

import asyncio
from typing import Dict

from app.telegram.notifications import (
    run_daily_mission_reminders_batch,
    run_streak_notifications_batch,
)


def _run(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def run_daily_reminders(limit: int = 200, force: bool = False) -> Dict:
    """Entry point for RQ job: daily mission reminders."""
    return _run(run_daily_mission_reminders_batch(limit=limit, force=force))


def run_streak_notifications(limit: int = 200, force: bool = False) -> Dict:
    """Entry point for RQ job: streak notifications."""
    return _run(run_streak_notifications_batch(limit=limit, force=force))

