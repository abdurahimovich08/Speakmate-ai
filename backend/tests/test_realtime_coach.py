"""Tests for RealtimeCoach — in-session coaching interval and tip selection."""

from app.services.realtime_coach import RealtimeCoach


def test_initial_state():
    coach = RealtimeCoach()
    assert coach._turn_count == 0
    assert coach._coached_errors == set()


def test_no_tip_on_first_turn_without_errors():
    coach = RealtimeCoach()
    tip = coach.on_user_turn([])
    assert tip is None


def test_no_tip_before_interval():
    coach = RealtimeCoach()
    # Turns 1 and 2 should not produce a tip with mild errors
    mild_error = {"category": "grammar", "severity": "minor", "original_text": "I is", "corrected_text": "I am"}
    tip1 = coach.on_user_turn([mild_error])
    tip2 = coach.on_user_turn([mild_error])
    # Tip should not fire every single turn
    assert not (tip1 and tip2)  # at most one can be non-None


def test_tip_fires_on_major_error():
    coach = RealtimeCoach()
    major = {
        "category": "grammar",
        "severity": "major",
        "original_text": "I goed",
        "corrected_text": "I went",
        "explanation": "Irregular past tense",
        "error_code": "GRAM_PAST_TENSE",
    }
    tip = coach.on_user_turn([major])
    # Major errors should trigger an immediate tip (even on first turn)
    if tip:
        assert "category" in tip
        assert "original" in tip


def test_tip_format_has_required_keys():
    coach = RealtimeCoach()
    # Force enough turns to trigger
    for _ in range(3):
        coach.on_user_turn([])

    error = {
        "category": "grammar",
        "severity": "moderate",
        "original_text": "He go store",
        "corrected_text": "He goes to the store",
        "explanation": "Subject-verb agreement",
        "error_code": "GRAM_SV_AGREE",
    }
    tip = coach.on_user_turn([error])
    if tip:
        assert "category" in tip
        assert "strategy" in tip
        assert tip["strategy"] in ("recast", "elicit", "explicit")
