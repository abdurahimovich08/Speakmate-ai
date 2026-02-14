"""
SpeakMate AI - Gamification Routes (Streak, XP, Levels, Achievements, Daily Mission)

Principles:
- Streak: soft (1 grace day/week, comeback reward)
- XP: quality > quantity (diminishing returns after 10min)
- Achievements: realistic (no "0 errors")
- Timezone: user-local dates via X-Timezone header
"""
from fastapi import APIRouter, Depends, Request
from datetime import datetime, date, timedelta, timezone as tz
from typing import List, Dict, Any, Optional
import logging

from app.core.security import get_current_user
from app.db.supabase import db_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gamification", tags=["gamification"])

# =====================================================================
# Level definitions
# =====================================================================
LEVELS = [
    {"level": 1, "xp": 0, "name": "First Words"},
    {"level": 2, "xp": 100, "name": "Getting Started"},
    {"level": 3, "xp": 300, "name": "Finding Voice"},
    {"level": 4, "xp": 600, "name": "Building Confidence"},
    {"level": 5, "xp": 1000, "name": "Confident Speaker"},
    {"level": 6, "xp": 1500, "name": "Articulate"},
    {"level": 7, "xp": 2200, "name": "Fluent Mind"},
    {"level": 8, "xp": 3000, "name": "Near Native"},
    {"level": 9, "xp": 4000, "name": "Expert Speaker"},
    {"level": 10, "xp": 5500, "name": "Master"},
]

# =====================================================================
# Achievement definitions (realistic, motivating)
# =====================================================================
ACHIEVEMENTS = [
    # Habit achievements
    {"id": "first_steps", "title": "Birinchi qadam", "description": "Birinchi sessiyani yakunlang", "icon": "\U0001f476", "type": "habit"},
    {"id": "week_warrior", "title": "Hafta jangchisi", "description": "7 kunlik streak", "icon": "\u2694\ufe0f", "type": "habit"},
    {"id": "century", "title": "Yuztalik", "description": "100 ta sessiya", "icon": "\U0001f4af", "type": "habit"},
    {"id": "comeback_king", "title": "Qaytish qiroli", "description": "Uzilishdan so'ng qaytib keldi", "icon": "\U0001f451", "type": "habit"},
    {"id": "marathon", "title": "Marafon", "description": "30 kunlik streak", "icon": "\U0001f3c5", "type": "habit"},
    # Skill achievements
    {"id": "band_breaker", "title": "Band buzar", "description": "Band ni 1.0+ ga oshiring", "icon": "\U0001f4c8", "type": "skill"},
    {"id": "error_reducer", "title": "Xato kamaytiruvchi", "description": "3 sessiya ketma-ket kamroq xato", "icon": "\U0001f4aa", "type": "skill"},
    {"id": "improvement_streak", "title": "O'sish yo'lida", "description": "3 sessiyada criterion o'sdi", "icon": "\U0001f31f", "type": "skill"},
    {"id": "grammar_king", "title": "Grammatika qiroli", "description": "Grammar 7.0+", "icon": "\U0001f451", "type": "skill"},
    {"id": "vocab_master", "title": "So'z ustasi", "description": "Lexical 7.0+", "icon": "\U0001f4da", "type": "skill"},
    {"id": "speed_talker", "title": "Tez gapiruvchi", "description": "150+ WPM, Band 6.0+", "icon": "\u26a1", "type": "skill"},
    {"id": "target_reached", "title": "Maqsadga yetish", "description": "Target band ga yeting", "icon": "\U0001f3af", "type": "skill"},
]

# =====================================================================
# Daily Mission definitions (rotating by day of year)
# =====================================================================
DAILY_MISSIONS = [
    {"focus": "linking_words", "title": "Linking words", "description": "because, although, however ishlatib gapiring", "minutes": 6, "mode": "free_speaking"},
    {"focus": "past_tense", "title": "O'tgan zamon", "description": "O'tgan zamon hikoyasi aytib bering", "minutes": 5, "mode": "free_speaking"},
    {"focus": "vocabulary", "title": "Yangi so'zlar", "description": "Kamida 3 ta yangi so'z ishlatib gapiring", "minutes": 6, "mode": "free_speaking"},
    {"focus": "opinion", "title": "Fikr bildirish", "description": "Mavzu bo'yicha fikringizni asoslang", "minutes": 7, "mode": "free_speaking"},
    {"focus": "comparison", "title": "Taqqoslash", "description": "Ikki narsani taqqoslab gapiring", "minutes": 6, "mode": "free_speaking"},
    {"focus": "future_plans", "title": "Kelajak rejalari", "description": "Kelgusi hafta rejalaringizni aytib bering", "minutes": 5, "mode": "free_speaking"},
    {"focus": "storytelling", "title": "Hikoya aytish", "description": "Qiziqarli voqeani aytib bering", "minutes": 7, "mode": "free_speaking"},
    {"focus": "conditionals", "title": "Shart gaplar", "description": "If I were... turida gapiring", "minutes": 6, "mode": "free_speaking"},
    {"focus": "describe_place", "title": "Joy tasvirlash", "description": "Sevimli joyingizni batafsil tasvirlab bering", "minutes": 6, "mode": "free_speaking"},
    {"focus": "agree_disagree", "title": "Rozi/norozi", "description": "Mavzuga rozi yoki norozilligingizni bildiring", "minutes": 5, "mode": "free_speaking"},
    {"focus": "passive_voice", "title": "Passive voice", "description": "Passive voice ko'proq ishlatib gapiring", "minutes": 6, "mode": "free_speaking"},
    {"focus": "idioms", "title": "Iboralar", "description": "Kamida 2 ta ingliz ibora ishlatib gapiring", "minutes": 7, "mode": "free_speaking"},
    {"focus": "pronunciation", "title": "Talaffuz mashqi", "description": "Sekin va aniq gapiring, har so'zga e'tibor bering", "minutes": 5, "mode": "free_speaking"},
    {"focus": "formal_register", "title": "Rasmiy uslub", "description": "Rasmiy ingliz tilida gapiring", "minutes": 6, "mode": "free_speaking"},
]


# =====================================================================
# Helpers
# =====================================================================

async def _get_user_today(request: Request = None, user_id: str = None) -> date:
    """Get today's date in the user's timezone.
    Priority: X-Timezone header → user profile timezone → UTC+5 fallback."""
    tz_name = None
    if request:
        tz_name = request.headers.get("x-timezone", "").strip()

    # Fallback: read from user profile
    if not tz_name and user_id:
        try:
            profile = await db_service.get_user_profile(user_id)
            tz_name = (profile or {}).get("timezone", "")
        except Exception:
            pass

    if tz_name:
        try:
            from zoneinfo import ZoneInfo
            return datetime.now(ZoneInfo(tz_name)).date()
        except Exception:
            pass

    # Final fallback: UTC+5 (Uzbekistan) as most users are from UZ
    return (datetime.now(tz.utc) + timedelta(hours=5)).date()


def _parse_date(created_at, user_today_tz=None) -> Optional[date]:
    """Parse created_at into a date."""
    if not created_at:
        return None
    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            dt = created_at
        return dt.date()
    except (ValueError, AttributeError):
        return None


def get_level_info(total_xp: int) -> dict:
    """Get current level info based on total XP."""
    current = LEVELS[0]
    for lvl in LEVELS:
        if total_xp >= lvl["xp"]:
            current = lvl
        else:
            break

    idx = LEVELS.index(current)
    if idx < len(LEVELS) - 1:
        next_lvl = LEVELS[idx + 1]
        xp_to_next = next_lvl["xp"] - total_xp
    else:
        xp_to_next = 0

    return {
        "level": current["level"],
        "level_name": current["name"],
        "xp_to_next_level": max(0, xp_to_next),
    }


def calculate_xp(session: dict, prev_bands: Optional[List[float]] = None) -> int:
    """
    Calculate XP with quality > quantity:
    - Lower base (30)
    - Diminishing returns after 10 min
    - Gradual quality bonus (criterion-based where available)
    - Improvement bonus vs median of last 3 sessions, clamped +0.8/day
    """
    xp = 30  # Base XP

    # Duration: 15 XP/min for first 10, then 5 XP/min (cap 30 min)
    minutes = (session.get("duration_seconds") or 0) / 60
    if minutes <= 10:
        xp += int(minutes * 15)
    else:
        xp += 150 + int(min(minutes - 10, 20) * 5)

    # Quality bonus — gradual curve instead of step function
    scores = session.get("overall_scores") or {}
    band = scores.get("overall_band")
    if isinstance(band, (int, float)):
        # Criterion-based bonus where available
        criterion_bonus = 0
        for key in ["fluency_coherence", "lexical_resource", "grammatical_range", "pronunciation"]:
            val = scores.get(key)
            if isinstance(val, dict):
                val = val.get("band", 0)
            if isinstance(val, (int, float)):
                # Gradual: 5 XP per point above 4.0
                criterion_bonus += int(max(0, val - 4.0) * 5)
        if criterion_bonus > 0:
            xp += min(criterion_bonus, 100)  # Cap criterion bonus
        else:
            # Fallback: gradual curve based on overall band
            xp += int(max(0, band - 4.0) * 20)  # 4.0→0, 5.0→20, 6.0→40, 7.0→60, 8.0→80

        # Improvement bonus: vs median of last 3 sessions
        baseline = 0
        if prev_bands and len(prev_bands) > 0:
            sorted_bands = sorted(prev_bands)
            mid = len(sorted_bands) // 2
            if len(sorted_bands) % 2 == 0 and len(sorted_bands) >= 2:
                baseline = (sorted_bands[mid - 1] + sorted_bands[mid]) / 2
            else:
                baseline = sorted_bands[mid]

        if baseline > 0 and band > baseline:
            improvement = min(band - baseline, 0.8)  # Clamp +0.8 max per session
            xp += int(improvement * 50)  # 0.5 up = 25 XP

    return min(xp, 500)  # Cap per session


def compute_streak(sessions: List[dict], today: date = None) -> dict:
    """
    Explicit, simple streak model:
    - current_streak: consecutive practice days (counting today if done)
    - streak_freeze_available: 1 per 7-day window (weekly reset on Mondays)
    - If 2-day gap → consume freeze if available → streak preserved
    - If 2-day gap and no freeze → streak resets, but check comeback
    - Comeback = returning after 3+ day break (reward user!)
    - Warning: based on local date: "Bugun hali qilinmadi" + freeze info
    """
    if today is None:
        today = date.today()

    if not sessions:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "today_completed": False,
            "last_session_hours_ago": None,
            "freeze_available": True,
            "is_comeback": False,
            "streak_warning": None,
        }

    # Get unique practice dates
    practice_dates = set()
    for s in sessions:
        d = _parse_date(s.get("created_at"))
        if d:
            practice_dates.add(d)

    if not practice_dates:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "today_completed": False,
            "last_session_hours_ago": None,
            "freeze_available": True,
            "is_comeback": False,
            "streak_warning": None,
        }

    sorted_dates = sorted(practice_dates, reverse=True)
    today_completed = today in practice_dates

    # Calculate hours since last session
    last_session_hours_ago = None
    last_created = sessions[0].get("created_at")
    if last_created:
        try:
            if isinstance(last_created, str):
                last_dt = datetime.fromisoformat(last_created.replace("Z", "+00:00"))
            else:
                last_dt = last_created
            last_session_hours_ago = round(
                (datetime.now(last_dt.tzinfo) - last_dt).total_seconds() / 3600, 1
            )
        except (ValueError, AttributeError):
            pass

    # ---- Freeze availability: 1 per calendar week (Mon-Sun) ----
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_dates = [d for d in sorted_dates if week_start <= d <= today]
    # Freeze is available if no gap in this week was already "forgiven"
    freeze_used_this_week = False
    prev_wd = None
    for wd in sorted(week_dates):
        if prev_wd and (wd - prev_wd).days > 1:
            freeze_used_this_week = True
            break
        prev_wd = wd

    freeze_available = not freeze_used_this_week

    # ---- Current streak ----
    current_streak = 0
    freeze_consumed = False
    check_date = today if today_completed else today - timedelta(days=1)

    for d in sorted_dates:
        if d == check_date:
            current_streak += 1
            check_date -= timedelta(days=1)
        elif d == check_date - timedelta(days=1) and not freeze_consumed and freeze_available:
            # 2-day gap — consume freeze
            freeze_consumed = True
            check_date -= timedelta(days=1)
            if d == check_date:
                current_streak += 1
                check_date -= timedelta(days=1)
        elif d < check_date:
            break

    if freeze_consumed:
        freeze_available = False

    # ---- Longest streak (with grace) ----
    longest_streak = 0
    streak_count = 0
    grace_count = 0
    prev = None
    for d in sorted(practice_dates):
        if prev is None:
            streak_count = 1
        elif (d - prev).days == 1:
            streak_count += 1
        elif (d - prev).days == 2 and grace_count < 1:
            grace_count += 1
            streak_count += 1
        else:
            streak_count = 1
            grace_count = 0
        longest_streak = max(longest_streak, streak_count)
        prev = d

    # ---- Comeback detection ----
    is_comeback = False
    if today_completed and len(sorted_dates) >= 2:
        prev_date = sorted_dates[1] if sorted_dates[0] == today else sorted_dates[0]
        gap = (today - prev_date).days
        if gap >= 3:
            is_comeback = True

    # ---- Local-date warning ----
    streak_warning = None
    if not today_completed and current_streak > 0:
        if freeze_available:
            streak_warning = "Bugun hali qilinmadi. Freeze bor — 5 min yetadi!"
        else:
            streak_warning = "Bugun hali qilinmadi — streakni yo'qotmang!"

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "today_completed": today_completed,
        "last_session_hours_ago": last_session_hours_ago,
        "freeze_available": freeze_available,
        "is_comeback": is_comeback,
        "streak_warning": streak_warning,
    }


def check_achievements(sessions: List[dict], profile: dict) -> List[dict]:
    """Check which achievements have been earned."""
    earned = []
    total = len(sessions)

    if total == 0:
        return earned

    def _earn(achievement_id: str, **extra):
        if any(a["id"] == achievement_id for a in earned):
            return
        ach = next((a for a in ACHIEVEMENTS if a["id"] == achievement_id), None)
        if ach:
            earned.append({**ach, "earned": True, **extra})

    # first_steps: 1+ sessions
    if total >= 1:
        _earn("first_steps", earned_at=sessions[-1].get("created_at"))

    # century: 100 sessions
    if total >= 100:
        _earn("century")

    # Collect bands and error counts for analysis
    bands = []
    error_counts = []
    for s in sessions:
        scores = s.get("overall_scores") or {}
        band = scores.get("overall_band")
        if isinstance(band, (int, float)):
            bands.append(band)

        # Grammar/vocab score checks
        gr = scores.get("grammatical_range")
        lr = scores.get("lexical_resource")
        if isinstance(gr, (int, float)) and gr >= 7.0:
            _earn("grammar_king")
        elif isinstance(gr, dict) and isinstance(gr.get("band"), (int, float)) and gr["band"] >= 7.0:
            _earn("grammar_king")
        if isinstance(lr, (int, float)) and lr >= 7.0:
            _earn("vocab_master")
        elif isinstance(lr, dict) and isinstance(lr.get("band"), (int, float)) and lr["band"] >= 7.0:
            _earn("vocab_master")

        # Target reached
        target = profile.get("target_band", 7.0)
        if isinstance(band, (int, float)) and isinstance(target, (int, float)) and band >= target:
            _earn("target_reached")

        # Error count tracking
        err_count = s.get("error_count")
        if err_count is None:
            err_data = (scores.get("errors") or [])
            err_count = len(err_data) if isinstance(err_data, list) else 0
        error_counts.append(err_count)

    # band_breaker: improvement of 1.0+
    if len(bands) >= 2:
        first_band = bands[-1]  # oldest
        best_band = max(bands)
        if best_band - first_band >= 1.0:
            _earn("band_breaker")

    # error_reducer: 3 consecutive sessions with decreasing errors
    if len(error_counts) >= 3:
        # Recent 3 sessions (newest first)
        recent = error_counts[:3]
        if recent[0] < recent[1] < recent[2]:
            _earn("error_reducer")

    # improvement_streak: 3 consecutive sessions where a criterion improved
    if len(bands) >= 3:
        recent_bands = bands[:3]
        if recent_bands[0] > recent_bands[1] > recent_bands[2]:
            _earn("improvement_streak")

    # speed_talker: check WPM
    for s in sessions:
        scores = s.get("overall_scores") or {}
        fluency = scores.get("fluency_coherence")
        if isinstance(fluency, dict):
            wpm = fluency.get("wpm") or fluency.get("speaking_rate") or 0
            band = scores.get("overall_band", 0)
            if isinstance(wpm, (int, float)) and wpm >= 150 and isinstance(band, (int, float)) and band >= 6.0:
                _earn("speed_talker")
                break

    return earned


def _mission_matches_weakness(mission: dict, weakness_category: str) -> bool:
    """Check if a mission's focus area matches the user's top weakness."""
    focus = (mission.get("focus") or "").lower()
    cat = weakness_category.lower()
    mapping = {
        "grammar": ["past_tense", "conditionals", "passive_voice", "formal_register"],
        "vocabulary": ["vocabulary", "idioms", "linking_words"],
        "pronunciation": ["pronunciation"],
        "fluency": ["storytelling", "opinion", "comparison", "agree_disagree", "describe_place", "future_plans"],
    }
    return focus in mapping.get(cat, [])


def _is_today(created_at, today: date = None) -> bool:
    """Check if a datetime is today."""
    today = today or date.today()
    d = _parse_date(created_at)
    return d == today if d else False


# =====================================================================
# Routes
# =====================================================================

@router.get("/streak")
async def get_streak(request: Request, current_user: dict = Depends(get_current_user)):
    """Get user's streak, XP, level, and achievements data."""
    user_id = current_user["user_id"]
    today = await _get_user_today(request, user_id)

    # Persist timezone from header if provided (one-time sync)
    tz_header = request.headers.get("x-timezone", "").strip()
    if tz_header:
        try:
            profile = await db_service.get_user_profile(user_id)
            if profile and profile.get("timezone") != tz_header:
                await db_service.update_user_profile(user_id, {"timezone": tz_header})
        except Exception:
            pass

    sessions = await db_service.get_user_sessions(user_id, limit=500)
    profile = await db_service.get_user_profile(user_id) or {}

    streak_data = compute_streak(sessions, today)

    # Compute total XP with quality formula (median-of-3 baseline)
    recent_bands: List[float] = []
    total_xp = 0
    for s in reversed(sessions):  # oldest first
        xp = calculate_xp(s, recent_bands[-3:] if recent_bands else None)
        total_xp += xp
        scores = s.get("overall_scores") or {}
        band = scores.get("overall_band")
        if isinstance(band, (int, float)):
            recent_bands.append(band)

    xp_today = sum(
        calculate_xp(s)
        for s in sessions
        if _is_today(s.get("created_at"), today)
    )

    # Comeback XP bonus
    if streak_data["is_comeback"]:
        total_xp += 30  # Comeback bonus

    level_info = get_level_info(total_xp)

    # Check achievements
    achievements = check_achievements(sessions, profile)

    # Streak-based achievements
    if streak_data["current_streak"] >= 7 or streak_data["longest_streak"] >= 7:
        if not any(a["id"] == "week_warrior" for a in achievements):
            ach = next((a for a in ACHIEVEMENTS if a["id"] == "week_warrior"), {})
            achievements.append({**ach, "earned": True})

    if streak_data["current_streak"] >= 30 or streak_data["longest_streak"] >= 30:
        if not any(a["id"] == "marathon" for a in achievements):
            ach = next((a for a in ACHIEVEMENTS if a["id"] == "marathon"), {})
            achievements.append({**ach, "earned": True})

    # Comeback achievement
    if streak_data["is_comeback"]:
        if not any(a["id"] == "comeback_king" for a in achievements):
            ach = next((a for a in ACHIEVEMENTS if a["id"] == "comeback_king"), {})
            achievements.append({**ach, "earned": True})

    return {
        **streak_data,
        "xp_today": xp_today,
        "total_xp": total_xp,
        **level_info,
        "achievements": achievements,
    }


@router.get("/daily-mission")
async def get_daily_mission(request: Request, current_user: dict = Depends(get_current_user)):
    """Get today's daily mission — personalized via hash(user_id + date).
    30% chance to pick a weakness-based mission from error fingerprint."""
    user_id = current_user["user_id"]
    today = await _get_user_today(request, user_id)

    import hashlib
    # Per-user rotation seed
    seed = int(hashlib.sha256(f"{user_id}:{today.isoformat()}".encode()).hexdigest(), 16)

    # 30% chance: weakness-based mission
    mission_template = None
    if seed % 10 < 3:  # 30% probability
        try:
            error_profile = await db_service.get_user_error_profile(user_id)
            if error_profile:
                top_category = (error_profile[0].get("category") or "").lower()
                # Find a mission matching the top weakness
                matching = [m for m in DAILY_MISSIONS if _mission_matches_weakness(m, top_category)]
                if matching:
                    mission_template = matching[seed % len(matching)]
        except Exception:
            pass

    if mission_template is None:
        day_index = seed % len(DAILY_MISSIONS)
        mission_template = DAILY_MISSIONS[day_index]

    # Check if user already completed today
    sessions = await db_service.get_user_sessions(user_id, limit=10)
    today_sessions = [s for s in sessions if _is_today(s.get("created_at"), today)]
    completed = len(today_sessions) > 0

    mission = {
        "id": f"mission_{today.isoformat()}",
        "title": mission_template["title"],
        "description": mission_template["description"],
        "focus": mission_template["focus"],
        "minutes": mission_template["minutes"],
        "mode": mission_template["mode"],
        "xp_bonus": 40,
        "completed": completed,
    }

    return {"mission": mission, "completed": completed}


@router.get("/history")
async def get_session_history(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """Get session history for charts and activity calendar."""
    user_id = current_user["user_id"]
    sessions = await db_service.get_user_sessions(user_id, limit=200)

    cutoff = datetime.now() - timedelta(days=days)

    history = []
    activity_map: Dict[str, int] = {}

    recent_bands_hist: List[float] = []
    for s in reversed(sessions):  # oldest first for XP calc
        created = s.get("created_at")
        if not created:
            continue

        try:
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created

            if dt.replace(tzinfo=None) < cutoff:
                scores = s.get("overall_scores") or {}
                band = scores.get("overall_band")
                if isinstance(band, (int, float)):
                    recent_bands_hist.append(band)
                continue

            date_key = dt.date().isoformat()
            activity_map[date_key] = activity_map.get(date_key, 0) + 1

            scores = s.get("overall_scores") or {}
            band = scores.get("overall_band")

            history.append({
                "id": s.get("id"),
                "date": date_key,
                "band": band,
                "mode": s.get("mode"),
                "duration_seconds": s.get("duration_seconds", 0),
                "xp": calculate_xp(s, recent_bands_hist[-3:] if recent_bands_hist else None),
            })

            if isinstance(band, (int, float)):
                recent_bands_hist.append(band)
        except (ValueError, AttributeError):
            pass

    # Reverse back to newest first
    history.reverse()

    return {
        "sessions": history,
        "activity_map": activity_map,
    }


@router.get("/next-tip")
async def get_next_time_tip(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Generate a single actionable 'Next time do this' tip based on the user's
    most recent session weaknesses. Links to tomorrow's mission focus.
    """
    user_id = current_user["user_id"]
    sessions = await db_service.get_user_sessions(user_id, limit=5)

    if not sessions:
        return {"tip": "Birinchi sessiyangizni boshlang!", "focus": None}

    last = sessions[0]
    scores = last.get("overall_scores") or {}

    # Find the weakest criterion
    criteria = {
        "fluency_coherence": "Linking words (because, although, however) ko'proq ishlating",
        "lexical_resource": "Har sessiyada kamida 2 ta yangi so'z ishlating",
        "grammatical_range": "Murakkab gaplar (compound sentences) ko'proq quring",
        "pronunciation": "Sekin gapiring va har so'zga diqqat bering",
    }
    weakest_key = None
    weakest_score = 10.0
    for key in criteria:
        val = scores.get(key)
        if isinstance(val, dict):
            val = val.get("band", 10)
        if isinstance(val, (int, float)) and val < weakest_score:
            weakest_score = val
            weakest_key = key

    if weakest_key:
        tip = criteria[weakest_key]
        focus = weakest_key
    else:
        # Fallback: generic tip
        tip = "Har sessiyada bitta yangi narsa sinab ko'ring"
        focus = None

    # Try to connect tip to tomorrow's mission
    today = await _get_user_today(request, user_id)
    import hashlib
    tomorrow = today + timedelta(days=1)
    seed = int(hashlib.sha256(f"{user_id}:{tomorrow.isoformat()}".encode()).hexdigest(), 16)
    mission_idx = seed % len(DAILY_MISSIONS)
    tomorrow_mission = DAILY_MISSIONS[mission_idx]

    return {
        "tip": tip,
        "focus": focus,
        "tomorrow_mission": {
            "title": tomorrow_mission["title"],
            "description": tomorrow_mission["description"],
        },
    }


@router.get("/achievements")
async def get_achievements(current_user: dict = Depends(get_current_user)):
    """Get all achievements with earned status."""
    user_id = current_user["user_id"]
    sessions = await db_service.get_user_sessions(user_id, limit=500)
    profile = await db_service.get_user_profile(user_id) or {}

    earned = check_achievements(sessions, profile)
    earned_ids = {a["id"] for a in earned}

    all_achievements = []
    for a in ACHIEVEMENTS:
        if a["id"] in earned_ids:
            matching = next(e for e in earned if e["id"] == a["id"])
            all_achievements.append(matching)
        else:
            all_achievements.append({**a, "earned": False})

    return all_achievements
