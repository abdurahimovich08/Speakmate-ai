"""
SpeakMate AI - WebSocket Conversation Handler (Production)

Full pipeline:
- HybridErrorAnalyzer for error detection
- PronunciationEngine for prosody analysis
- RealtimeCoach for in-session coaching tips
- AnalysisCoordinator for end-of-session deep analysis
- ConversationService with 3 coaching modes
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional, List, Dict
import json
import asyncio
import base64
import logging
from datetime import datetime

from app.core.config import settings
from app.db.supabase import db_service
from app.services.speech import SpeechService
from app.services.conversation import ConversationService
from app.services.hybrid_analyzer import HybridErrorAnalyzer
from app.services.pronunciation_engine import PronunciationAnalyzer
from app.services.realtime_coach import RealtimeCoach
from app.services.analysis_coordinator import AnalysisCoordinator

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections and session state."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.session_data: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_data[session_id] = {
            "conversation_history": [],
            "errors": [],
            "utterances": [],      # word-level data for pronunciation
            "coaching_tips": [],   # tips given during session
            "turn_count": 0,
            "start_time": datetime.utcnow(),
        }

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)
        self.session_data.pop(session_id, None)

    async def send_message(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(message)

    def get(self, session_id: str) -> dict:
        return self.session_data.get(session_id, {})

    def update(self, session_id: str, data: dict):
        if session_id in self.session_data:
            self.session_data[session_id].update(data)


manager = ConnectionManager()


def _extract_ws_token(websocket: WebSocket, query_token: Optional[str]) -> Optional[str]:
    """Extract auth token from query param or Sec-WebSocket-Protocol header."""
    if query_token:
        return query_token
    # Fallback: check Authorization-style header forwarded by some proxies
    auth_header = websocket.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


@router.websocket("/ws/conversation/{session_id}")
async def conversation_websocket(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time conversation.

    Auth: supply token via ?token= query param or Authorization header.

    Message types from client:
      - audio_chunk: base64 audio
      - text_input:  direct text (testing)
      - end_session: end conversation
      - get_status:  session status
    """
    ws_token = _extract_ws_token(websocket, token)
    if ws_token:
        try:
            from app.core.security import verify_supabase_token_string
            verify_supabase_token_string(ws_token)
        except Exception as e:
            logger.warning(f"WebSocket auth failed: {e}")
            await websocket.close(code=4001, reason="Authentication failed")
            return

    await manager.connect(websocket, session_id)

    # ---- Services ----
    speech_service = SpeechService()
    conversation_service = ConversationService()
    error_analyzer = HybridErrorAnalyzer()
    pronunciation = PronunciationAnalyzer()
    coach = RealtimeCoach()
    analysis_coordinator = AnalysisCoordinator()

    # ---- Load session from DB ----
    session = await db_service.get_session(session_id)
    if not session:
        await websocket.send_json({
            "type": "error",
            "data": {"message": "Session not found"},
        })
        await websocket.close()
        return

    # ---- Load user profile for adaptive coaching ----
    user_id = session.get("user_id", "")
    user_profile = await _load_user_profile(user_id)
    user_level = ConversationService.band_to_cefr(user_profile.get("avg_band", 6.0))
    target_band = user_profile.get("target_band", 7.0)
    error_profile_summary = user_profile.get("error_profile_summary", "")
    mode = session.get("mode", "free_speaking")

    # ---- Send connected ----
    await manager.send_message(session_id, {
        "type": "connected",
        "data": {
            "session_id": session_id,
            "mode": mode,
            "topic": session.get("topic"),
            "user_level": user_level,
            "message": "Connected! Ready to start.",
        },
    })

    # ---- Initial AI greeting ----
    topic = session.get("topic", "general conversation")
    initial_response = await conversation_service.generate_greeting(
        topic=topic,
        mode=mode,
        user_name=user_profile.get("full_name", ""),
    )

    await manager.send_message(session_id, {
        "type": "ai_message",
        "data": {"text": initial_response, "role": "assistant"},
    })

    sd = manager.get(session_id)
    sd["conversation_history"].append({"role": "assistant", "content": initial_response})
    sd["turn_count"] = 1

    # ---- Main loop ----
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            payload = data.get("data", {})

            if msg_type == "audio_chunk":
                audio_data = payload.get("audio_data")
                is_final = payload.get("is_final", False)

                if audio_data:
                    audio_bytes = base64.b64decode(audio_data)
                    transcription = await speech_service.transcribe_audio(
                        audio_bytes, is_final=is_final
                    )

                    if transcription and transcription.get("text"):
                        # Send transcription to client
                        await manager.send_message(session_id, {
                            "type": "transcription",
                            "data": {
                                "text": transcription["text"],
                                "is_final": transcription.get("is_final", False),
                                "confidence": transcription.get("confidence", 0),
                            },
                        })

                        # Collect utterance data for pronunciation analysis
                        if transcription.get("is_final"):
                            _collect_utterance(sd, transcription)

                            await _process_user_message(
                                session_id=session_id,
                                text=transcription["text"],
                                session=session,
                                mode=mode,
                                conversation_service=conversation_service,
                                error_analyzer=error_analyzer,
                                coach=coach,
                                user_level=user_level,
                                target_band=target_band,
                                error_profile_summary=error_profile_summary,
                            )

            elif msg_type == "text_input":
                text = payload.get("text", "")
                if text:
                    await _process_user_message(
                        session_id=session_id,
                        text=text,
                        session=session,
                        mode=mode,
                        conversation_service=conversation_service,
                        error_analyzer=error_analyzer,
                        coach=coach,
                        user_level=user_level,
                        target_band=target_band,
                        error_profile_summary=error_profile_summary,
                    )

            elif msg_type == "end_session":
                await _end_conversation(
                    session_id, session, analysis_coordinator,
                    pronunciation, user_id, mode, coach,
                )
                break

            elif msg_type == "get_status":
                sd = manager.get(session_id)
                await manager.send_message(session_id, {
                    "type": "status",
                    "data": {
                        "turn_count": sd.get("turn_count", 0),
                        "error_count": len(sd.get("errors", [])),
                        "coaching_tips_given": len(sd.get("coaching_tips", [])),
                        "duration_seconds": (
                            datetime.utcnow() - sd.get("start_time", datetime.utcnow())
                        ).seconds,
                    },
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
        try:
            await _end_conversation(
                session_id, session, analysis_coordinator,
                pronunciation, user_id, mode, coach,
            )
        except Exception as e:
            logger.error(f"Error ending session on disconnect: {e}")
    finally:
        manager.disconnect(session_id)


# =====================================================================
# Message processing
# =====================================================================
async def _process_user_message(
    session_id: str,
    text: str,
    session: dict,
    mode: str,
    conversation_service: ConversationService,
    error_analyzer: HybridErrorAnalyzer,
    coach: RealtimeCoach,
    user_level: str,
    target_band: float,
    error_profile_summary: str,
):
    """Process a user message: analyze errors, generate AI response, coach."""
    sd = manager.get(session_id)

    # 1. Add user message to history
    sd["conversation_history"].append({"role": "user", "content": text})

    # 2. Analyze for errors (quick rule-based + LLM)
    try:
        errors = await error_analyzer.quick_analysis(text)
        sd["errors"].extend(errors)
    except Exception as e:
        logger.error(f"Error analysis failed: {e}")
        errors = []

    # 3. Real-time coaching tip
    tip = coach.on_user_turn(errors)
    if tip:
        sd["coaching_tips"].append(tip)
        await manager.send_message(session_id, {
            "type": "coaching_tip",
            "data": tip,
        })

    # 4. Build recent errors summary for the coaching prompt
    recent_errors_text = ""
    if errors:
        recent_items = errors[-3:]  # last 3 errors
        recent_errors_text = "; ".join(
            f"{e.get('category')}: \"{e.get('original_text')}\" → \"{e.get('corrected_text')}\""
            for e in recent_items
        )

    # 5. Generate AI response (mode-aware)
    sd["turn_count"] += 1
    response = await conversation_service.generate_response(
        user_message=text,
        conversation_history=sd["conversation_history"],
        topic=session.get("topic", "general"),
        mode=mode,
        user_level=user_level,
        target_band=target_band,
        error_profile=error_profile_summary,
        recent_errors=recent_errors_text,
        turn_number=sd["turn_count"],
    )

    # 6. Add AI response to history
    sd["conversation_history"].append({"role": "assistant", "content": response})

    # 7. Send AI response
    await manager.send_message(session_id, {
        "type": "ai_message",
        "data": {
            "text": response,
            "role": "assistant",
            "turn_number": sd["turn_count"],
        },
    })

    # 7b. Generate and send TTS audio for the AI response (non-blocking)
    try:
        tts_service = SpeechService()
        if tts_service.tts_client and len(response) < 500:
            audio_bytes = await tts_service.synthesize_speech(
                response,
                voice_name="en-US-Neural2-F",
                speaking_rate=0.95,
            )
            if audio_bytes:
                import base64 as b64mod
                await manager.send_message(session_id, {
                    "type": "ai_audio",
                    "data": {
                        "audio": b64mod.b64encode(audio_bytes).decode("utf-8"),
                        "format": "mp3",
                    },
                })
    except Exception as e:
        logger.debug(f"TTS skipped: {e}")

    # 8. Save turns to DB
    try:
        await db_service.save_conversation_turn(session_id, {
            "role": "user",
            "content": text,
            "transcription": text,
            "sequence_order": sd["turn_count"] * 2 - 1,
        })
        await db_service.save_conversation_turn(session_id, {
            "role": "assistant",
            "content": response,
            "sequence_order": sd["turn_count"] * 2,
        })
    except Exception as e:
        logger.error(f"Failed to save turns: {e}")


# =====================================================================
# End session
# =====================================================================
async def _end_conversation(
    session_id: str,
    session: dict,
    analysis_coordinator: AnalysisCoordinator,
    pronunciation: PronunciationAnalyzer,
    user_id: str,
    mode: str,
    coach: RealtimeCoach,
):
    """End conversation — run deep analysis and send final results."""
    sd = manager.get(session_id)
    if not sd:
        return

    start_time = sd.get("start_time", datetime.utcnow())
    duration_seconds = (datetime.utcnow() - start_time).seconds

    # Full user transcription
    full_transcription = " ".join(
        t["content"] for t in sd.get("conversation_history", []) if t.get("role") == "user"
    )

    utterances = sd.get("utterances", [])
    native_language = session.get("native_language", "uz")

    # ---- Deep analysis via AnalysisCoordinator ----
    try:
        result = await analysis_coordinator.run_deep_analysis(
            session_id=session_id,
            user_id=user_id,
            transcription=full_transcription,
            utterances=utterances if utterances else None,
            mode=mode,
            native_language=native_language,
        )
        scores = result.get("scores", {})
        all_errors = result.get("errors", sd.get("errors", []))
        pronunciation_data = result.get("pronunciation", {})
        recommendations = result.get("recommendations", [])
        training_plan = result.get("training_plan", {})
    except Exception as e:
        logger.error(f"Deep analysis failed, using fast fallback: {e}")
        # Fallback to fast analysis
        try:
            result = await analysis_coordinator.run_fast_analysis(
                session_id=session_id,
                user_id=user_id,
                transcription=full_transcription,
                utterances=utterances if utterances else None,
                mode=mode,
            )
            scores = {
                "overall_band": result.get("band_estimate", 5.5),
                "fluency_coherence": {"band": result.get("band_estimate", 5.5)},
                "lexical_resource": {"band": result.get("band_estimate", 5.5)},
                "grammatical_range": {"band": result.get("band_estimate", 5.5)},
                "pronunciation": {"band": result.get("band_estimate", 5.5)},
            }
            all_errors = sd.get("errors", [])
            pronunciation_data = {}
            recommendations = []
            training_plan = {}
        except Exception as e2:
            logger.error(f"Fast analysis also failed: {e2}")
            scores = {"overall_band": 5.5}
            all_errors = sd.get("errors", [])
            pronunciation_data = {}
            recommendations = []
            training_plan = {}

    # ---- Update session in DB ----
    try:
        await db_service.update_session(session_id, {
            "duration_seconds": duration_seconds,
            "overall_scores": scores,
            "ended_at": datetime.utcnow().isoformat(),
        })
    except Exception as e:
        logger.error(f"Failed to update session: {e}")

    # ---- Save errors to DB ----
    if all_errors:
        try:
            # Format errors for the existing detected_errors table
            formatted = []
            for err in all_errors:
                formatted.append({
                    "category": err.get("category", "grammar"),
                    "subcategory": err.get("subcategory", "general"),
                    "original_text": err.get("original_text", ""),
                    "corrected_text": err.get("corrected_text", ""),
                    "explanation": err.get("explanation", ""),
                    "confidence": err.get("confidence", 0.8),
                    "timestamp_ms": err.get("timestamp_ms", 0),
                })
            await db_service.save_detected_errors(session_id, formatted)
        except Exception as e:
            logger.error(f"Failed to save errors: {e}")

        # Update user error profile
        try:
            for err in all_errors:
                await db_service.update_error_profile(
                    user_id,
                    err.get("category", "grammar"),
                    err.get("subcategory", "general"),
                )
        except Exception as e:
            logger.error(f"Failed to update error profile: {e}")

    # ---- Coaching summary ----
    coaching_summary = coach.get_session_summary()

    # ---- Send session_ended with rich data ----
    await manager.send_message(session_id, {
        "type": "session_ended",
        "data": {
            "duration_seconds": duration_seconds,
            "turn_count": sd.get("turn_count", 0),
            "total_errors": len(all_errors),
            "scores": scores,
            "errors": all_errors[:20],  # limit to 20 for WS payload size
            "pronunciation": pronunciation_data,
            "recommendations": recommendations,
            "training_plan": training_plan,
            "coaching_summary": coaching_summary,
            "coaching_tips": sd.get("coaching_tips", []),
            "message": "Session completed! Check your detailed feedback.",
        },
    })

    # ---- Send Telegram notification if user has telegram_id ----
    try:
        user_profile = await db_service.get_user_profile(user_id)
        telegram_id = (user_profile or {}).get("telegram_id")
        if telegram_id:
            from app.telegram.notifications import send_session_result
            overall = scores.get("overall_band", 0)
            if isinstance(scores.get("fluency_coherence"), dict):
                flat_scores = {
                    "overall_band": overall,
                    "fluency_coherence": scores["fluency_coherence"].get("band", 0),
                    "lexical_resource": scores.get("lexical_resource", {}).get("band", 0),
                    "grammatical_range": scores.get("grammatical_range", {}).get("band", 0),
                    "pronunciation": scores.get("pronunciation", {}).get("band", 0),
                }
            else:
                flat_scores = scores
            await send_session_result(
                telegram_id=telegram_id,
                session_id=session_id,
                scores=flat_scores,
                duration_seconds=duration_seconds,
                error_count=len(all_errors),
            )
    except Exception as e:
        logger.warning(f"Failed to send Telegram notification: {e}")


# =====================================================================
# Helpers
# =====================================================================
def _collect_utterance(sd: dict, transcription: dict):
    """Collect utterance data for pronunciation engine."""
    utterance = {
        "text": transcription.get("text", ""),
        "confidence": transcription.get("confidence", 0),
        "word_timestamps": [],
    }
    for word_info in transcription.get("words", []):
        utterance["word_timestamps"].append({
            "word": word_info.get("word", ""),
            "start_ms": int(word_info.get("start_time", 0) * 1000),
            "end_ms": int(word_info.get("end_time", 0) * 1000),
        })
    sd["utterances"].append(utterance)


async def _load_user_profile(user_id: str) -> dict:
    """Load user profile with stats for adaptive coaching."""
    profile = {
        "full_name": "",
        "target_band": 7.0,
        "avg_band": 6.0,
        "error_profile_summary": "",
    }
    try:
        user = await db_service.get_user_profile(user_id)
        if user:
            profile["full_name"] = user.get("full_name", "")
            profile["target_band"] = user.get("target_band", 7.0)

        # Get recent sessions for average band
        sessions = await db_service.get_user_sessions(user_id, limit=10)
        bands = []
        for s in sessions:
            sc = s.get("overall_scores")
            if sc:
                if isinstance(sc, dict):
                    b = sc.get("overall_band")
                    if b:
                        bands.append(float(b))
        if bands:
            profile["avg_band"] = sum(bands) / len(bands)

        # Get error profile summary
        error_profile = await db_service.get_user_error_profile(user_id)
        if error_profile:
            top_errors = error_profile[:5]
            profile["error_profile_summary"] = ", ".join(
                f"{e.get('category')}/{e.get('subcategory')} ({e.get('occurrence_count', 0)}x)"
                for e in top_errors
            )

    except Exception as e:
        logger.warning(f"Failed to load user profile: {e}")

    return profile
