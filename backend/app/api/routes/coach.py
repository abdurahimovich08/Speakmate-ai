"""
SpeakMate AI - Super Coach Routes

Daily-use coaching layer:
- Adaptive mission loop
- Error recurrence mnemonics
- Skill graph
- Coach memory
- Proof of progress
- Speak-first drills
- Growth and behavior insights
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import get_current_user
from app.db.supabase import db_service
from app.services.coach_engine import coach_engine
from app.workers.queue_config import queue_manager

router = APIRouter(prefix="/coach", tags=["coach"])


class MissionCompletionRequest(BaseModel):
    tasks_completed: int = Field(ge=0)
    total_tasks: int = Field(gt=0)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = None


class MnemonicFeedbackRequest(BaseModel):
    error_code: str
    style: str
    helpfulness: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class MemoryUpdateRequest(BaseModel):
    goals: Optional[list[str]] = None
    confidence_blockers: Optional[list[str]] = None
    preferred_topics: Optional[list[str]] = None
    notes: Optional[str] = None
    consent: Optional[dict] = None


class QuickDiagnosisRequest(BaseModel):
    transcript: Optional[str] = None


class NotificationRunRequest(BaseModel):
    limit: int = Field(default=200, ge=1, le=1000)
    force: bool = False
    async_job: bool = True


def _parse_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _count_words(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"[A-Za-z']+", text))


def _count_fillers(text: str) -> int:
    if not text:
        return 0
    lowered = text.lower()
    phrases = ["um", "uh", "erm", "you know", "like", "actually", "basically", "i mean"]
    count = 0
    for phrase in phrases:
        if " " in phrase:
            count += lowered.count(phrase)
        else:
            count += len(re.findall(rf"\b{re.escape(phrase)}\b", lowered))
    return count


def _validate_cron_secret(header_secret: Optional[str]) -> None:
    if settings.CRON_SECRET and header_secret == settings.CRON_SECRET:
        return
    if settings.DEBUG and not settings.CRON_SECRET:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid cron secret",
    )


async def _ensure_user_profile(current_user: dict) -> dict:
    user_id = current_user["user_id"]
    profile = await db_service.get_user_profile(user_id)
    if profile:
        return profile

    profile = await db_service.create_user_profile(
        user_id,
        {
            "email": current_user.get("email"),
            "phone": current_user.get("phone"),
            "native_language": "uz",
            "target_band": 7.0,
            "preferences": {},
        },
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not initialize profile",
        )
    return profile


def _preferences(profile: dict) -> dict:
    prefs = profile.get("preferences")
    return prefs if isinstance(prefs, dict) else {}


async def _save_preferences(user_id: str, preferences: dict) -> None:
    await db_service.update_user_profile(user_id, {"preferences": preferences})


async def _fetch_error_rows(session_ids: list[str]) -> list[dict]:
    if not session_ids:
        return []

    # Preferred schema
    try:
        rows = (
            db_service.client.table("error_instances")
            .select("*")
            .in_("session_id", session_ids)
            .execute()
        ).data or []
        if rows:
            return rows
    except Exception:
        pass

    # Legacy fallback
    try:
        return (
            db_service.client.table("detected_errors")
            .select("*")
            .in_("session_id", session_ids)
            .execute()
        ).data or []
    except Exception:
        return []


async def _fetch_assets_map(user_id: str, session_ids: list[str]) -> dict[str, dict]:
    if not session_ids:
        return {}
    try:
        rows = (
            db_service.client.table("session_assets")
            .select("session_id,audio_url,transcript_url,pdf_report_url")
            .eq("user_id", user_id)
            .in_("session_id", session_ids)
            .execute()
        ).data or []
    except Exception:
        rows = []
    return {str(row.get("session_id")): row for row in rows if row.get("session_id")}


async def _build_session_metrics(
    sessions: list[dict],
    errors_by_session: dict[str, list[dict]],
    assets_map: dict[str, dict],
) -> list[dict]:
    metrics = []
    for session in sessions:
        session_id = str(session.get("id"))
        if not session_id:
            continue

        turns = await db_service.get_conversation_turns(session_id)
        user_text_parts = []
        pause_count = 0

        for turn in turns:
            if turn.get("role") != "user":
                continue
            text = turn.get("transcription") or turn.get("content") or ""
            if text:
                user_text_parts.append(text)

            timestamps = turn.get("word_timestamps") or []
            if isinstance(timestamps, list) and len(timestamps) > 1:
                for i in range(1, len(timestamps)):
                    prev = timestamps[i - 1]
                    curr = timestamps[i]
                    prev_end = prev.get("end_ms")
                    curr_start = curr.get("start_ms")
                    if isinstance(prev_end, (int, float)) and isinstance(curr_start, (int, float)):
                        if curr_start - prev_end > 700:
                            pause_count += 1

        joined_text = " ".join(user_text_parts)
        word_count = _count_words(joined_text)
        filler_count = _count_fillers(joined_text)

        duration_seconds = int(session.get("duration_seconds") or 0)
        duration_minutes = max(duration_seconds / 60.0, 1e-6)
        wpm = round(word_count / duration_minutes, 2) if duration_seconds > 0 else float(word_count)
        filler_rate = round((filler_count / max(word_count, 1)) * 100, 2)

        session_errors = errors_by_session.get(session_id, [])
        grammar_errors = len([e for e in session_errors if str(e.get("category")).lower() == "grammar"])
        grammar_accuracy = round(max(0.0, 100 - (grammar_errors / max(word_count, 1)) * 100), 2)

        scores = session.get("overall_scores") or {}
        overall_band = scores.get("overall_band")
        if overall_band is None:
            overall_band = session.get("overall_score")

        metrics.append(
            {
                "session_id": session_id,
                "created_at": session.get("created_at"),
                "wpm": wpm,
                "filler_rate": filler_rate,
                "pause_count": pause_count,
                "grammar_accuracy": grammar_accuracy,
                "overall_band": overall_band,
                "audio_url": (assets_map.get(session_id) or {}).get("audio_url"),
            }
        )

    return metrics


async def _persist_mnemonic_tasks(user_id: str, drills: list[dict]) -> dict:
    created = 0
    updated = 0

    for drill in drills:
        error_code = drill.get("error_code")
        if not error_code:
            continue

        content = {
            "mnemonic": drill.get("mnemonic"),
            "style": drill.get("style"),
            "review_schedule_days": drill.get("review_schedule_days", [1, 3, 7]),
            "category": drill.get("category"),
        }
        try:
            existing = (
                db_service.client.table("training_tasks")
                .select("id")
                .eq("user_id", user_id)
                .eq("task_type", "mnemonic_drill")
                .eq("error_code", error_code)
                .eq("status", "active")
                .limit(1)
                .execute()
            )
            rows = existing.data or []
            due_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

            if rows:
                db_service.client.table("training_tasks").update(
                    {
                        "content": content,
                        "next_due_at": due_at,
                        "difficulty": 0.4,
                        "interval_days": 1,
                    }
                ).eq("id", rows[0]["id"]).execute()
                updated += 1
            else:
                db_service.client.table("training_tasks").insert(
                    {
                        "user_id": user_id,
                        "task_type": "mnemonic_drill",
                        "error_code": error_code,
                        "content": content,
                        "difficulty": 0.4,
                        "interval_days": 1,
                        "ease_factor": 2.5,
                        "next_due_at": due_at,
                        "status": "active",
                    }
                ).execute()
                created += 1
        except Exception:
            # Keep response resilient even if task persistence fails.
            continue

    return {"created": created, "updated": updated}


def _filter_sessions_by_days(sessions: list[dict], days: int) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    filtered = []
    for session in sessions:
        dt = _parse_dt(session.get("created_at"))
        if dt and dt >= since:
            filtered.append(session)
    return filtered


@router.get("/daily-mission")
async def get_daily_mission(current_user: dict = Depends(get_current_user)):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    user_id = current_user["user_id"]
    today = datetime.now(timezone.utc).date().isoformat()

    stored = await db_service.get_coach_daily_mission(user_id, today)
    if stored and isinstance(stored.get("mission_payload"), dict):
        return stored["mission_payload"]

    mission_history_rows = await db_service.get_coach_mission_history(user_id, limit=60)
    mission_history = []
    for row in mission_history_rows:
        payload = row.get("mission_payload") if isinstance(row.get("mission_payload"), dict) else {}
        mission_history.append(
            {
                "mission_id": payload.get("mission_id"),
                "success_rate": row.get("success_rate"),
                "rating": row.get("rating"),
                "completed_at": row.get("completed_at"),
                "mission_date": row.get("mission_date"),
            }
        )

    prefs = dict(preferences)
    coach_state = prefs.setdefault("coach", {})
    if mission_history:
        coach_state["mission_history"] = mission_history[-60:]

    sessions = await db_service.get_user_sessions(user_id, limit=80)
    error_profiles = await db_service.get_user_error_profile(user_id)

    mission = coach_engine.build_daily_mission(profile, sessions, error_profiles, prefs)

    coach_state["latest_mission"] = mission
    await _save_preferences(user_id, prefs)
    await db_service.upsert_coach_daily_mission(
        user_id=user_id,
        mission_date=today,
        mission_payload=mission,
        difficulty=mission.get("difficulty"),
        best_hour=((mission.get("best_time_to_practice") or {}).get("hour")),
    )

    return mission


@router.post("/daily-mission/{mission_id}/complete")
async def complete_daily_mission(
    mission_id: str,
    body: MissionCompletionRequest,
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    user_id = current_user["user_id"]
    mission_date = datetime.now(timezone.utc).date().isoformat()

    updated = coach_engine.record_mission_completion(
        preferences=preferences,
        mission_id=mission_id,
        tasks_completed=body.tasks_completed,
        total_tasks=body.total_tasks,
        rating=body.rating,
        notes=body.notes,
    )
    await _save_preferences(user_id, updated)
    await db_service.complete_coach_daily_mission(
        user_id=user_id,
        mission_date=mission_date,
        mission_id=mission_id,
        tasks_completed=body.tasks_completed,
        total_tasks=body.total_tasks,
        rating=body.rating,
        notes=body.notes,
    )
    await db_service.save_behavior_event(
        user_id=user_id,
        event_type="mission_completed",
        payload={
            "mission_id": mission_id,
            "tasks_completed": body.tasks_completed,
            "total_tasks": body.total_tasks,
        },
    )

    success_rate = round(body.tasks_completed / max(body.total_tasks, 1), 2)
    return {"status": "completed", "mission_id": mission_id, "success_rate": success_rate}


@router.get("/mnemonic-drills")
async def get_mnemonic_drills(
    limit: int = Query(5, ge=1, le=10),
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    error_profiles = await db_service.get_user_error_profile(current_user["user_id"])
    drills = coach_engine.build_mnemonic_drills(profile, error_profiles, max_items=limit)
    persistence = await _persist_mnemonic_tasks(current_user["user_id"], drills)
    return {"drills": drills, "persistence": persistence}


@router.post("/mnemonic-feedback")
async def submit_mnemonic_feedback(
    body: MnemonicFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)

    prefs = dict(preferences)
    coach = prefs.setdefault("coach", {})
    feedback_map = coach.setdefault("mnemonic_feedback", {})
    key = f"{body.error_code}:{body.style}"
    history = feedback_map.get(key, [])
    history.append(
        {
            "helpfulness": body.helpfulness,
            "comment": body.comment,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    feedback_map[key] = history[-20:]

    user_id = current_user["user_id"]
    await _save_preferences(user_id, prefs)
    await db_service.save_mnemonic_feedback(
        user_id=user_id,
        error_code=body.error_code,
        style=body.style,
        helpfulness=body.helpfulness,
        comment=body.comment,
    )
    stats = await db_service.get_mnemonic_feedback_stats(user_id, body.error_code, body.style)

    average = stats.get("average_helpfulness")
    if average is None and feedback_map[key]:
        average = round(sum(item["helpfulness"] for item in feedback_map[key]) / len(feedback_map[key]), 2)
    samples = stats.get("samples", len(feedback_map[key]))
    return {"status": "saved", "average_helpfulness": average, "samples": samples}


@router.get("/skill-graph")
async def get_skill_graph(current_user: dict = Depends(get_current_user)):
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=120)
    session_ids = [str(s["id"]) for s in sessions if s.get("id")]
    errors = await _fetch_error_rows(session_ids)
    return coach_engine.build_skill_graph(errors)


@router.get("/memory")
async def get_coach_memory(current_user: dict = Depends(get_current_user)):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=20)
    return coach_engine.build_memory(profile, sessions, preferences)


@router.put("/memory")
async def update_coach_memory(
    body: MemoryUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    patch = body.model_dump(exclude_none=True)
    updated = coach_engine.update_memory(preferences, patch)
    await _save_preferences(current_user["user_id"], updated)
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=20)
    refreshed_profile = await db_service.get_user_profile(current_user["user_id"]) or profile
    return coach_engine.build_memory(refreshed_profile, sessions, _preferences(refreshed_profile))


@router.delete("/memory")
async def clear_coach_memory(current_user: dict = Depends(get_current_user)):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    updated = coach_engine.clear_memory(preferences)
    await _save_preferences(current_user["user_id"], updated)
    return {"status": "cleared"}


@router.get("/progress-proof")
async def get_progress_proof(
    days: int = Query(30, ge=7, le=180),
    current_user: dict = Depends(get_current_user),
):
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=140)
    sessions = _filter_sessions_by_days(sessions, days)
    session_ids = [str(s["id"]) for s in sessions if s.get("id")]
    errors = await _fetch_error_rows(session_ids)

    errors_by_session: dict[str, list[dict]] = defaultdict(list)
    for error in errors:
        sid = str(error.get("session_id") or "")
        if sid:
            errors_by_session[sid].append(error)

    assets_map = await _fetch_assets_map(current_user["user_id"], session_ids)
    metrics = await _build_session_metrics(sessions, errors_by_session, assets_map)
    proof = coach_engine.build_progress_proof(metrics)
    return {"proof": proof, "session_count": len(metrics)}


@router.get("/speak-first")
async def get_speak_first_plan(
    comfort_mode: bool = Query(False, description="Beginner-friendly guided mode"),
    current_user: dict = Depends(get_current_user),
):
    _ = current_user
    return coach_engine.build_speak_first_plan(comfort_mode=comfort_mode)


@router.post("/public/diagnosis")
async def public_quick_diagnosis(body: QuickDiagnosisRequest):
    transcript = (body.transcript or "").strip()
    if _count_words(transcript) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least 20 words for diagnosis.",
        )
    return coach_engine.build_quick_diagnosis(transcript=transcript, target_band=7.0)


@router.post("/diagnosis/free")
async def quick_free_diagnosis(
    body: QuickDiagnosisRequest,
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    transcript = (body.transcript or "").strip()

    if not transcript:
        sessions = await db_service.get_user_sessions(current_user["user_id"], limit=5)
        latest = sessions[0] if sessions else None
        if latest:
            turns = await db_service.get_conversation_turns(str(latest["id"]))
            user_text = [t.get("transcription") or t.get("content") for t in turns if t.get("role") == "user"]
            transcript = " ".join([t for t in user_text if t]).strip()

    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transcript available. Provide transcript or complete one session.",
        )

    diagnosis = coach_engine.build_quick_diagnosis(
        transcript=transcript,
        target_band=float(profile.get("target_band") or 7.0),
    )
    return diagnosis


@router.get("/share-card")
async def get_share_card(
    days: int = Query(30, ge=7, le=180),
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=140)
    sessions = _filter_sessions_by_days(sessions, days)
    session_ids = [str(s["id"]) for s in sessions if s.get("id")]
    errors = await _fetch_error_rows(session_ids)

    errors_by_session: dict[str, list[dict]] = defaultdict(list)
    for error in errors:
        sid = str(error.get("session_id") or "")
        if sid:
            errors_by_session[sid].append(error)

    assets_map = await _fetch_assets_map(current_user["user_id"], session_ids)
    metrics = await _build_session_metrics(sessions, errors_by_session, assets_map)
    proof = coach_engine.build_progress_proof(metrics)
    card = coach_engine.build_share_card(proof, profile)
    return {"card": card, "proof_status": proof.get("status")}


@router.get("/behavior-insights")
async def get_behavior_insights(
    days: int = Query(30, ge=7, le=180),
    current_user: dict = Depends(get_current_user),
):
    profile = await _ensure_user_profile(current_user)
    preferences = _preferences(profile)
    coach_state = preferences.get("coach", {}) if isinstance(preferences, dict) else {}
    mission_history = coach_state.get("mission_history", [])

    sessions = await db_service.get_user_sessions(current_user["user_id"], limit=100)
    sessions = _filter_sessions_by_days(sessions, days)
    session_ids = [str(s["id"]) for s in sessions if s.get("id")]
    errors = await _fetch_error_rows(session_ids)
    errors_by_session: dict[str, list[dict]] = defaultdict(list)
    for error in errors:
        sid = str(error.get("session_id") or "")
        if sid:
            errors_by_session[sid].append(error)

    assets_map = await _fetch_assets_map(current_user["user_id"], session_ids)
    metrics = await _build_session_metrics(sessions, errors_by_session, assets_map)
    progress_proof = coach_engine.build_progress_proof(metrics)
    insights = coach_engine.build_behavior_insights(sessions, mission_history, progress_proof)

    completion_rate = None
    if mission_history:
        recent = mission_history[-14:]
        completion_rate = round(
            sum(float(item.get("success_rate", 0.0)) for item in recent) / len(recent),
            2,
        )

    if insights.get("insights"):
        await db_service.save_behavior_event(
            user_id=current_user["user_id"],
            event_type="insight_generated",
            payload={"top_risk": insights["insights"][0].get("risk"), "days": days},
        )

    return {
        "insights": insights.get("insights", []),
        "mission_completion_rate": completion_rate,
        "what_am_i_not_seeing_prompt": "Which user friction appears before a practice drop?",
    }


@router.post("/notifications/daily-reminders/run")
async def run_daily_reminders(
    body: NotificationRunRequest,
    x_cron_secret: Optional[str] = Header(default=None, alias="X-Cron-Secret"),
):
    _validate_cron_secret(x_cron_secret)

    if body.async_job:
        job = queue_manager.enqueue_daily_reminders(limit=body.limit, force=body.force)
        return {"status": "queued", "job_id": getattr(job, "id", None), "limit": body.limit, "force": body.force}

    from app.telegram.notifications import run_daily_mission_reminders_batch
    result = await run_daily_mission_reminders_batch(limit=body.limit, force=body.force)
    return {"status": "completed", **result}


@router.post("/notifications/streaks/run")
async def run_streak_notifications(
    body: NotificationRunRequest,
    x_cron_secret: Optional[str] = Header(default=None, alias="X-Cron-Secret"),
):
    _validate_cron_secret(x_cron_secret)

    if body.async_job:
        job = queue_manager.enqueue_streak_notifications(limit=body.limit, force=body.force)
        return {"status": "queued", "job_id": getattr(job, "id", None), "limit": body.limit, "force": body.force}

    from app.telegram.notifications import run_streak_notifications_batch
    result = await run_streak_notifications_batch(limit=body.limit, force=body.force)
    return {"status": "completed", **result}
