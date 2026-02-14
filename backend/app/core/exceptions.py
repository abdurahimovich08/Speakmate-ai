"""
SpeakMate AI - Custom Exception Hierarchy

Provides structured error handling across the application.
All exceptions inherit from SpeakMateError for consistent handling.
"""


class SpeakMateError(Exception):
    """Base exception for all SpeakMate errors."""
    status_code: int = 500
    detail: str = "An internal error occurred"

    def __init__(self, detail: str = None, **kwargs):
        self.detail = detail or self.__class__.detail
        self.extra = kwargs
        super().__init__(self.detail)


# ---- Authentication / Authorization ----

class AuthenticationError(SpeakMateError):
    status_code = 401
    detail = "Authentication required"


class AuthorizationError(SpeakMateError):
    status_code = 403
    detail = "You do not have permission to perform this action"


# ---- Resource errors ----

class NotFoundError(SpeakMateError):
    status_code = 404
    detail = "Resource not found"


class ConflictError(SpeakMateError):
    status_code = 409
    detail = "Resource conflict"


# ---- Validation ----

class ValidationError(SpeakMateError):
    status_code = 422
    detail = "Validation failed"


# ---- Rate limiting / quotas ----

class QuotaExceededError(SpeakMateError):
    status_code = 429
    detail = "Quota exceeded. Please try again later."


# ---- External services ----

class ExternalServiceError(SpeakMateError):
    """Google Cloud, Supabase, Redis, etc."""
    status_code = 502
    detail = "An external service is temporarily unavailable"


class AIServiceError(ExternalServiceError):
    detail = "AI service error"


class SpeechServiceError(ExternalServiceError):
    detail = "Speech service error"


class DatabaseError(ExternalServiceError):
    status_code = 503
    detail = "Database error"


# ---- Analysis ----

class AnalysisError(SpeakMateError):
    status_code = 500
    detail = "Analysis failed"


class ScoringError(AnalysisError):
    detail = "IELTS scoring failed"


# ---- Session ----

class SessionError(SpeakMateError):
    status_code = 400
    detail = "Session error"


class SessionNotFoundError(NotFoundError):
    detail = "Session not found"


class SessionAlreadyEndedError(ConflictError):
    detail = "Session has already ended"
