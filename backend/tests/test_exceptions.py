"""Tests for custom exception hierarchy."""

from app.core.exceptions import (
    SpeakMateError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    ValidationError,
    QuotaExceededError,
    ExternalServiceError,
    AIServiceError,
    DatabaseError,
    AnalysisError,
    ScoringError,
    SessionError,
    SessionNotFoundError,
    SessionAlreadyEndedError,
)


def test_base_exception_defaults():
    exc = SpeakMateError()
    assert exc.status_code == 500
    assert exc.detail == "An internal error occurred"


def test_custom_detail_message():
    exc = SpeakMateError("Something broke")
    assert exc.detail == "Something broke"
    assert str(exc) == "Something broke"


def test_authentication_error():
    exc = AuthenticationError()
    assert exc.status_code == 401


def test_authorization_error():
    exc = AuthorizationError()
    assert exc.status_code == 403


def test_not_found_error():
    exc = NotFoundError("Session not found")
    assert exc.status_code == 404


def test_conflict_error():
    assert ConflictError.status_code == 409


def test_validation_error():
    assert ValidationError.status_code == 422


def test_quota_exceeded():
    assert QuotaExceededError.status_code == 429


def test_external_service_error():
    assert ExternalServiceError.status_code == 502


def test_ai_service_inherits_external():
    assert issubclass(AIServiceError, ExternalServiceError)


def test_database_error():
    assert DatabaseError.status_code == 503


def test_analysis_error():
    assert AnalysisError.status_code == 500


def test_scoring_inherits_analysis():
    assert issubclass(ScoringError, AnalysisError)


def test_session_error():
    assert SessionError.status_code == 400


def test_session_not_found_inherits():
    assert issubclass(SessionNotFoundError, NotFoundError)


def test_session_already_ended():
    assert issubclass(SessionAlreadyEndedError, ConflictError)


def test_extra_kwargs_stored():
    exc = SpeakMateError("test", user_id="abc", action="read")
    assert exc.extra["user_id"] == "abc"
    assert exc.extra["action"] == "read"
