"""
SpeakMate AI - Training Routes (Production)

Endpoints for personalized training system.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.services.training_engine import training_engine

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/tasks")
async def get_training_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    due_only: bool = Query(True, description="Only return due tasks"),
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's training tasks.
    
    Returns tasks due for practice with spaced repetition.
    """
    try:
        user_id = current_user["user_id"]
        
        # Build query
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        query = client.table("training_tasks").select("*").eq("user_id", user_id)
        
        if status:
            query = query.eq("status", status)
        
        if due_only:
            query = query.lte("next_due_at", datetime.utcnow().isoformat())
        
        query = query.order("next_due_at").limit(limit)
        
        result = query.execute()
        
        return {
            "tasks": result.data,
            "count": len(result.data)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tasks: {str(e)}"
        )


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific training task with full content."""
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        result = client.table("training_tasks").select("*").eq("id", str(task_id)).single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Verify ownership
        if result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        return result.data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch task: {str(e)}"
        )


@router.post("/tasks/{task_id}/complete")
async def complete_task(
    task_id: UUID,
    was_correct: bool = Query(..., description="Whether the answer was correct"),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a training task as completed.
    
    Updates spaced repetition schedule based on performance.
    """
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Get current task
        result = client.table("training_tasks").select("*").eq("id", str(task_id)).single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        task = result.data
        
        # Verify ownership
        if task.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Calculate next review using SM-2
        updated_task = training_engine.calculate_next_review(task, was_correct)
        
        # Update in database
        client.table("training_tasks").update({
            "interval_days": updated_task["interval_days"],
            "ease_factor": updated_task["ease_factor"],
            "repetition_count": updated_task["repetition_count"],
            "next_due_at": updated_task["next_due_at"],
            "last_practiced_at": updated_task["last_practiced_at"],
            "times_practiced": task.get("times_practiced", 0) + 1,
            "times_correct": task.get("times_correct", 0) + (1 if was_correct else 0)
        }).eq("id", str(task_id)).execute()
        
        return {
            "status": "completed",
            "was_correct": was_correct,
            "next_due_at": updated_task["next_due_at"],
            "interval_days": updated_task["interval_days"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete task: {str(e)}"
        )


@router.get("/plan")
async def get_training_plan(
    available_minutes: int = Query(15, description="Available time for practice"),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a training plan based on user's error profile.
    """
    try:
        user_id = current_user["user_id"]
        
        # Get user's error profile
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Get recent errors
        errors_result = client.table("error_instances").select(
            "category, error_code"
        ).eq("session_id", client.table("sessions").select("id").eq(
            "user_id", user_id
        ).order("created_at", desc=True).limit(10)).execute()
        
        # Build error profile
        error_profile = {"by_code": {}}
        for error in errors_result.data if errors_result.data else []:
            code = error.get("error_code", "GRAM_OTHER")
            error_profile["by_code"][code] = error_profile["by_code"].get(code, 0) + 1
        
        # Generate plan
        plan = training_engine.generate_session_plan(error_profile, available_minutes)
        
        return {
            "plan": plan,
            "estimated_minutes": sum(t.get("estimated_minutes", 3) for t in plan.get("daily_tasks", [])[:1])
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate plan: {str(e)}"
        )


@router.get("/progress")
async def get_training_progress(
    days: int = Query(30, description="Number of days to include"),
    current_user: dict = Depends(get_current_user)
):
    """Get user's training progress over time."""
    try:
        user_id = current_user["user_id"]
        
        from supabase import create_client
        from app.core.config import settings
        from datetime import timedelta
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        # Get completed tasks
        result = client.table("training_tasks").select(
            "error_code, times_practiced, times_correct, last_practiced_at"
        ).eq("user_id", user_id).gte("last_practiced_at", since).execute()
        
        tasks = result.data or []
        
        # Calculate stats
        total_practiced = sum(t.get("times_practiced", 0) for t in tasks)
        total_correct = sum(t.get("times_correct", 0) for t in tasks)
        accuracy = total_correct / total_practiced if total_practiced > 0 else 0
        
        # Group by error code
        by_category = {}
        for task in tasks:
            code = task.get("error_code", "GRAM_OTHER")
            category = code.split("_")[0] if "_" in code else "OTHER"
            if category not in by_category:
                by_category[category] = {"practiced": 0, "correct": 0}
            by_category[category]["practiced"] += task.get("times_practiced", 0)
            by_category[category]["correct"] += task.get("times_correct", 0)
        
        return {
            "period_days": days,
            "total_practiced": total_practiced,
            "total_correct": total_correct,
            "accuracy": round(accuracy * 100, 1),
            "by_category": by_category,
            "tasks_count": len(tasks)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch progress: {str(e)}"
        )
