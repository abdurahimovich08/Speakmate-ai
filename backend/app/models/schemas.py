"""
SpeakMate AI - Pydantic Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID


# Enums
class SessionMode(str, Enum):
    FREE_SPEAKING = "free_speaking"
    IELTS_TEST = "ielts_test"
    TRAINING = "training"


class ErrorCategory(str, Enum):
    PRONUNCIATION = "pronunciation"
    GRAMMAR = "grammar"
    VOCABULARY = "vocabulary"
    FLUENCY = "fluency"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# User schemas
class UserProfile(BaseModel):
    id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None
    native_language: str = "uz"
    target_band: float = 7.0
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    native_language: Optional[str] = None
    target_band: Optional[float] = None


# Session schemas
class SessionCreate(BaseModel):
    mode: SessionMode = SessionMode.FREE_SPEAKING
    topic: Optional[str] = None


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    mode: SessionMode
    topic: Optional[str]
    duration_seconds: int = 0
    overall_scores: Optional[dict] = None
    created_at: datetime


class SessionSummary(BaseModel):
    id: UUID
    mode: SessionMode
    topic: Optional[str]
    duration_seconds: int
    overall_scores: Optional[dict]
    error_count: int
    created_at: datetime


# Conversation schemas
class ConversationTurn(BaseModel):
    role: MessageRole
    content: str
    transcription: Optional[str] = None
    duration_ms: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConversationMessage(BaseModel):
    role: MessageRole
    content: str
    audio_url: Optional[str] = None


# Error schemas
class DetectedError(BaseModel):
    category: ErrorCategory
    subcategory: str
    original_text: str
    corrected_text: str
    explanation: str
    confidence: float = Field(ge=0, le=1)
    timestamp_ms: int


class ErrorProfile(BaseModel):
    category: ErrorCategory
    subcategory: str
    occurrence_count: int
    improvement_rate: float
    last_occurred: datetime
    examples: List[str] = []


# Feedback schemas
class SessionFeedback(BaseModel):
    session_id: UUID
    overall_band: float
    scores: dict  # {fluency: 6.5, grammar: 6.0, ...}
    errors: List[DetectedError]
    summary: str
    recommendations: List[str]
    strengths: List[str]


class IELTSScore(BaseModel):
    fluency_coherence: float = Field(ge=0, le=9)
    lexical_resource: float = Field(ge=0, le=9)
    grammatical_range: float = Field(ge=0, le=9)
    pronunciation: float = Field(ge=0, le=9)
    overall_band: float = Field(ge=0, le=9)


# WebSocket message schemas
class WSMessage(BaseModel):
    type: str
    data: dict


class AudioChunk(BaseModel):
    audio_data: str  # base64 encoded
    sample_rate: int = 16000
    is_final: bool = False


class TranscriptionResult(BaseModel):
    text: str
    is_final: bool
    confidence: float
    alternatives: List[str] = []


# PDF Report schemas
class PDFReportRequest(BaseModel):
    session_id: UUID
    include_details: bool = True
    language: str = "en"


class PDFReportResponse(BaseModel):
    report_url: str
    generated_at: datetime
