"""
SpeakMate AI - Telegram Keyboard Builders
"""
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton,
)

from app.core.config import settings


def get_webapp_url(path: str = "") -> str:
    """Build full Web App URL."""
    base = (settings.TELEGRAM_WEBAPP_URL or "").rstrip("/")
    if path:
        return f"{base}/{path.lstrip('/')}"
    return base


# ---------------------------------------------------------------------------
# Main menu (persistent reply keyboard)
# ---------------------------------------------------------------------------
def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Reply keyboard with the Web App launcher button."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(
                text="Open SpeakMate",
                web_app=WebAppInfo(url=get_webapp_url())
            )],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


# ---------------------------------------------------------------------------
# Inline keyboards
# ---------------------------------------------------------------------------
def start_inline_keyboard() -> InlineKeyboardMarkup:
    """Inline keyboard shown after /start."""
    buttons = [
        [InlineKeyboardButton(
            text="Start Practice",
            web_app=WebAppInfo(url=get_webapp_url("/practice"))
        )],
        [InlineKeyboardButton(
            text="Daily Mission",
            web_app=WebAppInfo(url=get_webapp_url("/coach"))
        )],
        [InlineKeyboardButton(
            text="My Progress",
            web_app=WebAppInfo(url=get_webapp_url("/history"))
        )],
        [InlineKeyboardButton(
            text="Profile",
            web_app=WebAppInfo(url=get_webapp_url("/profile"))
        )],
        [InlineKeyboardButton(
            text="Help",
            callback_data="help"
        )],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def practice_mode_keyboard() -> InlineKeyboardMarkup:
    """Select practice mode."""
    buttons = [
        [InlineKeyboardButton(
            text="Free Speaking",
            web_app=WebAppInfo(url=get_webapp_url("/practice?mode=free_speaking"))
        )],
        [InlineKeyboardButton(
            text="IELTS Mock Test",
            web_app=WebAppInfo(url=get_webapp_url("/practice?mode=ielts_test"))
        )],
        [InlineKeyboardButton(
            text="Training",
            web_app=WebAppInfo(url=get_webapp_url("/practice?mode=training"))
        )],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def session_result_keyboard(session_id: str) -> InlineKeyboardMarkup:
    """View detailed results for a session."""
    buttons = [
        [InlineKeyboardButton(
            text="View Details",
            web_app=WebAppInfo(url=get_webapp_url(f"/results/{session_id}"))
        )],
        [InlineKeyboardButton(
            text="Practice Again",
            web_app=WebAppInfo(url=get_webapp_url("/practice"))
        )],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
