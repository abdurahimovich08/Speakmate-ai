"""
SpeakMate AI - User Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.models.schemas import UserProfile, UserProfileUpdate, ErrorProfile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=dict)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's profile."""
    profile = await db_service.get_user_profile(current_user["user_id"])
    
    if not profile:
        # Create profile if doesn't exist
        profile = await db_service.create_user_profile(
            current_user["user_id"],
            {
                "email": current_user.get("email"),
                "phone": current_user.get("phone"),
                "native_language": "uz",
                "target_band": 7.0
            }
        )
    
    return profile


@router.put("/me", response_model=dict)
async def update_current_user_profile(
    update_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile."""
    update_dict = update_data.model_dump(exclude_unset=True)
    
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    profile = await db_service.update_user_profile(
        current_user["user_id"],
        update_dict
    )
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    return profile


@router.get("/me/error-profile", response_model=List[dict])
async def get_user_error_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get user's error profile - their common mistakes."""
    error_profile = await db_service.get_user_error_profile(current_user["user_id"])
    return error_profile


@router.get("/me/error-fingerprint", response_model=dict)
async def get_error_fingerprint(
    current_user: dict = Depends(get_current_user)
):
    """Get user's top recurring errors with improvement trend."""
    user_id = current_user["user_id"]
    error_profile = await db_service.get_user_error_profile(user_id)
    sessions = await db_service.get_user_sessions(user_id, limit=20)

    if not error_profile:
        return {"errors": [], "status": "new_user" if len(sessions) < 3 else "no_errors"}

    # For each top error, calculate trend (recent 5 sessions vs older 5)
    result_errors = []
    for err in error_profile[:3]:
        category = err.get("category", "")
        subcategory = err.get("subcategory", "")
        count = err.get("occurrence_count", 0)

        # Check recent sessions for this error type occurrence
        recent_count = 0
        older_count = 0
        sessions_without = 0
        found_in_recent = False

        for i, s in enumerate(sessions):
            s_errors = s.get("detected_errors") or []
            has_error = any(
                e.get("category") == category and e.get("subcategory") == subcategory
                for e in s_errors
            ) if isinstance(s_errors, list) else False

            if i < 5:
                if has_error:
                    recent_count += 1
                    found_in_recent = True
            elif i < 10:
                if has_error:
                    older_count += 1

            if not has_error and not found_in_recent:
                sessions_without += 1
            elif has_error:
                found_in_recent = True

        # Determine trend — graceful for new users (<3 comparison sessions)
        total_compared = min(len(sessions), 10)
        if total_compared < 3:
            trend = "stable"  # Not enough data yet
        elif older_count > 0 and recent_count < older_count:
            trend = "improving"
        elif recent_count > older_count:
            trend = "worsening"
        else:
            trend = "stable"

        # Actionable tip: 1-line "what to do" based on category
        tip = _get_error_tip(category, subcategory)

        result_errors.append({
            "category": category,
            "subcategory": subcategory,
            "count": count,
            "trend": trend,
            "sessions_without": sessions_without,
            "tip": tip,
        })

    return {
        "errors": result_errors,
        "status": "active",
        "total_sessions": len(sessions),
    }


def _get_error_tip(category: str, subcategory: str) -> str:
    """Return 1-line actionable tip for an error type."""
    tips = {
        "grammar": "Bugungi mashqda shu grammatik qoidaga alohida e'tibor bering",
        "vocabulary": "Yangi so'zlarni kontekstda ishlatib ko'ring — bugungi missiyada sinab ko'ring",
        "pronunciation": "Sekin va aniq gapiring, har bo'g'inga e'tibor bering",
        "fluency": "Linking words (because, although, however) ko'proq ishlating",
    }
    return tips.get(category.lower(), "Bugungi mashqda shu xatoga e'tibor bering")


@router.get("/me/stats", response_model=dict)
async def get_user_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get user's learning statistics."""
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=100)
    error_profile = await db_service.get_user_error_profile(current_user["user_id"])
    
    total_sessions = len(sessions)
    total_minutes = sum(s.get("duration_seconds", 0) for s in sessions) // 60
    
    # Calculate average scores if available
    scores_list = [s.get("overall_scores") for s in sessions if s.get("overall_scores")]
    bands = []
    avg_band = 0.0
    if scores_list:
        bands = [s.get("overall_band", 0) for s in scores_list if s.get("overall_band")]
        avg_band = sum(bands) / len(bands) if bands else 0
    
    # Most common errors
    top_errors = error_profile[:5] if error_profile else []

    # Calculate improvement trend: compare recent 10 sessions vs previous 10
    improvement_trend = "stable"
    if len(bands) >= 4:
        mid = len(bands) // 2
        recent_avg = sum(bands[:mid]) / mid
        older_avg = sum(bands[mid:]) / (len(bands) - mid)
        delta = recent_avg - older_avg
        if delta > 0.3:
            improvement_trend = "improving"
        elif delta < -0.3:
            improvement_trend = "declining"
    
    return {
        "total_sessions": total_sessions,
        "total_practice_minutes": total_minutes,
        "average_band": round(avg_band, 1),
        "sessions_this_week": len([s for s in sessions[:7]]),
        "top_error_categories": top_errors,
        "improvement_trend": improvement_trend,
    }
