from app.api.routes.analysis import _normalize_session_scores


def test_normalize_session_scores_prefers_structured_scores():
    session = {
        "overall_scores": {
            "overall_band": 7.0,
            "fluency_coherence": 6.5,
        },
        "overall_score": 5.0,
    }

    scores = _normalize_session_scores(session)
    assert scores["overall_band"] == 7.0
    assert scores["fluency_coherence"] == 6.5


def test_normalize_session_scores_maps_legacy_fields():
    session = {
        "overall_score": 6.5,
        "fluency_score": 6.0,
        "vocabulary_score": 6.5,
        "grammar_score": 6.0,
        "pronunciation_score": 7.0,
    }

    scores = _normalize_session_scores(session)
    assert scores["overall_band"] == 6.5
    assert scores["fluency_coherence"] == 6.0
    assert scores["lexical_resource"] == 6.5
    assert scores["grammatical_range"] == 6.0
    assert scores["pronunciation"] == 7.0
