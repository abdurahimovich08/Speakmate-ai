"""
SpeakMate AI - Session Manager (Production)

Handles session lifecycle, state recovery, and deterministic state management.
"""
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from fastapi import WebSocket
import asyncio
import json
import logging

from app.api.websocket.protocol import (
    SessionContext, SessionState, SessionMode,
    ServerMessage, ServerMessageType, ErrorCode,
    ClientMessage, ClientMessageType
)
from app.db.supabase import db_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages active WebSocket sessions with deterministic state.
    
    Features:
    - Session state machine
    - Reconnection support
    - State persistence
    - Graceful degradation
    """
    
    def __init__(self):
        # Active sessions: session_id -> SessionContext
        self.sessions: Dict[str, SessionContext] = {}
        
        # WebSocket connections: session_id -> WebSocket
        self.connections: Dict[str, WebSocket] = {}
        
        # Pending reconnections: session_id -> expiry_time
        self.pending_reconnect: Dict[str, datetime] = {}
        
        # Message buffers for replay: session_id -> List[ServerMessage]
        self.message_buffers: Dict[str, List[ServerMessage]] = {}
        
        # Max buffer size for replay
        self.max_buffer_size = 100
        
        # Reconnection window (seconds)
        self.reconnect_window = 300  # 5 minutes
    
    async def create_session(
        self,
        websocket: WebSocket,
        user_id: str,
        mode: SessionMode,
        topic: Optional[str] = None,
        ielts_part: Optional[int] = None
    ) -> SessionContext:
        """Create a new session."""
        
        # Create session in database
        db_session = await db_service.create_session(
            user_id=user_id,
            mode=mode.value,
            topic=topic
        )
        
        session_id = db_session["id"]
        now = datetime.utcnow()
        
        # Initialize session context
        context = SessionContext(
            session_id=session_id,
            user_id=user_id,
            state=SessionState.READY,
            mode=mode,
            topic=topic,
            ielts_part=ielts_part,
            started_at=now,
            last_activity_at=now
        )
        
        # Store session
        self.sessions[session_id] = context
        self.connections[session_id] = websocket
        self.message_buffers[session_id] = []
        
        logger.info(f"Session created: {session_id} for user {user_id}")
        
        return context
    
    async def resume_session(
        self,
        websocket: WebSocket,
        session_id: str,
        last_seq: int
    ) -> Optional[SessionContext]:
        """Resume a disconnected session."""
        
        # Check if session exists and is resumable
        if session_id not in self.sessions:
            # Try to recover from database
            db_session = await db_service.get_session(session_id)
            if not db_session:
                return None
            
            # Session exists but context lost - limited recovery
            logger.warning(f"Session {session_id} recovered from DB (limited state)")
            return None
        
        context = self.sessions[session_id]
        
        # Check reconnection window
        if session_id in self.pending_reconnect:
            if datetime.utcnow() > self.pending_reconnect[session_id]:
                logger.info(f"Session {session_id} reconnection window expired")
                return None
            del self.pending_reconnect[session_id]
        
        # Update connection
        self.connections[session_id] = websocket
        context.last_activity_at = datetime.utcnow()
        
        # Replay missed messages
        await self._replay_messages(websocket, session_id, last_seq)
        
        logger.info(f"Session resumed: {session_id}")
        
        return context
    
    async def _replay_messages(
        self,
        websocket: WebSocket,
        session_id: str,
        last_seq: int
    ):
        """Replay messages missed during disconnect."""
        
        if session_id not in self.message_buffers:
            return
        
        buffer = self.message_buffers[session_id]
        missed = [msg for msg in buffer if msg.seq > last_seq]
        
        for msg in missed:
            try:
                await websocket.send_text(msg.to_json())
            except Exception as e:
                logger.error(f"Failed to replay message: {e}")
                break
        
        logger.info(f"Replayed {len(missed)} messages for session {session_id}")
    
    async def handle_disconnect(self, session_id: str):
        """Handle WebSocket disconnection."""
        
        if session_id not in self.sessions:
            return
        
        context = self.sessions[session_id]
        
        # Set reconnection window
        self.pending_reconnect[session_id] = (
            datetime.utcnow() + timedelta(seconds=self.reconnect_window)
        )
        
        # Update state
        context.state = SessionState.PAUSED
        
        # Remove connection but keep session
        if session_id in self.connections:
            del self.connections[session_id]
        
        logger.info(f"Session {session_id} disconnected, waiting for reconnect")
    
    async def end_session(self, session_id: str) -> Optional[Dict]:
        """End a session and trigger analysis."""
        
        if session_id not in self.sessions:
            return None
        
        context = self.sessions[session_id]
        context.state = SessionState.ANALYZING
        
        # Calculate final duration
        duration_seconds = int(context.total_duration_ms / 1000)
        
        # Update database
        await db_service.update_session(session_id, {
            "duration_seconds": duration_seconds,
            "ended_at": datetime.utcnow().isoformat()
        })
        
        # Cleanup
        if session_id in self.connections:
            del self.connections[session_id]
        if session_id in self.pending_reconnect:
            del self.pending_reconnect[session_id]
        
        # Keep session context for analysis
        context.state = SessionState.COMPLETED
        
        logger.info(f"Session {session_id} ended after {duration_seconds}s")
        
        return context.to_recovery_payload()
    
    async def send_message(
        self,
        session_id: str,
        message: ServerMessage
    ) -> bool:
        """Send message to client with buffering."""
        
        # Buffer message for replay
        if session_id in self.message_buffers:
            buffer = self.message_buffers[session_id]
            buffer.append(message)
            
            # Trim buffer if too large
            if len(buffer) > self.max_buffer_size:
                self.message_buffers[session_id] = buffer[-self.max_buffer_size:]
        
        # Send if connected
        if session_id in self.connections:
            try:
                await self.connections[session_id].send_text(message.to_json())
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                await self.handle_disconnect(session_id)
                return False
        
        return False
    
    async def send_binary(
        self,
        session_id: str,
        data: bytes
    ) -> bool:
        """Send binary data (TTS audio) to client."""
        
        if session_id in self.connections:
            try:
                await self.connections[session_id].send_bytes(data)
                return True
            except Exception as e:
                logger.error(f"Failed to send binary to {session_id}: {e}")
                return False
        
        return False
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        """Get session context."""
        return self.sessions.get(session_id)
    
    def update_state(self, session_id: str, state: SessionState):
        """Update session state."""
        if session_id in self.sessions:
            self.sessions[session_id].state = state
            self.sessions[session_id].last_activity_at = datetime.utcnow()
    
    def record_audio_chunk(self, session_id: str, duration_ms: int):
        """Record audio chunk statistics."""
        if session_id in self.sessions:
            context = self.sessions[session_id]
            context.audio_chunks_received += 1
            context.total_audio_ms += duration_ms
            context.last_activity_at = datetime.utcnow()
    
    def increment_turn(self, session_id: str):
        """Increment conversation turn count."""
        if session_id in self.sessions:
            self.sessions[session_id].turn_count += 1
    
    async def cleanup_expired_sessions(self):
        """Background task to cleanup expired sessions."""
        now = datetime.utcnow()
        
        expired = [
            sid for sid, expiry in self.pending_reconnect.items()
            if now > expiry
        ]
        
        for session_id in expired:
            logger.info(f"Cleaning up expired session: {session_id}")
            
            # End session in database
            if session_id in self.sessions:
                await self.end_session(session_id)
            
            # Cleanup
            self.sessions.pop(session_id, None)
            self.message_buffers.pop(session_id, None)
            self.pending_reconnect.pop(session_id, None)
    
    def get_active_session_count(self) -> int:
        """Get count of active sessions."""
        return len(self.connections)
    
    def get_session_stats(self) -> Dict:
        """Get session statistics."""
        return {
            "active_connections": len(self.connections),
            "total_sessions": len(self.sessions),
            "pending_reconnect": len(self.pending_reconnect)
        }


# Global session manager instance
session_manager = SessionManager()
