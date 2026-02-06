"""
SpeakMate AI - Session Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.models.schemas import (
    SessionCreate, 
    SessionResponse, 
    SessionSummary,
    SessionMode
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=dict)
async def create_session(
    session_data: SessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new speaking session."""
    session = await db_service.create_session(
        user_id=current_user["user_id"],
        mode=session_data.mode.value,
        topic=session_data.topic
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )
    
    return session


@router.get("/", response_model=List[dict])
async def get_user_sessions(
    limit: int = 20,
    mode: Optional[SessionMode] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's recent sessions."""
    sessions = await db_service.get_user_sessions(
        current_user["user_id"],
        limit=limit
    )
    
    if mode:
        sessions = [s for s in sessions if s.get("mode") == mode.value]
    
    return sessions


@router.get("/{session_id}", response_model=dict)
async def get_session(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific session."""
    session = await db_service.get_session(str(session_id))
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Verify ownership
    if session.get("user_id") != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this session"
        )
    
    return session


@router.get("/{session_id}/conversation", response_model=List[dict])
async def get_session_conversation(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation turns for a session."""
    # Verify session ownership first
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
    
    turns = await db_service.get_conversation_turns(str(session_id))
    return turns


@router.get("/{session_id}/errors", response_model=List[dict])
async def get_session_errors(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get detected errors for a session."""
    # Verify session ownership first
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
    
    errors = await db_service.get_session_errors(str(session_id))
    return errors


@router.put("/{session_id}/end", response_model=dict)
async def end_session(
    session_id: UUID,
    duration_seconds: int,
    current_user: dict = Depends(get_current_user)
):
    """End a session and save final duration."""
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
    
    updated = await db_service.update_session(
        str(session_id),
        {"duration_seconds": duration_seconds}
    )
    
    return updated
