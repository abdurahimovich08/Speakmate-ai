"""
SpeakMate AI - Feedback Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Optional
from uuid import UUID
import os

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.models.schemas import SessionFeedback, PDFReportRequest, PDFReportResponse
from app.services.pdf import PDFGenerator

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.get("/{session_id}", response_model=dict)
async def get_session_feedback(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive feedback for a session."""
    # Verify session ownership
    session = await db_service.get_session(str(session_id))
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.get("user_id") != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Get all related data
    errors = await db_service.get_session_errors(str(session_id))
    conversation = await db_service.get_conversation_turns(str(session_id))
    
    # Group errors by category
    error_summary = {}
    for error in errors:
        category = error.get("category", "other")
        if category not in error_summary:
            error_summary[category] = []
        error_summary[category].append(error)
    
    return {
        "session_id": str(session_id),
        "mode": session.get("mode"),
        "topic": session.get("topic"),
        "duration_seconds": session.get("duration_seconds"),
        "overall_scores": session.get("overall_scores"),
        "total_errors": len(errors),
        "errors_by_category": error_summary,
        "conversation_turns": len(conversation),
        "errors": errors
    }


@router.post("/{session_id}/pdf", response_model=dict)
async def generate_pdf_report(
    session_id: UUID,
    request: PDFReportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate a PDF report for a session."""
    # Verify session ownership
    session = await db_service.get_session(str(session_id))
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.get("user_id") != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Get user profile for the report
    user_profile = await db_service.get_user_profile(current_user["user_id"])
    
    # Get session data
    errors = await db_service.get_session_errors(str(session_id))
    conversation = await db_service.get_conversation_turns(str(session_id))
    
    # Generate PDF
    pdf_generator = PDFGenerator()
    report_data = {
        "session": session,
        "user": user_profile,
        "errors": errors,
        "conversation": conversation,
        "include_details": request.include_details
    }
    
    # Generate in background for large reports
    pdf_path = await pdf_generator.generate_session_report(report_data)
    
    return {
        "message": "PDF report generated",
        "report_path": pdf_path,
        "session_id": str(session_id)
    }


@router.get("/{session_id}/pdf/download")
async def download_pdf_report(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Download the generated PDF report."""
    # Verify session ownership
    session = await db_service.get_session(str(session_id))
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.get("user_id") != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Check if PDF exists
    pdf_path = f"reports/{session_id}.pdf"
    
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF report not found. Please generate it first."
        )
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"speakmate_report_{session_id}.pdf"
    )


@router.get("/summary/weekly", response_model=dict)
async def get_weekly_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get weekly progress summary."""
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=50)
    error_profile = await db_service.get_user_error_profile(current_user["user_id"])
    
    # Calculate weekly stats
    # This is a simplified version - in production, filter by actual dates
    recent_sessions = sessions[:7]
    
    total_minutes = sum(s.get("duration_seconds", 0) for s in recent_sessions) // 60
    
    # Get scores trend
    scores = [s.get("overall_scores", {}).get("overall_band") for s in recent_sessions]
    scores = [s for s in scores if s is not None]
    
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Top issues
    top_issues = [
        {
            "category": e.get("category"),
            "subcategory": e.get("subcategory"),
            "count": e.get("occurrence_count")
        }
        for e in error_profile[:3]
    ]
    
    return {
        "period": "weekly",
        "sessions_count": len(recent_sessions),
        "total_practice_minutes": total_minutes,
        "average_band_score": round(avg_score, 1),
        "top_issues": top_issues,
        "recommendation": "Focus on your most frequent errors for maximum improvement."
    }
