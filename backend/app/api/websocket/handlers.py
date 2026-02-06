"""
SpeakMate AI - WebSocket Message Handlers (Production)

Handles all WebSocket message types with proper error handling and state management.
"""
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import base64
import logging

from app.api.websocket.protocol import (
    ClientMessage, ClientMessageType, ServerMessage, ServerMessageType,
    SessionStartPayload, SessionResumePayload, AudioConfig,
    SessionState, SessionMode, ErrorCode, STTFinalPayload, WordTimestamp
)
from app.api.websocket.session_manager import session_manager, SessionContext
from app.services.speech_streaming import SpeechStreamService
from app.services.conversation_orchestrator import ConversationOrchestrator
from app.services.analysis_coordinator import AnalysisCoordinator
from app.services.quota_service import QuotaService

logger = logging.getLogger(__name__)


class MessageHandler:
    """
    Handles incoming WebSocket messages with proper state transitions.
    """
    
    def __init__(self):
        self.speech_service = SpeechStreamService()
        self.conversation = ConversationOrchestrator()
        self.analyzer = AnalysisCoordinator()
        self.quota = QuotaService()
    
    async def handle_message(
        self,
        session_id: str,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        """Route message to appropriate handler."""
        
        context = session_manager.get_session(session_id)
        if not context:
            return ServerMessage.error(0, ErrorCode.SESSION_NOT_FOUND, "Session not found")
        
        # Update sequence tracking
        context.client_seq = message.seq
        
        handlers = {
            ClientMessageType.AUDIO_CONFIG: self._handle_audio_config,
            ClientMessageType.AUDIO_COMMIT: self._handle_audio_commit,
            ClientMessageType.TEXT_INPUT: self._handle_text_input,
            ClientMessageType.SESSION_END: self._handle_session_end,
            ClientMessageType.PING: self._handle_ping,
            ClientMessageType.GET_STATUS: self._handle_get_status,
        }
        
        handler = handlers.get(message.type)
        if handler:
            return await handler(context, message)
        
        return None
    
    async def handle_session_start(
        self,
        websocket,
        user_id: str,
        payload: SessionStartPayload
    ) -> SessionContext:
        """Handle session start request."""
        
        # Check quota
        quota_check = await self.quota.check_session_quota(user_id)
        if not quota_check["allowed"]:
            raise ValueError(f"Quota exceeded: {quota_check['reason']}")
        
        # Create session
        context = await session_manager.create_session(
            websocket=websocket,
            user_id=user_id,
            mode=payload.mode,
            topic=payload.topic,
            ielts_part=payload.ielts_part
        )
        
        # Initialize services for session
        await self.speech_service.initialize_session(context.session_id)
        await self.conversation.initialize_session(
            session_id=context.session_id,
            mode=payload.mode,
            topic=payload.topic,
            locale=payload.locale
        )
        
        # Send session started message
        seq = context.increment_server_seq()
        started_msg = ServerMessage.session_started(
            seq=seq,
            session_id=context.session_id,
            mode=payload.mode.value
        )
        await session_manager.send_message(context.session_id, started_msg)
        
        # Generate and send initial greeting
        greeting = await self.conversation.generate_greeting(context.session_id)
        seq = context.increment_server_seq()
        greeting_msg = ServerMessage.ai_reply(
            seq=seq,
            text=greeting,
            turn_id=f"turn_0_{context.session_id}"
        )
        await session_manager.send_message(context.session_id, greeting_msg)
        
        # Update state
        session_manager.update_state(context.session_id, SessionState.READY)
        
        return context
    
    async def handle_session_resume(
        self,
        websocket,
        payload: SessionResumePayload
    ) -> Optional[SessionContext]:
        """Handle session resume request."""
        
        context = await session_manager.resume_session(
            websocket=websocket,
            session_id=payload.session_id,
            last_seq=payload.last_seq
        )
        
        if context:
            # Send resume confirmation
            seq = context.increment_server_seq()
            resumed_msg = ServerMessage(
                type=ServerMessageType.SESSION_RESUMED,
                seq=seq,
                payload=context.to_recovery_payload()
            )
            await session_manager.send_message(context.session_id, resumed_msg)
        
        return context
    
    async def handle_audio_chunk(
        self,
        session_id: str,
        audio_data: bytes
    ):
        """Handle incoming audio chunk."""
        
        context = session_manager.get_session(session_id)
        if not context:
            return
        
        # Update state
        session_manager.update_state(session_id, SessionState.LISTENING)
        
        # Record statistics
        chunk_duration_ms = len(audio_data) // 32  # Approximate for 16kHz 16-bit
        session_manager.record_audio_chunk(session_id, chunk_duration_ms)
        
        # Process through STT
        result = await self.speech_service.process_audio_chunk(
            session_id=session_id,
            audio_data=audio_data
        )
        
        if result:
            seq = context.increment_server_seq()
            
            if result.get("is_final"):
                # Final transcription
                words = [
                    WordTimestamp(
                        word=w["word"],
                        start_ms=w.get("start_ms", 0),
                        end_ms=w.get("end_ms", 0),
                        confidence=w.get("confidence", 0.9)
                    )
                    for w in result.get("words", [])
                ]
                
                final_payload = STTFinalPayload(
                    text=result["text"],
                    words=words,
                    confidence=result.get("confidence", 0.9),
                    duration_ms=result.get("duration_ms", 0)
                )
                
                msg = ServerMessage.stt_final(seq, final_payload)
            else:
                # Partial transcription
                msg = ServerMessage.stt_partial(
                    seq=seq,
                    text=result["text"],
                    stability=result.get("stability", 0.5)
                )
            
            await session_manager.send_message(session_id, msg)
    
    async def _handle_audio_config(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        """Handle audio configuration."""
        
        try:
            config = AudioConfig(**message.payload)
            await self.speech_service.configure_audio(
                session_id=context.session_id,
                config=config
            )
            logger.info(f"Audio config set for session {context.session_id}")
            return None
        except Exception as e:
            logger.error(f"Audio config error: {e}")
            return ServerMessage.error(
                context.increment_server_seq(),
                ErrorCode.AUDIO_FORMAT_INVALID,
                str(e)
            )
    
    async def _handle_audio_commit(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        """Handle user finished speaking."""
        
        session_manager.update_state(context.session_id, SessionState.PROCESSING)
        
        # Get final transcription
        final_text = await self.speech_service.finalize_utterance(context.session_id)
        
        if not final_text:
            return None
        
        # Start background analysis (non-blocking)
        asyncio.create_task(
            self.analyzer.analyze_utterance_async(
                session_id=context.session_id,
                text=final_text,
                audio_features=await self.speech_service.get_audio_features(context.session_id)
            )
        )
        
        # Generate AI response
        session_manager.update_state(context.session_id, SessionState.PROCESSING)
        
        # Send typing indicator
        seq = context.increment_server_seq()
        typing_msg = ServerMessage(
            type=ServerMessageType.AI_TYPING,
            seq=seq,
            payload={"is_typing": True}
        )
        await session_manager.send_message(context.session_id, typing_msg)
        
        # Generate response
        response = await self.conversation.generate_response(
            session_id=context.session_id,
            user_message=final_text
        )
        
        # Increment turn
        session_manager.increment_turn(context.session_id)
        
        # Send AI reply
        seq = context.increment_server_seq()
        reply_msg = ServerMessage.ai_reply(
            seq=seq,
            text=response,
            turn_id=f"turn_{context.turn_count}_{context.session_id}"
        )
        await session_manager.send_message(context.session_id, reply_msg)
        
        # Update state
        session_manager.update_state(context.session_id, SessionState.READY)
        
        return None
    
    async def _handle_text_input(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        """Handle text input (for testing)."""
        
        text = message.payload.get("text", "")
        if not text:
            return None
        
        # Process as if it were transcribed speech
        session_manager.update_state(context.session_id, SessionState.PROCESSING)
        
        # Background analysis
        asyncio.create_task(
            self.analyzer.analyze_utterance_async(
                session_id=context.session_id,
                text=text,
                audio_features=None  # No audio for text input
            )
        )
        
        # Generate response
        response = await self.conversation.generate_response(
            session_id=context.session_id,
            user_message=text
        )
        
        session_manager.increment_turn(context.session_id)
        
        seq = context.increment_server_seq()
        return ServerMessage.ai_reply(
            seq=seq,
            text=response,
            turn_id=f"turn_{context.turn_count}_{context.session_id}"
        )
    
    async def _handle_session_end(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        """Handle session end request."""
        
        session_manager.update_state(context.session_id, SessionState.ANALYZING)
        
        # End session
        result = await session_manager.end_session(context.session_id)
        
        # Trigger fast analysis
        fast_summary = await self.analyzer.generate_fast_summary(context.session_id)
        
        # Queue deep analysis
        await self.analyzer.queue_deep_analysis(context.session_id)
        
        # Send summary ready
        seq = context.increment_server_seq()
        summary_msg = ServerMessage(
            type=ServerMessageType.SUMMARY_READY,
            seq=seq,
            payload={
                "summary_id": f"summary_{context.session_id}",
                "overall_band": fast_summary.get("overall_band"),
                "error_count": fast_summary.get("error_count", 0),
                "duration_seconds": int(context.total_duration_ms / 1000),
                "highlights": fast_summary.get("highlights", [])
            }
        )
        await session_manager.send_message(context.session_id, summary_msg)
        
        # Send session ended
        seq = context.increment_server_seq()
        return ServerMessage(
            type=ServerMessageType.SESSION_ENDED,
            seq=seq,
            payload={
                "session_id": context.session_id,
                "status": "completed",
                "analysis_status": "processing"
            }
        )
    
    async def _handle_ping(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> ServerMessage:
        """Handle ping message."""
        return ServerMessage(
            type=ServerMessageType.PONG,
            seq=context.increment_server_seq(),
            payload={"timestamp": datetime.utcnow().isoformat()}
        )
    
    async def _handle_get_status(
        self,
        context: SessionContext,
        message: ClientMessage
    ) -> ServerMessage:
        """Handle status request."""
        return ServerMessage(
            type=ServerMessageType.STATUS,
            seq=context.increment_server_seq(),
            payload={
                "session_id": context.session_id,
                "state": context.state.value,
                "turn_count": context.turn_count,
                "duration_ms": context.total_duration_ms,
                "audio_chunks": context.audio_chunks_received
            }
        )


# Global handler instance
message_handler = MessageHandler()
