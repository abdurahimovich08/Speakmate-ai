"""
SpeakMate AI - Gamification Routes (Streak, XP, Levels, Achievements)
"""
from fastapi import APIRouter, Depends
from datetime import datetime, date, timedelta
from typing import List, Dict, Any

from app.core.security import get_current_user
from app.db.supabase import db_service

router = APIRouter(prefix="/gamification", tags=["gamification"])

# Level definitions
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

# Achievement definitions
ACHIEVEMENTS = [
    {"id": "first_steps", "title": "Birinchi qadam", "description": "Birinchi sessiyani yakunlang", "icon": "👶"},
    {"id": "week_warrior", "title": "Hafta jangchisi", "description": "7 kunlik streak", "icon": "⚔️"},
    {"id": "century", "title": "Yuztalik", "description": "100 ta sessiya", "icon": "💯"},
    {"id": "band_breaker", "title": "Band buzar", "description": "Band ni 1.0+ ga oshiring", "icon": "📈"},
    {"id": "perfectionist", "title": "Mukammalchi", "description": "0 xatoli sessiya", "icon": "✨"},
    {"id": "grammar_king", "title": "Grammatika qiroli", "description": "Grammar 7.0+", "icon": "👑"},
    {"id": "vocab_master", "title": "So'z ustasi", "description": "Lexical 7.0+", "icon": "📚"},
    {"id": "speed_talker", "title": "Tez gapiruvchi", "description": "150+ WPM yaxshi ball bilan", "icon": "⚡"},
    {"id": "marathon", "title": "Marafon", "description": "30 kunlik streak", "icon": "🏅"},
    {"id": "target_reached", "title": "Maqsadga yetish", "description": "Target band ga yeting", "icon": "🎯"},
]


def get_level_info(total_xp: int) -> dict:
    """Get current level info based on total XP."""
    current = LEVELS[0]
    for lvl in LEVELS:
        if total_xp >= lvl["xp"]:
            current = lvl
        else:
            break
    
    # Find next level
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


def calculate_xp(session: dict) -> int:
    """Calculate XP earned from a session."""
    xp = 50  # Base XP per session
    
    # Duration bonus: 20 XP per minute
    minutes = (session.get("duration_seconds") or 0) / 60
    xp += int(min(minutes, 30) * 20)
    
    # Score bonus
    scores = session.get("overall_scores") or {}
    band = scores.get("overall_band")
    if isinstance(band, (int, float)):
        if band >= 7.0:
            xp += 100
        elif band >= 6.0:
            xp += 50
        elif band >= 5.0:
            xp += 25
    
    return xp


def check_achievements(sessions: List[dict], profile: dict) -> List[dict]:
    """Check which achievements have been earned."""
    earned = []
    total = len(sessions)
    
    if total == 0:
        return earned
    
    # first_steps: 1+ sessions
    if total >= 1:
        earned.append({
            **next((a for a in ACHIEVEMENTS if a["id"] == "first_steps"), {}),
            "earned": True,
            "earned_at": sessions[-1].get("created_at"),
        })
    
    # century: 100 sessions
    if total >= 100:
        earned.append({
            **next((a for a in ACHIEVEMENTS if a["id"] == "century"), {}),
            "earned": True,
        })
    
    # Check score-based achievements
    for s in sessions:
        scores = s.get("overall_scores") or {}
        
        # perfectionist: 0 errors
        errors = s.get("error_count", 1)
        if errors == 0:
            if not any(a["id"] == "perfectionist" for a in earned):
                earned.append({
                    **next((a for a in ACHIEVEMENTS if a["id"] == "perfectionist"), {}),
                    "earned": True,
                })
        
        # grammar_king, vocab_master
        fc = scores.get("fluency_coherence", 0)
        lr = scores.get("lexical_resource", 0)
        gr = scores.get("grammatical_range", 0)
        
        if isinstance(gr, (int, float)) and gr >= 7.0:
            if not any(a["id"] == "grammar_king" for a in earned):
                earned.append({
                    **next((a for a in ACHIEVEMENTS if a["id"] == "grammar_king"), {}),
                    "earned": True,
                })
        
        if isinstance(lr, (int, float)) and lr >= 7.0:
            if not any(a["id"] == "vocab_master" for a in earned):
                earned.append({
                    **next((a for a in ACHIEVEMENTS if a["id"] == "vocab_master"), {}),
                    "earned": True,
                })
        
        # target_reached
        target = profile.get("target_band", 7.0)
        band = scores.get("overall_band")
        if isinstance(band, (int, float)) and isinstance(target, (int, float)) and band >= target:
            if not any(a["id"] == "target_reached" for a in earned):
                earned.append({
                    **next((a for a in ACHIEVEMENTS if a["id"] == "target_reached"), {}),
                    "earned": True,
                })
    
    # band_breaker: improvement of 1.0+
    bands = []
    for s in sessions:
        sc = s.get("overall_scores") or {}
        b = sc.get("overall_band")
        if isinstance(b, (int, float)):
            bands.append(b)
    
    if len(bands) >= 2:
        # Compare first and best
        first_band = bands[-1]  # oldest
        best_band = max(bands)
        if best_band - first_band >= 1.0:
            if not any(a["id"] == "band_breaker" for a in earned):
                earned.append({
                    **next((a for a in ACHIEVEMENTS if a["id"] == "band_breaker"), {}),
                    "earned": True,
                })
    
    return earned


def compute_streak(sessions: List[dict]) -> dict:
    """Compute streak data from session dates."""
    if not sessions:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "today_completed": False,
            "last_session_hours_ago": None,
        }
    
    today = date.today()
    
    # Get unique practice dates
    practice_dates = set()
    for s in sessions:
        created = s.get("created_at")
        if created:
            try:
                if isinstance(created, str):
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                else:
                    dt = created
                practice_dates.add(dt.date())
            except (ValueError, AttributeError):
                pass
    
    if not practice_dates:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "today_completed": False,
            "last_session_hours_ago": None,
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
            last_session_hours_ago = round((datetime.now(last_dt.tzinfo) - last_dt).total_seconds() / 3600, 1)
        except (ValueError, AttributeError):
            pass
    
    # Calculate current streak
    current_streak = 0
    check_date = today if today_completed else today - timedelta(days=1)
    
    for d in sorted_dates:
        if d == check_date:
            current_streak += 1
            check_date -= timedelta(days=1)
        elif d < check_date:
            break
    
    # Calculate longest streak
    longest_streak = 0
    streak = 0
    prev = None
    for d in sorted(practice_dates):
        if prev is None or (d - prev).days == 1:
            streak += 1
        else:
            streak = 1
        longest_streak = max(longest_streak, streak)
        prev = d
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "today_completed": today_completed,
        "last_session_hours_ago": last_session_hours_ago,
    }


@router.get("/streak")
async def get_streak(current_user: dict = Depends(get_current_user)):
    """Get user's streak, XP, level, and achievements data."""
    user_id = current_user["user_id"]
    
    # Get all sessions
    sessions = await db_service.get_user_sessions(user_id, limit=500)
    profile = await db_service.get_user_profile(user_id) or {}
    
    # Compute streak
    streak_data = compute_streak(sessions)
    
    # Compute total XP
    total_xp = sum(calculate_xp(s) for s in sessions)
    xp_today = sum(
        calculate_xp(s)
        for s in sessions
        if _is_today(s.get("created_at"))
    )
    
    # Get level info
    level_info = get_level_info(total_xp)
    
    # Check achievements
    achievements = check_achievements(sessions, profile)
    
    # Check streak-based achievements
    if streak_data["current_streak"] >= 7 or streak_data["longest_streak"] >= 7:
        if not any(a["id"] == "week_warrior" for a in achievements):
            achievements.append({
                **next((a for a in ACHIEVEMENTS if a["id"] == "week_warrior"), {}),
                "earned": True,
            })
    
    if streak_data["current_streak"] >= 30 or streak_data["longest_streak"] >= 30:
        if not any(a["id"] == "marathon" for a in achievements):
            achievements.append({
                **next((a for a in ACHIEVEMENTS if a["id"] == "marathon"), {}),
                "earned": True,
            })
    
    return {
        **streak_data,
        "xp_today": xp_today,
        "total_xp": total_xp,
        **level_info,
        "achievements": achievements,
    }


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
    
    for s in sessions:
        created = s.get("created_at")
        if not created:
            continue
        
        try:
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            
            if dt.replace(tzinfo=None) < cutoff:
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
                "xp": calculate_xp(s),
            })
        except (ValueError, AttributeError):
            pass
    
    return {
        "sessions": history,
        "activity_map": activity_map,
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


def _is_today(created_at) -> bool:
    """Check if a datetime is today."""
    if not created_at:
        return False
    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            dt = created_at
        return dt.date() == date.today()
    except (ValueError, AttributeError):
        return False
