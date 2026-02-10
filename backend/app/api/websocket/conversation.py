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
from app.core.security import verify_supabase_token_string
from app.db.supabase import db_service
from app.services.speech import SpeechService
from app.services.conversation import ConversationService
from app.services.analyzer import ErrorAnalyzer
from app.services.hybrid_analyzer import HybridErrorAnalyzer
from app.services.pronunciation_engine import PronunciationAnalyzer
from app.services.ielts_scorer_production import ielts_scorer

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
            "utterances": [],
            "errors": [],
            "recommendations": [],
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


def _extract_band(value) -> Optional[float]:
    if isinstance(value, dict):
        value = value.get("band")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _flatten_advanced_scores(advanced_scores: dict) -> dict:
    if not isinstance(advanced_scores, dict):
        return {}

    mapping = {
        "fluency_coherence": "fluency_coherence",
        "lexical_resource": "lexical_resource",
        "grammatical_range": "grammatical_range",
        "pronunciation": "pronunciation",
    }

    flat = {}
    for source_key, target_key in mapping.items():
        band = _extract_band(advanced_scores.get(source_key))
        if band is not None:
            flat[target_key] = round(band * 2) / 2

    overall = _extract_band(advanced_scores.get("overall_band"))
    if overall is not None:
        flat["overall_band"] = round(overall * 2) / 2

    if "overall_band" not in flat and all(k in flat for k in mapping.values()):
        avg = sum(flat[k] for k in mapping.values()) / len(mapping)
        flat["overall_band"] = round(avg * 2) / 2

    return flat


def _score_based_tips(scores: dict) -> list[str]:
    def score_of(key: str, default: float = 9.0) -> float:
        try:
            return float(scores.get(key, default))
        except (TypeError, ValueError):
            return default

    tips = []
    if not isinstance(scores, dict):
        return tips

    if score_of("grammatical_range") < 6.5:
        tips.append("Grammar accuracyni oshirish uchun qisqa, toza gaplardan boshlab keyin murakkab strukturaga o'ting.")
    if score_of("lexical_resource") < 6.5:
        tips.append("Bir xil so'zlarni takrorlamaslik uchun har mavzuga 5-7 ta synonym/chunk tayyorlang.")
    if score_of("fluency_coherence") < 6.5:
        tips.append("Fluency uchun 60-90 soniyalik timed speaking mashqlarini har kuni bajaring.")
    if score_of("pronunciation") < 6.5:
        tips.append("Pronunciation uchun shadowing va minimal-pairs mashqlarini qo'shing.")

    return tips


def _merge_unique_texts(items: list[str], limit: int = 6) -> list[str]:
    seen = set()
    merged = []
    for item in items:
        if not item:
            continue
        text = str(item).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(text)
        if len(merged) >= limit:
            break
    return merged


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
    
    # Enforce token auth for WebSocket sessions.
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        current_user = verify_supabase_token_string(token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid token")
        return

    # Get session info from database and verify ownership before accepting.
    session = await db_service.get_session(session_id)
    if not session:
        await websocket.close(code=1008, reason="Session not found")
        return

    if session.get("user_id") != current_user["user_id"]:
        await websocket.close(code=1008, reason="Not authorized for this session")
        return

    try:
        user_profile = await db_service.get_user_profile(current_user["user_id"])
        if user_profile and user_profile.get("native_language"):
            session["native_language"] = user_profile["native_language"]
    except Exception:
        # Non-blocking: fallback to default native language in analyzer.
        pass

    await manager.connect(websocket, session_id)
    
    # Initialize services
    speech_service = SpeechService()
    conversation_service = ConversationService()
    error_analyzer = ErrorAnalyzer()
    
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
                                error_analyzer,
                                transcription_meta=transcription,
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
                        error_analyzer,
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
    error_analyzer: ErrorAnalyzer,
    transcription_meta: Optional[dict] = None,
):
    """Process user's message and generate response."""
    
    session_data = manager.get_session_data(session_id)
    
    # Add user message to history
    session_data["conversation_history"].append({
        "role": "user",
        "content": text
    })

    # Capture utterance-level metadata for deep analysis and pronunciation scoring.
    words = []
    confidence = 0.0
    audio_duration_ms = 0
    if isinstance(transcription_meta, dict):
        confidence = float(transcription_meta.get("confidence") or 0.0)
        raw_words = transcription_meta.get("words") or []
        if isinstance(raw_words, list):
            for item in raw_words:
                if not isinstance(item, dict):
                    continue
                word = str(item.get("word") or "").strip()
                if not word:
                    continue
                start_ms = int(float(item.get("start_time") or 0) * 1000)
                end_ms = int(float(item.get("end_time") or 0) * 1000)
                words.append(
                    {
                        "word": word,
                        "start_ms": start_ms,
                        "end_ms": end_ms,
                        "confidence": confidence,
                    }
                )
            if words:
                audio_duration_ms = max(0, words[-1]["end_ms"] - words[0]["start_ms"])

    session_data.setdefault("utterances", []).append(
        {
            "text": text,
            "word_timestamps": words,
            "duration_ms": audio_duration_ms,
            "sequence": session_data.get("turn_count", 0) + 1,
        }
    )
    
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
        "transcription_confidence": confidence or None,
        "word_timestamps": words if words else None,
        "audio_duration_ms": audio_duration_ms or None,
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

    # Generate overall scores
    full_transcription = " ".join([
        turn["content"] for turn in session_data.get("conversation_history", [])
        if turn.get("role") == "user"
    ])

    scores = await error_analyzer.generate_scores(
        full_transcription,
        session_data.get("errors", [])
    )
    recommendations: list[str] = []
    pronunciation_result: dict = {}

    # Run deeper end-of-session pass to avoid "scores only" experience.
    try:
        if len(full_transcription.split()) >= 8:
            user_profile = await db_service.get_user_profile(session.get("user_id"))
            native_language = (user_profile or {}).get("native_language", "uz")
            utterances = session_data.get("utterances", [])

            hybrid_analyzer = HybridErrorAnalyzer()
            enhanced_errors = await hybrid_analyzer.full_analysis(
                text=full_transcription,
                utterances=utterances,
                native_language=native_language,
            )
            if enhanced_errors:
                session_data["errors"] = enhanced_errors

            if utterances:
                pronunciation_analyzer = PronunciationAnalyzer()
                pronunciation_result = await pronunciation_analyzer.analyze(
                    utterances=utterances,
                    native_language=native_language,
                )

            advanced_scores = await ielts_scorer.score_with_evidence(
                transcription=full_transcription,
                errors=session_data.get("errors", []),
                pronunciation_scores=pronunciation_result,
                mode=session.get("mode", "free_speaking"),
            )
            flattened_scores = _flatten_advanced_scores(advanced_scores)
            if flattened_scores:
                flattened_scores["word_count"] = len(full_transcription.split())
                flattened_scores["total_errors"] = len(session_data.get("errors", []))
                scores = flattened_scores
    except Exception:
        # Keep session end resilient: basic score path must still succeed.
        pass

    recommendations = await error_analyzer.get_improvement_suggestions(
        session_data.get("errors", []),
        scores,
    )
    recommendations = _merge_unique_texts(
        recommendations
        + _score_based_tips(scores)
        + (pronunciation_result.get("feedback", []) if isinstance(pronunciation_result, dict) else []),
        limit=6,
    )
    session_data["recommendations"] = recommendations

    # Save all errors to database (after enhanced pass)
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
            "recommendations": recommendations,
            "analysis": {
                "pronunciation": pronunciation_result,
            },
            "message": "Session completed! Check your feedback."
        }
    })
