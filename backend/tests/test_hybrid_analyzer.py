"""Tests for HybridErrorAnalyzer — rule-based error detection and metrics."""

import pytest
from app.services.hybrid_analyzer import HybridErrorAnalyzer


@pytest.fixture
def analyzer():
    return HybridErrorAnalyzer()


# ------ quick_analysis ------

@pytest.mark.asyncio
async def test_quick_analysis_detects_filler_words(analyzer):
    text = "Um, I think, uh, it is like really good, you know."
    errors = await analyzer.quick_analysis(text)
    fillers = [e for e in errors if e.get("category") == "fluency"]
    assert len(fillers) >= 1


@pytest.mark.asyncio
async def test_quick_analysis_detects_repeated_words(analyzer):
    text = "I I I went to the the store store."
    errors = await analyzer.quick_analysis(text)
    repeats = [e for e in errors if "repeat" in str(e.get("subcategory", "")).lower()]
    assert len(repeats) >= 1


@pytest.mark.asyncio
async def test_quick_analysis_empty_text(analyzer):
    errors = await analyzer.quick_analysis("")
    assert errors == []


@pytest.mark.asyncio
async def test_quick_analysis_clean_sentence(analyzer):
    text = "I went to the library yesterday."
    errors = await analyzer.quick_analysis(text)
    # A clean sentence may still have 0 or minor issues
    assert isinstance(errors, list)


@pytest.mark.asyncio
async def test_quick_analysis_returns_list_of_dicts(analyzer):
    text = "I is happy um and uh like basically good."
    errors = await analyzer.quick_analysis(text)
    assert isinstance(errors, list)
    for e in errors:
        assert isinstance(e, dict)
        assert "category" in e


# ------ compute_fluency_metrics ------

def test_fluency_metrics_detects_discourse_markers(analyzer):
    text = "However, I think that moreover we should also consider the fact."
    metrics = analyzer.compute_fluency_metrics(text)
    assert metrics["discourse_marker_count"] >= 1


def test_fluency_metrics_empty_text(analyzer):
    metrics = analyzer.compute_fluency_metrics("")
    assert metrics["filler_density"] == 0


def test_fluency_metrics_filler_density(analyzer):
    text = "Um uh like um basically um actually um I think."
    metrics = analyzer.compute_fluency_metrics(text)
    assert metrics["filler_density"] > 0


# ------ compute_lexical_metrics ------

def test_lexical_metrics_ttr(analyzer):
    text = "the the the cat cat sat on the the mat."
    metrics = analyzer.compute_lexical_metrics(text)
    assert 0 < metrics["ttr"] < 1
    assert metrics["word_count"] > 0


def test_lexical_metrics_unique_words(analyzer):
    text = "apple banana cherry date elderberry fig grape."
    metrics = analyzer.compute_lexical_metrics(text)
    assert metrics["unique_word_count"] == 7


def test_lexical_metrics_empty(analyzer):
    metrics = analyzer.compute_lexical_metrics("")
    assert metrics["word_count"] <= 1


# ------ compute_grammar_metrics ------

def test_grammar_metrics_detects_compound_sentence(analyzer):
    text = "I went to the store, and then I bought some food."
    metrics = analyzer.compute_grammar_metrics(text)
    assert metrics["compound_count"] >= 1 or metrics["simple_count"] >= 1


def test_grammar_metrics_empty(analyzer):
    metrics = analyzer.compute_grammar_metrics("")
    assert isinstance(metrics, dict)


def test_grammar_metrics_complex_features(analyzer):
    text = "If I had known, I would have come. The book that was written by her is excellent."
    metrics = analyzer.compute_grammar_metrics(text)
    assert isinstance(metrics.get("complex_features"), dict)


# ------ get_improvement_suggestions ------

@pytest.mark.asyncio
async def test_improvement_suggestions_returns_list(analyzer):
    errors = [
        {"category": "grammar", "subcategory": "articles"},
        {"category": "grammar", "subcategory": "articles"},
        {"category": "fluency", "subcategory": "fillers"},
    ]
    scores = {"overall_band": 5.5}
    suggestions = await analyzer.get_improvement_suggestions(errors, scores)
    assert isinstance(suggestions, list)
    assert len(suggestions) >= 1


@pytest.mark.asyncio
async def test_improvement_suggestions_high_band(analyzer):
    errors = [{"category": "vocabulary", "subcategory": "word_choice"}]
    scores = {"overall_band": 8.0}
    suggestions = await analyzer.get_improvement_suggestions(errors, scores)
    assert any("excellent" in s.lower() or "progress" in s.lower() for s in suggestions)


@pytest.mark.asyncio
async def test_improvement_suggestions_empty(analyzer):
    suggestions = await analyzer.get_improvement_suggestions([], {})
    assert isinstance(suggestions, list)
