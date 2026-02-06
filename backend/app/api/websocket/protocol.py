"""
SpeakMate AI - WebSocket Protocol Specification (Production)

This module defines the exact message format and protocol for real-time
audio streaming between client and server.
"""
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
import json


# =============================================================================
# AUDIO CONFIGURATION
# =============================================================================

class AudioEncoding(str, Enum):
    LINEAR16 = "LINEAR16"  # PCM 16-bit
    FLAC = "FLAC"
    OGG_OPUS = "OGG_OPUS"


class AudioConfig(BaseModel):
    """Audio stream configuration."""
    sample_rate_hz: int = Field(default=16000, ge=8000, le=48000)
    encoding: AudioEncoding = AudioEncoding.LINEAR16
    channels: int = Field(default=1, ge=1, le=2)
    chunk_duration_ms: int = Field(default=100, ge=20, le=500)
    enable_vad: bool = False  # Voice Activity Detection


# =============================================================================
# CLIENT → SERVER MESSAGES
# =============================================================================

class ClientMessageType(str, Enum):
    # Session lifecycle
    SESSION_START = "session.start"
    SESSION_RESUME = "session.resume"
    SESSION_END = "session.end"
    
    # Audio control
    AUDIO_CONFIG = "audio.config"
    AUDIO_COMMIT = "audio.commit"  # User finished speaking
    
    # Conversation
    TEXT_INPUT = "text.input"  # For text-based testing
    
    # Utility
    PING = "ping"
    GET_STATUS = "get_status"


class SessionMode(str, Enum):
    FREE_SPEAKING = "free_speaking"
    IELTS_TEST = "ielts_test"
    IELTS_PART1 = "ielts_part1"
    IELTS_PART2 = "ielts_part2"
    IELTS_PART3 = "ielts_part3"
    TRAINING = "training"


class ConsentFlags(BaseModel):
    """User consent for data processing."""
    audio_storage: bool = False
    transcript_storage: bool = True
    analytics: bool = True


class SessionStartPayload(BaseModel):
    """Payload for session.start message."""
    mode: SessionMode
    topic: Optional[str] = None
    ielts_part: Optional[int] = None
    locale: str = "en-US"
    device_info: Optional[Dict[str, str]] = None
    consent_flags: ConsentFlags = Field(default_factory=ConsentFlags)
    target_band: Optional[float] = None


class SessionResumePayload(BaseModel):
    """Payload for session.resume after disconnect."""
    session_id: str
    last_seq: int  # Last received sequence number


class TextInputPayload(BaseModel):
    """Payload for text input (testing mode)."""
    text: str
    simulate_audio: bool = False


class ClientMessage(BaseModel):
    """Base client message structure."""
    type: ClientMessageType
    seq: int  # Sequence number for ordering
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Optional[Dict[str, Any]] = None
    
    @classmethod
    def session_start(cls, seq: int, payload: SessionStartPayload) -> "ClientMessage":
        return cls(type=ClientMessageType.SESSION_START, seq=seq, payload=payload.dict())
    
    @classmethod
    def session_resume(cls, seq: int, session_id: str, last_seq: int) -> "ClientMessage":
        return cls(
            type=ClientMessageType.SESSION_RESUME, 
            seq=seq, 
            payload={"session_id": session_id, "last_seq": last_seq}
        )
    
    @classmethod
    def audio_config(cls, seq: int, config: AudioConfig) -> "ClientMessage":
        return cls(type=ClientMessageType.AUDIO_CONFIG, seq=seq, payload=config.dict())
    
    @classmethod
    def audio_commit(cls, seq: int) -> "ClientMessage":
        return cls(type=ClientMessageType.AUDIO_COMMIT, seq=seq)


# =============================================================================
# SERVER → CLIENT MESSAGES
# =============================================================================

class ServerMessageType(str, Enum):
    # Session lifecycle
    SESSION_STARTED = "session.started"
    SESSION_RESUMED = "session.resumed"
    SESSION_ENDED = "session.ended"
    SESSION_ERROR = "session.error"
    
    # STT results
    STT_PARTIAL = "stt.partial"
    STT_FINAL = "stt.final"
    
    # AI responses
    AI_REPLY = "ai.reply"
    AI_TYPING = "ai.typing"
    
    # TTS audio
    TTS_AUDIO = "tts.audio"
    TTS_URL = "tts.url"
    
    # Analysis events (optional, for debugging)
    ANALYSIS_EVENT = "analysis.event"
    
    # Session results
    SUMMARY_READY = "session.summary_ready"
    ANALYSIS_READY = "session.analysis_ready"
    
    # Utility
    PONG = "pong"
    STATUS = "status"
    
    # IELTS specific
    IELTS_TIMER = "ielts.timer"
    IELTS_CUE_CARD = "ielts.cue_card"
    IELTS_NEXT_PART = "ielts.next_part"


class WordTimestamp(BaseModel):
    """Word with timing information."""
    word: str
    start_ms: int
    end_ms: int
    confidence: float = Field(ge=0, le=1)


class STTPartialPayload(BaseModel):
    """Partial (interim) transcription result."""
    text: str
    stability: float = Field(ge=0, le=1)
    timestamp_ms: int


class STTFinalPayload(BaseModel):
    """Final transcription result with word-level details."""
    text: str
    words: List[WordTimestamp]
    confidence: float = Field(ge=0, le=1)
    duration_ms: int
    alternatives: List[str] = []


class AIReplyPayload(BaseModel):
    """AI response to user."""
    text: str
    turn_id: str
    response_type: str = "conversation"  # conversation, follow_up, transition


class AnalysisEventPayload(BaseModel):
    """Real-time analysis event (debug mode only)."""
    event_type: str  # error_detected, fluency_marker, etc.
    category: Optional[str] = None
    details: Dict[str, Any] = {}


class SummaryReadyPayload(BaseModel):
    """Quick summary is ready."""
    summary_id: str
    overall_band: Optional[float] = None
    error_count: int
    duration_seconds: int
    highlights: List[str] = []


class IELTSTimerPayload(BaseModel):
    """IELTS timer update."""
    part: int
    phase: str  # preparation, speaking
    remaining_seconds: int
    total_seconds: int


class ServerMessage(BaseModel):
    """Base server message structure."""
    type: ServerMessageType
    seq: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Optional[Dict[str, Any]] = None
    
    def to_json(self) -> str:
        return self.json()
    
    @classmethod
    def session_started(cls, seq: int, session_id: str, mode: str) -> "ServerMessage":
        return cls(
            type=ServerMessageType.SESSION_STARTED,
            seq=seq,
            payload={"session_id": session_id, "mode": mode, "status": "active"}
        )
    
    @classmethod
    def stt_partial(cls, seq: int, text: str, stability: float) -> "ServerMessage":
        return cls(
            type=ServerMessageType.STT_PARTIAL,
            seq=seq,
            payload={"text": text, "stability": stability, "timestamp_ms": int(datetime.utcnow().timestamp() * 1000)}
        )
    
    @classmethod
    def stt_final(cls, seq: int, payload: STTFinalPayload) -> "ServerMessage":
        return cls(type=ServerMessageType.STT_FINAL, seq=seq, payload=payload.dict())
    
    @classmethod
    def ai_reply(cls, seq: int, text: str, turn_id: str) -> "ServerMessage":
        return cls(
            type=ServerMessageType.AI_REPLY,
            seq=seq,
            payload={"text": text, "turn_id": turn_id}
        )
    
    @classmethod
    def error(cls, seq: int, code: str, message: str) -> "ServerMessage":
        return cls(
            type=ServerMessageType.SESSION_ERROR,
            seq=seq,
            payload={"code": code, "message": message}
        )


# =============================================================================
# SESSION STATE MACHINE
# =============================================================================

class SessionState(str, Enum):
    """Session state for deterministic state management."""
    INITIALIZING = "initializing"
    READY = "ready"
    LISTENING = "listening"
    PROCESSING = "processing"
    AI_SPEAKING = "ai_speaking"
    PAUSED = "paused"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    ERROR = "error"


class SessionContext(BaseModel):
    """Full session context for state recovery."""
    session_id: str
    user_id: str
    state: SessionState
    mode: SessionMode
    topic: Optional[str]
    
    # Sequence tracking
    client_seq: int = 0
    server_seq: int = 0
    
    # Conversation state
    turn_count: int = 0
    total_duration_ms: int = 0
    
    # IELTS specific
    ielts_part: Optional[int] = None
    ielts_question_index: int = 0
    
    # Timestamps
    started_at: datetime
    last_activity_at: datetime
    
    # Audio stats
    audio_chunks_received: int = 0
    total_audio_ms: int = 0
    
    def increment_server_seq(self) -> int:
        self.server_seq += 1
        return self.server_seq
    
    def to_recovery_payload(self) -> Dict[str, Any]:
        """Data needed for session recovery after disconnect."""
        return {
            "session_id": self.session_id,
            "state": self.state.value,
            "turn_count": self.turn_count,
            "client_seq": self.client_seq,
            "server_seq": self.server_seq,
            "ielts_part": self.ielts_part,
            "ielts_question_index": self.ielts_question_index,
        }


# =============================================================================
# ERROR CODES
# =============================================================================

class ErrorCode(str, Enum):
    """Standardized error codes."""
    # Session errors
    SESSION_NOT_FOUND = "E001"
    SESSION_EXPIRED = "E002"
    SESSION_ALREADY_ACTIVE = "E003"
    
    # Auth errors
    AUTH_REQUIRED = "E101"
    AUTH_INVALID = "E102"
    AUTH_EXPIRED = "E103"
    
    # Quota errors
    QUOTA_EXCEEDED = "E201"
    RATE_LIMITED = "E202"
    
    # Audio errors
    AUDIO_FORMAT_INVALID = "E301"
    AUDIO_TOO_LONG = "E302"
    STT_FAILED = "E303"
    
    # Processing errors
    AI_UNAVAILABLE = "E401"
    ANALYSIS_FAILED = "E402"
    
    # Internal errors
    INTERNAL_ERROR = "E500"


# =============================================================================
# PROTOCOL HELPERS
# =============================================================================

def parse_client_message(data: str) -> ClientMessage:
    """Parse JSON string to ClientMessage."""
    try:
        parsed = json.loads(data)
        return ClientMessage(**parsed)
    except Exception as e:
        raise ValueError(f"Invalid message format: {e}")


def is_binary_message(data: bytes) -> bool:
    """Check if message is binary audio data."""
    # Binary audio doesn't start with '{' (JSON)
    return len(data) > 0 and data[0] != ord('{')


class ProtocolVersion:
    """Protocol version for compatibility."""
    MAJOR = 1
    MINOR = 0
    PATCH = 0
    
    @classmethod
    def string(cls) -> str:
        return f"{cls.MAJOR}.{cls.MINOR}.{cls.PATCH}"
