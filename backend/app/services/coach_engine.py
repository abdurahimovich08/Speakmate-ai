"""
SpeakMate AI - Super Coach Engine

Builds high-retention coaching experiences:
- 10-15 minute adaptive daily missions
- Recurring-error mnemonic drills
- Micro-skill graph and trends
- Proof-of-progress snapshots
- Behavior insights ("what are we not seeing?")
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import random
import re


FILLER_TERMS = [
    "um",
    "uh",
    "erm",
    "you know",
    "like",
    "actually",
    "basically",
    "i mean",
]


SKILL_DEFINITIONS = [
    {"id": "grammar_articles", "label": "Articles", "category": "grammar"},
    {"id": "grammar_tenses", "label": "Tense Control", "category": "grammar"},
    {"id": "grammar_agreement", "label": "Subject-Verb Agreement", "category": "grammar"},
    {"id": "grammar_prepositions", "label": "Prepositions", "category": "grammar"},
    {"id": "vocab_collocations", "label": "Collocations", "category": "vocabulary"},
    {"id": "vocab_variety", "label": "Vocabulary Variety", "category": "vocabulary"},
    {"id": "fluency_fillers", "label": "Filler Control", "category": "fluency"},
    {"id": "fluency_linking", "label": "Linking and Coherence", "category": "fluency"},
    {"id": "pron_clarity", "label": "Pronunciation Clarity", "category": "pronunciation"},
    {"id": "pron_intonation", "label": "Intonation", "category": "pronunciation"},
]


@dataclass
class MissionDifficulty:
    level: str
    speak_seconds: int
    correction_limit: int


DIFFICULTY_PRESETS = {
    "supportive": MissionDifficulty(level="supportive", speak_seconds=60, correction_limit=2),
    "balanced": MissionDifficulty(level="balanced", speak_seconds=90, correction_limit=3),
    "advanced": MissionDifficulty(level="advanced", speak_seconds=120, correction_limit=4),
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
    total = 0
    for term in FILLER_TERMS:
        if " " in term:
            total += lowered.count(term)
        else:
            total += len(re.findall(rf"\b{re.escape(term)}\b", lowered))
    return total


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_div(num: float, den: float) -> float:
    return num / den if den else 0.0


class CoachEngine:
    """High-level coaching intelligence used by Super Coach endpoints."""

    def estimate_best_practice_window(
        self,
        sessions: list[dict],
        mission_history: list[dict],
    ) -> dict:
        hours = []
        for session in sessions[:60]:
            dt = _parse_dt(session.get("created_at"))
            if dt:
                hours.append(dt.hour)

        for item in mission_history[-40:]:
            completed_at = _parse_dt(item.get("completed_at"))
            if completed_at:
                hours.append(completed_at.hour)

        if not hours:
            return {
                "hour": 19,
                "window": "18:00-20:00",
                "source": "default",
            }

        best_hour = Counter(hours).most_common(1)[0][0]
        start = max(0, best_hour - 1)
        end = min(23, best_hour + 1)
        return {
            "hour": best_hour,
            "window": f"{start:02d}:00-{end:02d}:59",
            "source": "usage_history",
        }

    def build_mnemonic_for_error(
        self,
        error_code: str,
        category: str,
        native_language: str,
        style: Optional[str] = None,
    ) -> dict:
        style_choice = style or self._default_style_for_category(category)

        normalized = (error_code or "GENERAL_ERROR").upper()
        short_name = normalized.replace("_", " ").title()

        if style_choice == "keyword_image":
            mnemonic = (
                f"Imagine a red sign saying '{short_name}' every time you start the sentence. "
                "If the sign looks wrong, rewrite before speaking."
            )
        elif style_choice == "mini_story":
            mnemonic = (
                f"Story hook: one character always says '{short_name}' correctly and gets understood; "
                "the other skips it and gets confused. Be the first character."
            )
        elif style_choice == "rhyme":
            mnemonic = (
                f"Rhyme: '{short_name} first, confusion worst; {short_name} right, message bright.'"
            )
        else:
            # native_hook
            mnemonic = (
                f"Native-language hook ({native_language}): translate the sentence mentally once, "
                f"then check '{short_name}' before speaking."
            )

        return {
            "error_code": normalized,
            "category": category or "grammar",
            "style": style_choice,
            "mnemonic": mnemonic,
            "review_schedule_days": [1, 3, 7],
        }

    def build_mnemonic_drills(
        self,
        user_profile: dict,
        error_profiles: list[dict],
        max_items: int = 5,
    ) -> list[dict]:
        recurring = [
            p for p in error_profiles
            if int(p.get("occurrence_count", 0)) >= 3
        ]
        recurring.sort(key=lambda x: int(x.get("occurrence_count", 0)), reverse=True)

        native_language = user_profile.get("native_language", "en")
        drills = []
        for item in recurring[:max_items]:
            drill = self.build_mnemonic_for_error(
                error_code=item.get("error_code", "GENERAL_ERROR"),
                category=item.get("category", "grammar"),
                native_language=native_language,
            )
            drill["occurrence_count"] = int(item.get("occurrence_count", 0))
            drill["priority"] = "high" if drill["occurrence_count"] >= 5 else "medium"
            drills.append(drill)
        return drills

    def infer_difficulty(self, mission_history: list[dict]) -> MissionDifficulty:
        if not mission_history:
            return DIFFICULTY_PRESETS["balanced"]

        latest = mission_history[-1]
        success = _safe_float(latest.get("success_rate"), 0.75)
        if success >= 0.85:
            return DIFFICULTY_PRESETS["advanced"]
        if success < 0.7:
            return DIFFICULTY_PRESETS["supportive"]
        return DIFFICULTY_PRESETS["balanced"]

    def build_daily_mission(
        self,
        user_profile: dict,
        sessions: list[dict],
        error_profiles: list[dict],
        preferences: dict,
    ) -> dict:
        coach_state = preferences.get("coach", {}) if isinstance(preferences, dict) else {}
        mission_history = coach_state.get("mission_history", [])
        difficulty = self.infer_difficulty(mission_history)
        best_window = self.estimate_best_practice_window(sessions, mission_history)

        recurring = sorted(
            [p for p in error_profiles if int(p.get("occurrence_count", 0)) > 0],
            key=lambda p: int(p.get("occurrence_count", 0)),
            reverse=True,
        )
        top_errors = recurring[:3]
        mnemonic_targets = [e for e in recurring if int(e.get("occurrence_count", 0)) >= 3][:2]

        preferred_topics = (
            coach_state.get("coach_memory", {}).get("preferred_topics", [])
            if isinstance(coach_state.get("coach_memory", {}), dict)
            else []
        )
        topic = (
            preferred_topics[0]
            if preferred_topics
            else self._fallback_topic(sessions)
        )

        mission_date = _utcnow().date().isoformat()
        mission_id = f"{user_profile.get('id', 'user')}-{mission_date}"
        mnemonic_drills = [
            self.build_mnemonic_for_error(
                t.get("error_code", "GENERAL_ERROR"),
                t.get("category", "grammar"),
                user_profile.get("native_language", "en"),
            )
            for t in mnemonic_targets
        ]

        recall_items = []
        for item in top_errors[:difficulty.correction_limit]:
            recall_items.append({
                "error_code": item.get("error_code"),
                "prompt": f"Fix one sentence with {item.get('error_code', 'this error')} from memory.",
            })

        tasks = [
            {
                "id": "recall",
                "title": "Recall",
                "duration_min": 3,
                "instruction": "Fix 3 recent mistakes from memory.",
                "items": recall_items,
            },
            {
                "id": "fix",
                "title": "Fix with Mnemonics",
                "duration_min": 4,
                "instruction": "Use 1-2 mnemonic hooks, then produce corrected examples.",
                "items": mnemonic_drills,
            },
            {
                "id": "speak",
                "title": "Speak under Time",
                "duration_min": 4,
                "instruction": f"Speak on '{topic}' for {difficulty.speak_seconds} seconds without stopping.",
                "items": [
                    {
                        "topic": topic,
                        "seconds": difficulty.speak_seconds,
                        "focus": "fluency and error reduction",
                    }
                ],
            },
        ]

        return {
            "mission_id": mission_id,
            "date": mission_date,
            "total_minutes": 11,
            "difficulty": difficulty.level,
            "best_time_to_practice": best_window,
            "tasks": tasks,
            "growth_loop": {
                "share_prompt": "Share one measurable win after mission completion.",
                "invite_prompt": "Invite a friend to do a 2-minute diagnosis challenge.",
            },
            "habit_loop": {
                "cue": f"Practice window {best_window['window']}",
                "routine": "Recall -> Fix -> Speak",
                "reward": "See your weekly trend update immediately",
            },
            "what_am_i_not_seeing_prompt": "Which mistake keeps returning even after practice?",
        }

    def build_skill_graph(self, errors: list[dict]) -> dict:
        now = _utcnow()
        current_start = now - timedelta(days=14)
        previous_start = now - timedelta(days=28)

        current_counts = Counter()
        previous_counts = Counter()

        for error in errors:
            dt = _parse_dt(error.get("created_at")) or now
            skill_id = self._map_error_to_skill(error)
            if dt >= current_start:
                current_counts[skill_id] += 1
            elif previous_start <= dt < current_start:
                previous_counts[skill_id] += 1

        heatmap = []
        for item in SKILL_DEFINITIONS:
            skill_id = item["id"]
            current = current_counts.get(skill_id, 0)
            previous = previous_counts.get(skill_id, 0)
            trend_delta = previous - current

            score = max(20, min(98, 88 - current * 6 + max(0, trend_delta) * 2))
            trend = "improving" if trend_delta > 0 else "declining" if trend_delta < 0 else "stable"

            heatmap.append({
                "skill_id": skill_id,
                "label": item["label"],
                "category": item["category"],
                "score": score,
                "errors_current_14d": current,
                "errors_previous_14d": previous,
                "trend": trend,
                "trend_delta": trend_delta,
            })

        top_weak = sorted(heatmap, key=lambda s: s["score"])[:3]
        top_improving = sorted(
            [s for s in heatmap if s["trend_delta"] > 0],
            key=lambda s: s["trend_delta"],
            reverse=True,
        )[:2]

        return {
            "heatmap": heatmap,
            "top_weak": top_weak,
            "top_improving": top_improving,
            "focus_recommendation": [
                f"Prioritize {item['label']}" for item in top_weak
            ],
        }

    def build_memory(self, user_profile: dict, sessions: list[dict], preferences: dict) -> dict:
        coach_state = preferences.get("coach", {}) if isinstance(preferences, dict) else {}
        memory = coach_state.get("coach_memory", {}) if isinstance(coach_state.get("coach_memory", {}), dict) else {}

        preferred_topics = memory.get("preferred_topics")
        if not preferred_topics:
            topic_counter = Counter()
            for session in sessions[:20]:
                if session.get("topic"):
                    topic_counter[str(session.get("topic"))] += 1
            preferred_topics = [t for t, _ in topic_counter.most_common(5)]

        last_five = []
        for session in sessions[:5]:
            scores = session.get("overall_scores") or {}
            last_five.append({
                "session_id": session.get("id"),
                "topic": session.get("topic") or "general",
                "date": session.get("created_at"),
                "duration_seconds": session.get("duration_seconds", 0),
                "overall_band": scores.get("overall_band"),
            })

        goals = memory.get("goals") or [f"Reach band {user_profile.get('target_band', 7.0)}"]

        return {
            "goals": goals,
            "confidence_blockers": memory.get("confidence_blockers", []),
            "preferred_topics": preferred_topics,
            "last_five_sessions": last_five,
            "notes": memory.get("notes", ""),
            "consent": memory.get("consent", {"enabled": True, "updated_at": _utcnow().isoformat()}),
            "panel_hint": "You can edit or clear what coach remembers anytime.",
        }

    def update_memory(self, preferences: dict, patch: dict) -> dict:
        prefs = preferences if isinstance(preferences, dict) else {}
        coach_state = prefs.setdefault("coach", {})
        memory = coach_state.setdefault("coach_memory", {})

        allowed = {"goals", "confidence_blockers", "preferred_topics", "notes", "consent"}
        for key, value in patch.items():
            if key in allowed:
                memory[key] = value

        memory.setdefault("consent", {"enabled": True})
        memory["consent"]["updated_at"] = _utcnow().isoformat()
        return prefs

    def clear_memory(self, preferences: dict) -> dict:
        prefs = preferences if isinstance(preferences, dict) else {}
        coach_state = prefs.setdefault("coach", {})
        coach_state["coach_memory"] = {
            "goals": [],
            "confidence_blockers": [],
            "preferred_topics": [],
            "notes": "",
            "consent": {"enabled": False, "updated_at": _utcnow().isoformat()},
        }
        return prefs

    def build_progress_proof(self, session_metrics: list[dict]) -> dict:
        if not session_metrics:
            return {
                "status": "needs_more_data",
                "message": "Complete at least 2 sessions to unlock proof of progress.",
                "confidence": 0.2,
            }

        ordered = sorted(
            session_metrics,
            key=lambda m: _parse_dt(m.get("created_at")) or _utcnow(),
        )
        first = ordered[0]
        latest = ordered[-1]

        def metric_delta(key: str, round_digits: int = 1) -> float:
            return round(_safe_float(latest.get(key)) - _safe_float(first.get(key)), round_digits)

        band_values = [m.get("overall_band") for m in ordered if m.get("overall_band") is not None]
        confidence = round(min(0.95, 0.35 + len(band_values) * 0.08), 2)
        confidence_label = (
            "needs_more_data" if len(band_values) < 3 else "medium" if len(band_values) < 6 else "high"
        )

        deltas = {
            "wpm_delta": metric_delta("wpm"),
            "filler_rate_delta": metric_delta("filler_rate"),
            "pause_count_delta": metric_delta("pause_count", 0),
            "grammar_accuracy_delta": metric_delta("grammar_accuracy"),
            "band_delta": metric_delta("overall_band"),
        }

        trend_points = [
            {
                "date": item.get("created_at"),
                "overall_band": item.get("overall_band"),
                "wpm": item.get("wpm"),
                "filler_rate": item.get("filler_rate"),
            }
            for item in ordered[-12:]
        ]

        return {
            "status": confidence_label,
            "confidence": confidence,
            "before_after_audio": {
                "before": first.get("audio_url"),
                "after": latest.get("audio_url"),
            },
            "deltas": deltas,
            "trend_points": trend_points,
            "highlights": self._progress_highlights(deltas),
        }

    def build_speak_first_plan(self, comfort_mode: bool = False) -> dict:
        drills = [
            {
                "id": "shadowing",
                "title": "Shadowing",
                "duration_min": 3 if comfort_mode else 2,
                "instruction": "Repeat model sentences with matching rhythm and stress.",
            },
            {
                "id": "chunk_repetition",
                "title": "Chunk Repetition",
                "duration_min": 3,
                "instruction": "Practice high-frequency chunks to improve fluency.",
            },
            {
                "id": "minimal_pairs",
                "title": "Minimal Pairs",
                "duration_min": 2,
                "instruction": "Contrast tricky sounds and record one clean pass.",
            },
            {
                "id": "timed_speaking",
                "title": "Timed Speaking",
                "duration_min": 3 if comfort_mode else 4,
                "instruction": "Speak on one real-life topic with a strict timer.",
                "seconds": 60 if comfort_mode else 90,
            },
        ]

        comfort_support = None
        if comfort_mode:
            comfort_support = {
                "sentence_frames": [
                    "In my opinion, ...",
                    "The main reason is ...",
                    "For example, ...",
                    "As a result, ...",
                ],
                "pace": "slow_guided",
            }

        return {
            "mode": "comfort" if comfort_mode else "standard",
            "drills": drills,
            "comfort_support": comfort_support,
        }

    def build_quick_diagnosis(
        self,
        transcript: str,
        target_band: float = 7.0,
    ) -> dict:
        words = _count_words(transcript)
        fillers = _count_fillers(transcript)

        wpm = min(180.0, max(60.0, words * 0.9))
        filler_rate = round(_safe_div(fillers, max(words, 1)) * 100, 2)

        band = 6.0
        if words >= 130:
            band += 0.5
        if filler_rate < 3:
            band += 0.5
        elif filler_rate > 8:
            band -= 0.5
        band = round(max(4.5, min(8.0, band)), 1)

        gap = round(target_band - band, 1)
        tip = (
            "Reduce filler words by pausing silently for 1 second."
            if filler_rate > 5
            else "Use one concrete example in every answer to improve coherence."
        )

        return {
            "duration_seconds": 120,
            "estimated_band": band,
            "band_confidence": 0.62 if words >= 60 else 0.45,
            "metrics": {
                "word_count": words,
                "filler_rate": filler_rate,
                "estimated_wpm": round(wpm, 1),
            },
            "top_actions": [
                "Speak in 3-part structure: point -> reason -> example.",
                "Practice one 90-second timed response daily.",
                tip,
            ],
            "target_gap": gap,
            "share_card_preview": f"I finished a 2-minute diagnosis. Estimated band: {band}.",
        }

    def build_share_card(self, progress_proof: dict, user_profile: dict) -> dict:
        deltas = progress_proof.get("deltas", {})
        filler_delta = _safe_float(deltas.get("filler_rate_delta"))
        band_delta = _safe_float(deltas.get("band_delta"))
        name = user_profile.get("full_name") or "Learner"

        if filler_delta < 0:
            win_text = f"I reduced filler words by {abs(filler_delta):.1f}% this period."
        elif band_delta > 0:
            win_text = f"My speaking band moved up by {band_delta:.1f}."
        else:
            win_text = "I completed my weekly speaking mission streak."

        return {
            "title": f"{name}'s Speaking Progress",
            "win_text": win_text,
            "personal_tip": "Keep answers structured: claim, reason, example.",
            "share_text": f"{win_text} Training with SpeakMate daily.",
        }

    def build_behavior_insights(
        self,
        sessions: list[dict],
        mission_history: list[dict],
        progress_proof: dict,
    ) -> dict:
        insights = []
        now = _utcnow()

        last_practice = _parse_dt(sessions[0].get("created_at")) if sessions else None
        if not last_practice or (now - last_practice) > timedelta(days=3):
            insights.append({
                "risk": "habit_drop",
                "what_am_i_not_seeing": "The learner may be losing routine due to timing mismatch.",
                "action": "Trigger reminder at historically best practice window.",
            })

        if progress_proof.get("status") == "needs_more_data":
            insights.append({
                "risk": "unclear_progress",
                "what_am_i_not_seeing": "Learner cannot see clear improvement yet.",
                "action": "Show mini-wins after each mission (filler count, WPM, confidence).",
            })

        if mission_history:
            recent = mission_history[-7:]
            avg_success = _safe_div(
                sum(_safe_float(i.get("success_rate"), 0.0) for i in recent),
                len(recent),
            )
            if avg_success < 0.65:
                insights.append({
                    "risk": "difficulty_mismatch",
                    "what_am_i_not_seeing": "Tasks may be too hard for current state.",
                    "action": "Switch next mission to comfort mode and reduce corrections to top 2.",
                })

        if not insights:
            insights.append({
                "risk": "none_detected",
                "what_am_i_not_seeing": "Current pattern looks healthy. Keep reinforcing consistency.",
                "action": "Increase speaking timer by 15 seconds next mission.",
            })

        return {"insights": insights}

    def record_mission_completion(
        self,
        preferences: dict,
        mission_id: str,
        tasks_completed: int,
        total_tasks: int,
        rating: Optional[int],
        notes: Optional[str],
    ) -> dict:
        prefs = preferences if isinstance(preferences, dict) else {}
        coach = prefs.setdefault("coach", {})
        history = coach.setdefault("mission_history", [])

        success_rate = round(_safe_div(tasks_completed, max(total_tasks, 1)), 2)
        history.append({
            "mission_id": mission_id,
            "tasks_completed": tasks_completed,
            "total_tasks": total_tasks,
            "success_rate": success_rate,
            "rating": rating,
            "notes": notes,
            "completed_at": _utcnow().isoformat(),
        })
        coach["mission_history"] = history[-60:]
        return prefs

    def _fallback_topic(self, sessions: list[dict]) -> str:
        topics = [str(s.get("topic")) for s in sessions if s.get("topic")]
        if topics:
            return Counter(topics).most_common(1)[0][0]
        return random.choice(
            [
                "work and career",
                "education and learning",
                "travel experiences",
                "technology in daily life",
                "healthy habits",
            ]
        )

    def _map_error_to_skill(self, error: dict) -> str:
        code = str(error.get("error_code", "")).upper()
        category = str(error.get("category", "")).lower()

        if "ARTICLE" in code:
            return "grammar_articles"
        if "TENSE" in code:
            return "grammar_tenses"
        if "AGREEMENT" in code or "SV_" in code:
            return "grammar_agreement"
        if "PREPOSITION" in code:
            return "grammar_prepositions"
        if "COLLOCATION" in code:
            return "vocab_collocations"
        if "REPETITION" in code or "WORD_CHOICE" in code:
            return "vocab_variety"
        if "FILLER" in code:
            return "fluency_fillers"
        if "LINK" in code or "COHERENCE" in code or "PAUSE" in code:
            return "fluency_linking"
        if "INTONATION" in code or "STRESS" in code:
            return "pron_intonation"
        if "TH" in code or "SOUND" in code or "PRON" in code:
            return "pron_clarity"

        # Category fallback
        if category == "grammar":
            return "grammar_tenses"
        if category == "vocabulary":
            return "vocab_variety"
        if category == "fluency":
            return "fluency_linking"
        return "pron_clarity"

    def _default_style_for_category(self, category: str) -> str:
        normalized = (category or "").lower()
        if normalized == "grammar":
            return "rhyme"
        if normalized == "vocabulary":
            return "mini_story"
        if normalized == "pronunciation":
            return "keyword_image"
        return "native_hook"

    def _progress_highlights(self, deltas: dict) -> list[str]:
        highlights = []
        if _safe_float(deltas.get("band_delta")) > 0:
            highlights.append(f"Band trend is up by {deltas['band_delta']:.1f}.")
        if _safe_float(deltas.get("filler_rate_delta")) < 0:
            highlights.append(
                f"Filler usage dropped by {abs(_safe_float(deltas['filler_rate_delta'])):.1f}%."
            )
        if _safe_float(deltas.get("grammar_accuracy_delta")) > 0:
            highlights.append(
                f"Grammar accuracy improved by {deltas['grammar_accuracy_delta']:.1f} points."
            )
        if not highlights:
            highlights.append("You are building consistency. Keep daily missions active.")
        return highlights


coach_engine = CoachEngine()
