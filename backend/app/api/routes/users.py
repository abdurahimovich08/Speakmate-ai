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
    avg_band = 0
    if scores_list:
        bands = [s.get("overall_band", 0) for s in scores_list if s.get("overall_band")]
        avg_band = sum(bands) / len(bands) if bands else 0
    
    # Most common errors
    top_errors = error_profile[:5] if error_profile else []
    
    return {
        "total_sessions": total_sessions,
        "total_practice_minutes": total_minutes,
        "average_band": round(avg_band, 1),
        "sessions_this_week": len([s for s in sessions[:7]]),  # Simplified
        "top_error_categories": top_errors,
        "improvement_trend": "improving"  # TODO: Calculate actual trend
    }
