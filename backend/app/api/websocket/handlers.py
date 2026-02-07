"""
SpeakMate AI - Legacy WebSocket Message Handlers

This module is kept for backward compatibility with earlier protocol-based
WebSocket implementation. The active production path uses
`app.api.websocket.conversation`.
"""
from __future__ import annotations

from typing import Optional
import logging

from app.api.websocket.protocol import ClientMessage, ErrorCode, ServerMessage
from app.api.websocket.session_manager import session_manager

logger = logging.getLogger(__name__)


class MessageHandler:
    """Compatibility shim for legacy message-handler imports."""

    async def handle_message(
        self,
        session_id: str,
        message: ClientMessage
    ) -> Optional[ServerMessage]:
        context = session_manager.get_session(session_id)
        if not context:
            return ServerMessage.error(0, ErrorCode.SESSION_NOT_FOUND, "Session not found")

        logger.warning(
            "Legacy handler invoked; use /ws/conversation endpoint for active flow",
            extra={"session_id": session_id, "message_type": getattr(message, "type", "unknown")},
        )
        return ServerMessage.error(
            context.increment_server_seq(),
            ErrorCode.INTERNAL_ERROR,
            "Legacy websocket handler is disabled. Use conversation websocket flow.",
        )


message_handler = MessageHandler()
