from datetime import datetime, timedelta, timezone

from app.services.coach_engine import coach_engine


def test_build_mnemonic_for_error_has_schedule():
    mnemonic = coach_engine.build_mnemonic_for_error(
        error_code="GRAM_ARTICLE_MISSING",
        category="grammar",
        native_language="uz",
    )

    assert mnemonic["error_code"] == "GRAM_ARTICLE_MISSING"
    assert mnemonic["style"] == "rhyme"
    assert mnemonic["review_schedule_days"] == [1, 3, 7]


def test_infer_difficulty_changes_by_success_rate():
    supportive = coach_engine.infer_difficulty([{"success_rate": 0.5}])
    balanced = coach_engine.infer_difficulty([{"success_rate": 0.75}])
    advanced = coach_engine.infer_difficulty([{"success_rate": 0.9}])

    assert supportive.level == "supportive"
    assert balanced.level == "balanced"
    assert advanced.level == "advanced"


def test_build_skill_graph_returns_top_lists():
    now = datetime.now(timezone.utc)
    errors = [
        {
            "error_code": "GRAM_ARTICLE_MISSING",
            "category": "grammar",
            "created_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "error_code": "FLU_FILLER_WORDS",
            "category": "fluency",
            "created_at": (now - timedelta(days=3)).isoformat(),
        },
        {
            "error_code": "GRAM_ARTICLE_MISSING",
            "category": "grammar",
            "created_at": (now - timedelta(days=20)).isoformat(),
        },
    ]

    graph = coach_engine.build_skill_graph(errors)

    assert len(graph["heatmap"]) >= 5
    assert len(graph["top_weak"]) == 3
    assert isinstance(graph["focus_recommendation"], list)


def test_build_progress_proof_handles_empty_data():
    proof = coach_engine.build_progress_proof([])
    assert proof["status"] == "needs_more_data"


def test_build_progress_proof_calculates_deltas():
    metrics = [
        {
            "created_at": "2026-01-01T10:00:00+00:00",
            "overall_band": 6.0,
            "wpm": 90,
            "filler_rate": 8.0,
            "pause_count": 12,
            "grammar_accuracy": 70,
            "audio_url": "https://example.com/before.mp3",
        },
        {
            "created_at": "2026-01-08T10:00:00+00:00",
            "overall_band": 6.5,
            "wpm": 102,
            "filler_rate": 5.0,
            "pause_count": 8,
            "grammar_accuracy": 76,
            "audio_url": "https://example.com/after.mp3",
        },
    ]

    proof = coach_engine.build_progress_proof(metrics)
    assert proof["deltas"]["band_delta"] == 0.5
    assert proof["deltas"]["filler_rate_delta"] == -3.0
    assert proof["before_after_audio"]["before"] == "https://example.com/before.mp3"
    assert proof["before_after_audio"]["after"] == "https://example.com/after.mp3"

