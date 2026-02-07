"""
SpeakMate AI - Training Routes (Production)

Endpoints for personalized training system.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.services.training_engine import training_engine

router = APIRouter(prefix="/training", tags=["training"])


class TaskCompletionRequest(BaseModel):
    was_correct: Optional[bool] = None
    score: Optional[float] = None


@router.get("/tasks")
async def get_training_tasks(
    task_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
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

        client = db_service.client
        
        query = client.table("training_tasks").select("*").eq("user_id", user_id)
        
        if task_status:
            query = query.eq("status", task_status)
        
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
        client = db_service.client
        
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
    payload: Optional[TaskCompletionRequest] = None,
    was_correct: Optional[bool] = Query(None, description="Whether the answer was correct"),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a training task as completed.
    
    Updates spaced repetition schedule based on performance.
    """
    try:
        client = db_service.client
        
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
        
        resolved_was_correct = was_correct
        if resolved_was_correct is None and payload is not None and payload.was_correct is not None:
            resolved_was_correct = payload.was_correct

        if resolved_was_correct is None and payload is not None and payload.score is not None:
            # Accept both 0..1 and 0..100 style scores from clients.
            threshold = 0.7 if payload.score <= 1 else 70
            resolved_was_correct = payload.score >= threshold

        if resolved_was_correct is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either was_correct or score must be provided"
            )

        # Calculate next review using SM-2
        updated_task = training_engine.calculate_next_review(task, resolved_was_correct)
        
        # Update in database
        client.table("training_tasks").update({
            "interval_days": updated_task["interval_days"],
            "ease_factor": updated_task["ease_factor"],
            "repetition_count": updated_task["repetition_count"],
            "next_due_at": updated_task["next_due_at"],
            "last_practiced_at": updated_task["last_practiced_at"],
            "times_practiced": task.get("times_practiced", 0) + 1,
            "times_correct": task.get("times_correct", 0) + (1 if resolved_was_correct else 0)
        }).eq("id", str(task_id)).execute()
        
        return {
            "status": "completed",
            "was_correct": resolved_was_correct,
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

        client = db_service.client

        recent_sessions = (
            client.table("sessions")
            .select("id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        session_ids = [row["id"] for row in (recent_sessions.data or []) if row.get("id")]

        errors_result = None
        if session_ids:
            errors_result = (
                client.table("error_instances")
                .select("category, error_code")
                .in_("session_id", session_ids)
                .execute()
            )
        
        # Build error profile
        error_profile = {"by_code": {}}
        for error in errors_result.data if errors_result and errors_result.data else []:
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

        from datetime import timedelta

        client = db_service.client
        
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
