"""
SpeakMate AI - WebSocket Conversation Handler
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional
import json
import asyncio
import base64
from datetime import datetime

from app.core.config import settings
from app.db.supabase import db_service
from app.services.speech import SpeechService
from app.services.conversation import ConversationService
from app.services.analyzer import ErrorAnalyzer

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.session_data: dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_data[session_id] = {
            "conversation_history": [],
            "errors": [],
            "turn_count": 0,
            "start_time": datetime.utcnow()
        }
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.session_data:
            del self.session_data[session_id]
    
    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)
    
    def get_session_data(self, session_id: str) -> dict:
        return self.session_data.get(session_id, {})
    
    def update_session_data(self, session_id: str, data: dict):
        if session_id in self.session_data:
            self.session_data[session_id].update(data)


manager = ConnectionManager()


@router.websocket("/ws/conversation/{session_id}")
async def conversation_websocket(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time conversation.
    
    Message types:
    - audio_chunk: Base64 encoded audio data
    - text_input: Direct text input (for testing)
    - end_session: End the conversation
    - get_status: Get current session status
    """
    
    # TODO: Verify token in production
    # For now, we'll accept connections without strict auth for development
    
    await manager.connect(websocket, session_id)
    
    # Initialize services
    speech_service = SpeechService()
    conversation_service = ConversationService()
    error_analyzer = ErrorAnalyzer()
    
    # Get session info from database
    session = await db_service.get_session(session_id)
    if not session:
        await websocket.send_json({
            "type": "error",
            "data": {"message": "Session not found"}
        })
        await websocket.close()
        return
    
    # Send welcome message
    await manager.send_message(session_id, {
        "type": "connected",
        "data": {
            "session_id": session_id,
            "mode": session.get("mode"),
            "topic": session.get("topic"),
            "message": "Connected! Ready to start conversation."
        }
    })
    
    # Generate initial AI greeting
    topic = session.get("topic", "general conversation")
    initial_response = await conversation_service.generate_greeting(topic)
    
    await manager.send_message(session_id, {
        "type": "ai_message",
        "data": {
            "text": initial_response,
            "role": "assistant"
        }
    })
    
    # Save initial turn
    session_data = manager.get_session_data(session_id)
    session_data["conversation_history"].append({
        "role": "assistant",
        "content": initial_response
    })
    session_data["turn_count"] = 1
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")
            payload = data.get("data", {})
            
            if message_type == "audio_chunk":
                # Process audio chunk
                audio_data = payload.get("audio_data")
                is_final = payload.get("is_final", False)
                
                if audio_data:
                    # Decode base64 audio
                    audio_bytes = base64.b64decode(audio_data)
                    
                    # Transcribe audio
                    transcription = await speech_service.transcribe_audio(
                        audio_bytes,
                        is_final=is_final
                    )
                    
                    if transcription and transcription.get("text"):
                        # Send transcription to client
                        await manager.send_message(session_id, {
                            "type": "transcription",
                            "data": {
                                "text": transcription["text"],
                                "is_final": transcription.get("is_final", False),
                                "confidence": transcription.get("confidence", 0)
                            }
                        })
                        
                        # If final transcription, process it
                        if transcription.get("is_final"):
                            await process_user_message(
                                session_id,
                                transcription["text"],
                                session,
                                conversation_service,
                                error_analyzer
                            )
            
            elif message_type == "text_input":
                # Direct text input (for testing without audio)
                text = payload.get("text", "")
                if text:
                    await process_user_message(
                        session_id,
                        text,
                        session,
                        conversation_service,
                        error_analyzer
                    )
            
            elif message_type == "end_session":
                # End the conversation
                await end_conversation(session_id, session, error_analyzer)
                break
            
            elif message_type == "get_status":
                # Return current session status
                session_data = manager.get_session_data(session_id)
                await manager.send_message(session_id, {
                    "type": "status",
                    "data": {
                        "turn_count": session_data.get("turn_count", 0),
                        "error_count": len(session_data.get("errors", [])),
                        "duration_seconds": (
                            datetime.utcnow() - session_data.get("start_time", datetime.utcnow())
                        ).seconds
                    }
                })
    
    except WebSocketDisconnect:
        # Handle unexpected disconnection
        await end_conversation(session_id, session, error_analyzer)
    
    finally:
        manager.disconnect(session_id)


async def process_user_message(
    session_id: str,
    text: str,
    session: dict,
    conversation_service: ConversationService,
    error_analyzer: ErrorAnalyzer
):
    """Process user's message and generate response."""
    
    session_data = manager.get_session_data(session_id)
    
    # Add user message to history
    session_data["conversation_history"].append({
        "role": "user",
        "content": text
    })
    
    # Analyze for errors (in background)
    errors = await error_analyzer.analyze_text(
        text,
        native_language=session.get("native_language", "uz"),
        topic=session.get("topic", "general")
    )
    
    if errors:
        session_data["errors"].extend(errors)
        # Don't send errors to client during conversation
        # They will be shown at the end
    
    # Generate AI response
    response = await conversation_service.generate_response(
        user_message=text,
        conversation_history=session_data["conversation_history"],
        topic=session.get("topic", "general"),
        user_level="B1"  # TODO: Get from user profile
    )
    
    # Add AI response to history
    session_data["conversation_history"].append({
        "role": "assistant",
        "content": response
    })
    
    session_data["turn_count"] += 1
    
    # Send AI response to client
    await manager.send_message(session_id, {
        "type": "ai_message",
        "data": {
            "text": response,
            "role": "assistant",
            "turn_number": session_data["turn_count"]
        }
    })
    
    # Save conversation turn to database
    await db_service.save_conversation_turn(session_id, {
        "role": "user",
        "content": text,
        "transcription": text,
        "sequence_order": session_data["turn_count"] * 2 - 1
    })
    
    await db_service.save_conversation_turn(session_id, {
        "role": "assistant",
        "content": response,
        "sequence_order": session_data["turn_count"] * 2
    })


async def end_conversation(
    session_id: str,
    session: dict,
    error_analyzer: ErrorAnalyzer
):
    """End the conversation and generate final analysis."""
    
    session_data = manager.get_session_data(session_id)
    
    # Calculate duration
    start_time = session_data.get("start_time", datetime.utcnow())
    duration_seconds = (datetime.utcnow() - start_time).seconds
    
    # Save all errors to database
    if session_data.get("errors"):
        await db_service.save_detected_errors(session_id, session_data["errors"])
        
        # Update user's error profile
        user_id = session.get("user_id")
        for error in session_data["errors"]:
            await db_service.update_error_profile(
                user_id,
                error.get("category"),
                error.get("subcategory", "general")
            )
    
    # Generate overall scores
    full_transcription = " ".join([
        turn["content"] for turn in session_data.get("conversation_history", [])
        if turn.get("role") == "user"
    ])
    
    scores = await error_analyzer.generate_scores(
        full_transcription,
        session_data.get("errors", [])
    )
    
    # Update session with final data
    await db_service.update_session(session_id, {
        "duration_seconds": duration_seconds,
        "overall_scores": scores,
        "ended_at": datetime.utcnow().isoformat()
    })
    
    # Send final analysis to client
    await manager.send_message(session_id, {
        "type": "session_ended",
        "data": {
            "duration_seconds": duration_seconds,
            "turn_count": session_data.get("turn_count", 0),
            "total_errors": len(session_data.get("errors", [])),
            "scores": scores,
            "errors": session_data.get("errors", []),
            "message": "Session completed! Check your feedback."
        }
    })
