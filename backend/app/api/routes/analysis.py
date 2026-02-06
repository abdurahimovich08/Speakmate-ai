"""
SpeakMate AI - Analysis Routes (Production)

Endpoints for session analysis and reports.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.services.analysis_coordinator import analysis_coordinator
from app.workers.queue_config import QueueManager

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/sessions/{session_id}")
async def get_session_analysis(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get analysis results for a session.
    
    Returns both fast and deep analysis if available.
    """
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Verify session ownership
        session_result = client.table("sessions").select("*").eq("id", str(session_id)).single().execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session_result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Get analysis runs
        analysis_result = client.table("analysis_runs").select(
            "*"
        ).eq("session_id", str(session_id)).order("created_at", desc=True).execute()
        
        # Get errors
        errors_result = client.table("error_instances").select(
            "*"
        ).eq("session_id", str(session_id)).execute()
        
        # Separate fast and deep analysis
        fast_analysis = None
        deep_analysis = None
        
        for run in analysis_result.data or []:
            if run.get("analysis_type") == "fast" and not fast_analysis:
                fast_analysis = run
            elif run.get("analysis_type") == "deep" and not deep_analysis:
                deep_analysis = run
        
        return {
            "session_id": str(session_id),
            "session": session_result.data,
            "fast_analysis": fast_analysis,
            "deep_analysis": deep_analysis,
            "errors": errors_result.data or [],
            "has_pdf": bool(session_result.data.get("pdf_url"))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analysis: {str(e)}"
        )


@router.post("/sessions/{session_id}/reanalyze")
async def trigger_reanalysis(
    session_id: UUID,
    analysis_type: str = Query("deep", description="Type of analysis"),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger re-analysis of a session.
    
    Useful if analysis failed or needs refresh.
    """
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Verify session ownership
        session_result = client.table("sessions").select("*").eq("id", str(session_id)).single().execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session_result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Queue analysis
        queue = QueueManager()
        job = queue.enqueue_analysis(str(session_id), analysis_type)
        
        return {
            "status": "queued",
            "session_id": str(session_id),
            "analysis_type": analysis_type,
            "job_id": job.id if job else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue analysis: {str(e)}"
        )


@router.get("/sessions/{session_id}/errors")
async def get_session_errors(
    session_id: UUID,
    category: Optional[str] = Query(None, description="Filter by category"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed errors for a session."""
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Verify session ownership
        session_result = client.table("sessions").select("user_id").eq("id", str(session_id)).single().execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session_result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Build query
        query = client.table("error_instances").select("*").eq("session_id", str(session_id))
        
        if category:
            query = query.eq("category", category)
        if severity:
            query = query.eq("severity", severity)
        
        result = query.order("created_at").execute()
        
        # Group by category
        grouped = {}
        for error in result.data or []:
            cat = error.get("category", "other")
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append(error)
        
        return {
            "session_id": str(session_id),
            "total_errors": len(result.data or []),
            "by_category": grouped,
            "errors": result.data or []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch errors: {str(e)}"
        )


@router.get("/sessions/{session_id}/scores")
async def get_session_scores(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get IELTS scores for a session."""
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Verify session ownership and get scores
        session_result = client.table("sessions").select(
            "user_id, overall_score, fluency_score, vocabulary_score, grammar_score, pronunciation_score"
        ).eq("id", str(session_id)).single().execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session_result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Get detailed scores from deep analysis
        analysis_result = client.table("analysis_runs").select(
            "result"
        ).eq("session_id", str(session_id)).eq("analysis_type", "deep").eq(
            "status", "completed"
        ).order("created_at", desc=True).limit(1).execute()
        
        detailed_scores = None
        if analysis_result.data and analysis_result.data[0].get("result"):
            result = analysis_result.data[0]["result"]
            detailed_scores = result.get("scores")
        
        return {
            "session_id": str(session_id),
            "overall_score": session_result.data.get("overall_score"),
            "scores": {
                "fluency_coherence": session_result.data.get("fluency_score"),
                "lexical_resource": session_result.data.get("vocabulary_score"),
                "grammatical_range": session_result.data.get("grammar_score"),
                "pronunciation": session_result.data.get("pronunciation_score")
            },
            "detailed": detailed_scores
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scores: {str(e)}"
        )


@router.post("/sessions/{session_id}/pdf")
async def generate_pdf_report(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Queue PDF report generation for a session."""
    try:
        from supabase import create_client
        from app.core.config import settings
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        # Verify session ownership
        session_result = client.table("sessions").select("user_id").eq("id", str(session_id)).single().execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        if session_result.data.get("user_id") != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        # Queue PDF generation
        queue = QueueManager()
        job = queue.enqueue_pdf_generation(str(session_id), current_user["user_id"])
        
        return {
            "status": "queued",
            "session_id": str(session_id),
            "job_id": job.id if job else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue PDF generation: {str(e)}"
        )


@router.get("/user/summary")
async def get_user_analysis_summary(
    days: int = Query(30, description="Period in days"),
    current_user: dict = Depends(get_current_user)
):
    """Get user's overall analysis summary."""
    try:
        from supabase import create_client
        from app.core.config import settings
        from datetime import timedelta
        
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        user_id = current_user["user_id"]
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        # Get sessions in period
        sessions_result = client.table("sessions").select(
            "id, overall_score, fluency_score, vocabulary_score, grammar_score, pronunciation_score, created_at"
        ).eq("user_id", user_id).gte("created_at", since).execute()
        
        sessions = sessions_result.data or []
        
        if not sessions:
            return {
                "period_days": days,
                "sessions_count": 0,
                "average_score": None,
                "improvement": None,
                "top_errors": []
            }
        
        # Calculate averages
        scores = [s.get("overall_score") for s in sessions if s.get("overall_score")]
        avg_score = sum(scores) / len(scores) if scores else None
        
        # Calculate improvement (compare first and last session)
        improvement = None
        if len(scores) >= 2:
            improvement = round(scores[-1] - scores[0], 1)
        
        # Get top error categories
        errors_result = client.table("error_instances").select(
            "category, error_code"
        ).in_("session_id", [s["id"] for s in sessions]).execute()
        
        error_counts = {}
        for error in errors_result.data or []:
            cat = error.get("category", "other")
            error_counts[cat] = error_counts.get(cat, 0) + 1
        
        top_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return {
            "period_days": days,
            "sessions_count": len(sessions),
            "average_score": round(avg_score, 1) if avg_score else None,
            "improvement": improvement,
            "score_trend": [{"date": s["created_at"], "score": s.get("overall_score")} for s in sessions],
            "top_errors": [{"category": cat, "count": count} for cat, count in top_errors]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch summary: {str(e)}"
        )
