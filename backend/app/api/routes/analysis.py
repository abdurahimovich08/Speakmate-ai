"""
SpeakMate AI - Analysis Routes

Endpoints for session analysis and reports.
Supports both current and legacy schema field names.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.supabase import db_service
from app.workers.queue_config import QueueManager

router = APIRouter(prefix="/analysis", tags=["analysis"])


class ReanalysisRequest(BaseModel):
    analysis_type: Optional[str] = "deep"


def _run_type(run: dict) -> Optional[str]:
    return run.get("run_type") or run.get("analysis_type")


def _run_result(run: dict) -> dict:
    result = run.get("results")
    if result is None:
        result = run.get("result")
    return result if isinstance(result, dict) else {}


def _run_scores(run: dict) -> dict:
    scores = run.get("scores")
    if isinstance(scores, dict):
        return scores
    return _run_result(run).get("scores", {})


def _normalize_session_scores(session: dict) -> dict:
    scores = session.get("overall_scores")
    if isinstance(scores, dict):
        return scores

    legacy = {
        "overall_band": session.get("overall_score"),
        "fluency_coherence": session.get("fluency_score"),
        "lexical_resource": session.get("vocabulary_score"),
        "grammatical_range": session.get("grammar_score"),
        "pronunciation": session.get("pronunciation_score"),
    }
    if any(v is not None for v in legacy.values()):
        return {k: v for k, v in legacy.items() if v is not None}

    return {}


async def _get_owned_session(session_id: UUID, current_user: dict) -> dict:
    session = await db_service.get_session(str(session_id))
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return session


async def _fetch_error_rows(session_id: str) -> list:
    # Preferred schema
    try:
        result = (
            db_service.client.table("error_instances")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        rows = result.data or []
        if rows:
            return rows
    except Exception:
        pass

    # Legacy fallback
    try:
        legacy = (
            db_service.client.table("detected_errors")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return legacy.data or []
    except Exception:
        return []


@router.get("/sessions/{session_id}")
async def get_session_analysis(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get analysis results for a session.

    Returns fast/deep analysis blocks and a normalized top-level payload for clients.
    """
    session = await _get_owned_session(session_id, current_user)

    try:
        runs_result = (
            db_service.client.table("analysis_runs")
            .select("*")
            .eq("session_id", str(session_id))
            .order("created_at", desc=True)
            .execute()
        )
        runs = runs_result.data or []
    except Exception:
        runs = []

    fast_run = next((r for r in runs if _run_type(r) == "fast"), None)
    deep_run = next((r for r in runs if _run_type(r) == "deep"), None)

    errors = await _fetch_error_rows(str(session_id))

    preferred = deep_run or fast_run
    preferred_type = "deep" if deep_run else ("fast" if fast_run else None)
    preferred_result = _run_result(preferred) if preferred else {}

    session_scores = _normalize_session_scores(session)
    scores = session_scores or (_run_scores(preferred) if preferred else {})

    return {
        "session_id": str(session_id),
        "session": {
            **session,
            "duration": session.get("duration_seconds", 0),
        },
        "analysis_type": preferred_type,
        "analysis": preferred_result,
        "scores": scores,
        "errors": errors,
        "fast_analysis": fast_run,
        "deep_analysis": deep_run,
        "has_pdf": bool(session.get("pdf_url") or session.get("pdf_report_url")),
    }


@router.post("/sessions/{session_id}/reanalyze")
async def trigger_reanalysis(
    session_id: UUID,
    body: Optional[ReanalysisRequest] = None,
    analysis_type: Optional[str] = Query(None, description="Type of analysis"),
    current_user: dict = Depends(get_current_user)
):
    """Trigger re-analysis of a session."""
    await _get_owned_session(session_id, current_user)

    resolved_type = (body.analysis_type if body and body.analysis_type else analysis_type) or "deep"

    queue = QueueManager()
    job = queue.enqueue_analysis(str(session_id), resolved_type)

    return {
        "status": "queued",
        "session_id": str(session_id),
        "analysis_type": resolved_type,
        "job_id": getattr(job, "id", None),
    }


@router.get("/sessions/{session_id}/errors")
async def get_session_errors(
    session_id: UUID,
    category: Optional[str] = Query(None, description="Filter by category"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed errors for a session."""
    await _get_owned_session(session_id, current_user)

    errors = await _fetch_error_rows(str(session_id))

    if category:
        errors = [e for e in errors if e.get("category") == category]
    if severity:
        errors = [e for e in errors if e.get("severity") == severity]

    grouped: Dict[str, list] = {}
    for error in errors:
        cat = error.get("category", "other")
        grouped.setdefault(cat, []).append(error)

    return {
        "session_id": str(session_id),
        "total_errors": len(errors),
        "by_category": grouped,
        "errors": errors,
    }


@router.get("/sessions/{session_id}/scores")
async def get_session_scores(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get IELTS scores for a session."""
    session = await _get_owned_session(session_id, current_user)

    base_scores = _normalize_session_scores(session)

    latest_deep = None
    try:
        deep_result = (
            db_service.client.table("analysis_runs")
            .select("*")
            .eq("session_id", str(session_id))
            .eq("run_type", "deep")
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        latest_deep = (deep_result.data or [None])[0]
    except Exception:
        latest_deep = None

    # Legacy fallback if run_type column isn't used
    if latest_deep is None:
        try:
            legacy_deep = (
                db_service.client.table("analysis_runs")
                .select("*")
                .eq("session_id", str(session_id))
                .eq("analysis_type", "deep")
                .eq("status", "completed")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            latest_deep = (legacy_deep.data or [None])[0]
        except Exception:
            latest_deep = None

    detailed_scores = _run_scores(latest_deep) if latest_deep else {}
    scores = base_scores or detailed_scores

    return {
        "session_id": str(session_id),
        "overall_score": scores.get("overall_band"),
        "scores": {
            "fluency_coherence": scores.get("fluency_coherence"),
            "lexical_resource": scores.get("lexical_resource"),
            "grammatical_range": scores.get("grammatical_range"),
            "pronunciation": scores.get("pronunciation"),
        },
        "detailed": detailed_scores,
    }


@router.post("/sessions/{session_id}/pdf")
async def generate_pdf_report(
    session_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Queue PDF report generation for a session."""
    await _get_owned_session(session_id, current_user)

    queue = QueueManager()
    job = queue.enqueue_pdf_generation(str(session_id), current_user["user_id"])

    return {
        "status": "queued",
        "session_id": str(session_id),
        "job_id": getattr(job, "id", None),
    }


@router.get("/user/summary")
async def get_user_analysis_summary(
    days: int = Query(30, description="Period in days"),
    current_user: dict = Depends(get_current_user)
):
    """Get user's overall analysis summary."""
    user_id = current_user["user_id"]
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    sessions_result = (
        db_service.client.table("sessions")
        .select("id, overall_scores, overall_score, created_at")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .order("created_at")
        .execute()
    )
    sessions = sessions_result.data or []

    if not sessions:
        return {
            "period_days": days,
            "sessions_count": 0,
            "average_score": None,
            "improvement": None,
            "top_errors": [],
        }

    normalized_scores = []
    for session in sessions:
        scores = _normalize_session_scores(session)
        if scores.get("overall_band") is not None:
            normalized_scores.append(float(scores["overall_band"]))

    avg_score = sum(normalized_scores) / len(normalized_scores) if normalized_scores else None
    improvement = None
    if len(normalized_scores) >= 2:
        improvement = round(normalized_scores[-1] - normalized_scores[0], 1)

    error_rows = []
    try:
        error_rows = (
            db_service.client.table("error_instances")
            .select("category")
            .in_("session_id", [s["id"] for s in sessions])
            .execute()
        ).data or []
    except Exception:
        error_rows = []

    if not error_rows:
        try:
            error_rows = (
                db_service.client.table("detected_errors")
                .select("category")
                .in_("session_id", [s["id"] for s in sessions])
                .execute()
            ).data or []
        except Exception:
            error_rows = []

    error_counts: Dict[str, int] = {}
    for error in error_rows:
        cat = error.get("category", "other")
        error_counts[cat] = error_counts.get(cat, 0) + 1

    top_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:3]

    return {
        "period_days": days,
        "sessions_count": len(sessions),
        "average_score": round(avg_score, 1) if avg_score is not None else None,
        "improvement": improvement,
        "score_trend": [
            {
                "date": s["created_at"],
                "score": _normalize_session_scores(s).get("overall_band"),
            }
            for s in sessions
        ],
        "top_errors": [{"category": cat, "count": count} for cat, count in top_errors],
    }
