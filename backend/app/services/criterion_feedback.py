"""
SpeakMate AI - Criterion Feedback Generator

Generates detailed per-criterion IELTS feedback with:
- Score explanations
- Strengths and weaknesses (with examples)
- Actionable tips
- Corrected speech samples

Uses LLM for rich, contextual feedback with a robust
rule-based fallback when LLM is unavailable.
"""
from typing import Dict, Any, List, Optional
import json
import re
import logging

import google.generativeai as genai

from app.core.config import settings
from app.services.prompt_manager import prompt_manager

logger = logging.getLogger(__name__)


class CriterionFeedbackGenerator:
    """
    Generates comprehensive per-criterion feedback for session results.

    Primary: LLM-based generation using Gemini
    Fallback: Rule-based generation from computed metrics
    """

    def __init__(self):
        self.model = None
        self._initialize()

    def _initialize(self):
        """Initialize Gemini model."""
        try:
            api_key = getattr(settings, "GOOGLE_API_KEY", "")
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-pro")
        except Exception as e:
            logger.warning(f"CriterionFeedback: Could not initialize Gemini: {e}")

    async def generate(
        self,
        transcription: str,
        errors: List[Dict],
        fluency_metrics: Dict[str, Any],
        lexical_metrics: Dict[str, Any],
        grammar_metrics: Dict[str, Any],
        scores: Dict[str, Any],
        pronunciation: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate comprehensive per-criterion feedback.

        Returns dict with keys:
          fluency_coherence, lexical_resource, grammatical_range,
          pronunciation, overall_strengths, corrected_sample
        """
        # Try LLM first
        if self.model and transcription.strip():
            try:
                result = await self._generate_with_llm(
                    transcription, errors, fluency_metrics,
                    lexical_metrics, grammar_metrics, scores, pronunciation,
                )
                if result and self._validate_structure(result):
                    return result
            except Exception as e:
                logger.warning(f"LLM criterion feedback failed, using fallback: {e}")

        # Fallback to rule-based
        return self._generate_rule_based(
            transcription, errors, fluency_metrics,
            lexical_metrics, grammar_metrics, scores, pronunciation,
        )

    # ------------------------------------------------------------------
    # LLM generation
    # ------------------------------------------------------------------

    async def _generate_with_llm(
        self,
        transcription: str,
        errors: List[Dict],
        fluency_metrics: Dict,
        lexical_metrics: Dict,
        grammar_metrics: Dict,
        scores: Dict,
        pronunciation: Dict,
    ) -> Optional[Dict]:
        """Call LLM to generate rich criterion feedback."""
        error_summary = self._format_error_summary(errors)
        scores_text = self._format_scores(scores)
        pron_text = self._format_pronunciation(pronunciation)

        prompt_data = prompt_manager.get_prompt(
            "feedback.criterion_analysis",
            transcription=transcription[:3000],  # limit length
            error_summary=error_summary,
            fluency_metrics=json.dumps(fluency_metrics, default=str),
            lexical_metrics=json.dumps(lexical_metrics, default=str),
            grammar_metrics=json.dumps(grammar_metrics, default=str),
            scores=scores_text,
            pronunciation_data=pron_text,
        )

        response = self.model.generate_content(
            prompt_data["prompt"],
            generation_config={
                "temperature": prompt_data["temperature"],
                "max_output_tokens": prompt_data["max_tokens"],
            },
        )

        result_text = response.text
        json_match = re.search(r"\{[\s\S]*\}", result_text)
        if json_match:
            parsed = json.loads(json_match.group())
            return self._normalise_llm_output(parsed)

        return None

    # ------------------------------------------------------------------
    # Rule-based fallback
    # ------------------------------------------------------------------

    def _generate_rule_based(
        self,
        transcription: str,
        errors: List[Dict],
        fluency_metrics: Dict,
        lexical_metrics: Dict,
        grammar_metrics: Dict,
        scores: Dict,
        pronunciation: Dict,
    ) -> Dict[str, Any]:
        """Generate feedback purely from computed metrics and errors."""

        grammar_errors = [e for e in errors if e.get("category") == "grammar"]
        vocab_errors = [e for e in errors if e.get("category") == "vocabulary"]
        fluency_errors = [e for e in errors if e.get("category") == "fluency"]
        pron_errors = [e for e in errors if e.get("category") == "pronunciation"]

        return {
            "fluency_coherence": self._fluency_feedback(
                fluency_metrics, fluency_errors, scores, transcription
            ),
            "lexical_resource": self._lexical_feedback(
                lexical_metrics, vocab_errors, scores, transcription
            ),
            "grammatical_range": self._grammar_feedback(
                grammar_metrics, grammar_errors, scores, transcription
            ),
            "pronunciation": self._pronunciation_feedback(
                pronunciation, pron_errors, scores
            ),
            "overall_strengths": self._overall_strengths(
                fluency_metrics, lexical_metrics, grammar_metrics, pronunciation, errors
            ),
            "corrected_sample": self._build_corrected_sample(errors, transcription),
        }

    # ---- Fluency ----
    def _fluency_feedback(
        self, metrics: Dict, errors: List[Dict], scores: Dict, text: str
    ) -> Dict[str, Any]:
        band = self._get_band(scores, "fluency_coherence")
        wpm = metrics.get("word_count", 0) / max(1, metrics.get("sentence_count", 1)) * 10
        dm = metrics.get("discourse_markers", 0)
        fillers = metrics.get("filler_count", 0)
        filler_density = metrics.get("filler_density", 0)

        strengths: List[str] = []
        if dm >= 3:
            strengths.append(f"Used {dm} discourse markers to connect ideas")
        if filler_density < 0.02:
            strengths.append("Very few filler words — speech sounds natural")
        if metrics.get("avg_sentence_length", 0) >= 10:
            strengths.append("Good sentence length shows developed answers")
        if not strengths:
            strengths.append("Attempted to express ideas coherently")

        weaknesses: List[Dict] = []
        if filler_density >= 0.04:
            weaknesses.append({
                "issue": "High filler word usage",
                "example": f"{fillers} filler words detected",
                "fix": "Pause silently instead of using 'um', 'uh', 'like'",
                "rule": "Filler words reduce Fluency & Coherence score",
            })
        if dm < 2:
            weaknesses.append({
                "issue": "Few discourse markers",
                "example": "Ideas are listed without linking words",
                "fix": "Use connectors: however, moreover, on the other hand, for example",
                "rule": "Band 7+ requires natural use of discourse markers",
            })
        for err in errors[:2]:
            weaknesses.append({
                "issue": err.get("subcategory", "Fluency issue"),
                "example": err.get("original_text", ""),
                "fix": err.get("corrected_text", ""),
                "rule": err.get("explanation", ""),
            })

        tips = [
            "Practice speaking for 2 minutes without stopping on any topic",
            f"Learn these linking phrases: 'however', 'in addition', 'for instance'",
        ]
        if fillers > 2:
            tips.append("Record yourself and count fillers — awareness reduces them by 50%")
        if dm < 3:
            tips.append("Before speaking, mentally plan 2-3 linking words you will use")
        tips.append("Use 'First... Second... Finally...' to structure long answers")

        return {
            "score_explanation": self._fluency_explanation(band, metrics),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "tips": tips[:5],
            "metrics_summary": (
                f"{metrics.get('word_count', 0)} words, "
                f"{metrics.get('sentence_count', 0)} sentences, "
                f"{dm} discourse markers, "
                f"{fillers} fillers ({filler_density:.1%} density)"
            ),
        }

    def _fluency_explanation(self, band: float, metrics: Dict) -> str:
        dm = metrics.get("discourse_markers", 0)
        fillers = metrics.get("filler_count", 0)
        if band >= 7:
            return (
                f"Your speech flows naturally with {dm} discourse markers and minimal hesitation. "
                f"You maintained coherence throughout your response."
            )
        if band >= 6:
            return (
                f"You spoke at reasonable length but had some hesitations. "
                f"{'Filler words (' + str(fillers) + ') slowed your flow. ' if fillers > 2 else ''}"
                f"Adding more linking words would improve coherence."
            )
        return (
            f"Your speech had noticeable pauses and {fillers} filler words. "
            f"Focus on maintaining a steady flow and using discourse markers to connect ideas."
        )

    # ---- Lexical ----
    def _lexical_feedback(
        self, metrics: Dict, errors: List[Dict], scores: Dict, text: str
    ) -> Dict[str, Any]:
        band = self._get_band(scores, "lexical_resource")
        ttr = metrics.get("ttr", 0)
        advanced_ratio = metrics.get("advanced_word_ratio", 0)
        advanced_words = metrics.get("advanced_words", [])
        colloc = metrics.get("collocation_count", 0)
        idioms = metrics.get("idiom_count", 0)

        strengths: List[str] = []
        if ttr >= 0.6:
            strengths.append(f"Good vocabulary variety (Type-Token Ratio: {ttr:.0%})")
        if advanced_ratio >= 0.08:
            top_words = ", ".join(advanced_words[:4]) if advanced_words else "several"
            strengths.append(f"Used advanced vocabulary: {top_words}")
        if colloc >= 2:
            strengths.append(f"Used {colloc} natural collocations")
        if idioms >= 1:
            strengths.append(f"Used {idioms} idiomatic expression(s)")
        if not strengths:
            strengths.append("Vocabulary was sufficient for basic communication")

        weaknesses: List[Dict] = []
        if ttr < 0.45:
            weaknesses.append({
                "issue": "Word repetition — limited vocabulary range",
                "example": f"Type-Token Ratio is {ttr:.0%} (below 45%)",
                "fix": "Use synonyms: good→beneficial, bad→detrimental, important→crucial",
                "rule": "Band 7+ requires paraphrasing and varied word choice",
            })
        if advanced_ratio < 0.05:
            weaknesses.append({
                "issue": "Mostly basic vocabulary",
                "example": f"Only {advanced_ratio:.0%} of words are B2+ level",
                "fix": "Replace common words: 'big'→'substantial', 'get'→'obtain/acquire'",
                "rule": "Lexical Resource rewards less common vocabulary",
            })
        for err in errors[:2]:
            weaknesses.append({
                "issue": err.get("subcategory", "Vocabulary issue"),
                "example": err.get("original_text", ""),
                "fix": err.get("corrected_text", ""),
                "rule": err.get("explanation", ""),
            })

        tips = []
        if ttr < 0.5:
            tips.append("Learn 3 synonyms for every common word you use frequently")
        tips.append("Study topic-specific collocations (e.g., 'make a decision' not 'do a decision')")
        if advanced_ratio < 0.08:
            tips.append("Learn 5 C1-level words per week and practice using them in sentences")
        tips.append("Use precise words instead of vague ones: 'several' instead of 'some', 'rapidly' instead of 'fast'")
        tips.append("Read English articles and highlight words you don't know — add them to flashcards")

        return {
            "score_explanation": self._lexical_explanation(band, metrics),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "tips": tips[:5],
            "metrics_summary": (
                f"{metrics.get('unique_word_count', 0)}/{metrics.get('word_count', 0)} unique words "
                f"(TTR: {ttr:.0%}), "
                f"{advanced_ratio:.0%} advanced, "
                f"{colloc} collocations, {idioms} idioms"
            ),
        }

    def _lexical_explanation(self, band: float, metrics: Dict) -> str:
        ttr = metrics.get("ttr", 0)
        adv = metrics.get("advanced_word_ratio", 0)
        if band >= 7:
            return (
                f"You used vocabulary flexibly with a {ttr:.0%} variety ratio and "
                f"{adv:.0%} advanced words. Good range of expression."
            )
        if band >= 6:
            return (
                f"Adequate vocabulary for the topic but limited variety ({ttr:.0%} TTR). "
                f"Some word repetition was noticed. More advanced vocabulary would raise this score."
            )
        return (
            f"Vocabulary was limited with {ttr:.0%} variety ratio. "
            f"Frequent repetition and basic word choices kept the score lower."
        )

    # ---- Grammar ----
    def _grammar_feedback(
        self, metrics: Dict, errors: List[Dict], scores: Dict, text: str
    ) -> Dict[str, Any]:
        band = self._get_band(scores, "grammatical_range")
        simple = metrics.get("simple_sentences", 0)
        compound = metrics.get("compound_sentences", 0)
        complex_sent = metrics.get("complex_sentences", 0)
        tenses = metrics.get("tenses_used", [])
        features = metrics.get("complex_features", [])
        variety_ratio = metrics.get("structure_variety_ratio", 0)

        strengths: List[str] = []
        if len(tenses) >= 3:
            strengths.append(f"Used {len(tenses)} different tenses: {', '.join(tenses[:4])}")
        if complex_sent >= 2:
            strengths.append(f"Used {complex_sent} complex sentences showing grammatical range")
        if features:
            strengths.append(f"Complex features detected: {', '.join(features[:3])}")
        if variety_ratio >= 0.4:
            strengths.append("Good mix of simple, compound, and complex structures")
        if not strengths:
            strengths.append("Basic sentence structures were mostly accurate")

        weaknesses: List[Dict] = []
        if variety_ratio < 0.2:
            weaknesses.append({
                "issue": "Limited sentence structure variety",
                "example": f"{simple} simple vs {compound + complex_sent} complex sentences",
                "fix": "Combine simple sentences: 'I like it. It is fun.' → 'I like it because it is fun.'",
                "rule": "Band 7+ requires a range of complex structures",
            })
        if len(tenses) < 2:
            weaknesses.append({
                "issue": "Limited tense variety",
                "example": f"Only used: {', '.join(tenses) if tenses else 'one tense'}",
                "fix": "Include past, present, and conditional forms when discussing topics",
                "rule": "Grammatical Range rewards accurate use of multiple tenses",
            })
        # Add actual error examples
        for err in errors[:3]:
            weaknesses.append({
                "issue": err.get("subcategory", "Grammar error"),
                "example": err.get("original_text", ""),
                "fix": err.get("corrected_text", ""),
                "rule": err.get("explanation", ""),
            })

        tips = []
        if variety_ratio < 0.3:
            tips.append("Practice these complex structures: 'Although...', 'If I had...', 'The reason is that...'")
        if len(tenses) < 3:
            tips.append("When telling a story, deliberately use past simple, past perfect, and conditionals")
        tips.append("After each sentence, ask: 'Can I make this more complex with a relative clause?'")
        if errors:
            top_cats = set(e.get("subcategory", "") for e in errors[:5])
            for cat in list(top_cats)[:2]:
                if cat:
                    tips.append(f"Review the rule for: {cat}")
        tips.append("Write 5 sentences daily using different grammatical structures, then speak them aloud")

        return {
            "score_explanation": self._grammar_explanation(band, metrics, errors),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "tips": tips[:5],
            "metrics_summary": (
                f"{simple} simple, {compound} compound, {complex_sent} complex sentences | "
                f"{len(tenses)} tenses | "
                f"{len(features)} complex features | "
                f"Variety: {variety_ratio:.0%}"
            ),
        }

    def _grammar_explanation(self, band: float, metrics: Dict, errors: List[Dict]) -> str:
        variety = metrics.get("structure_variety_ratio", 0)
        tenses = len(metrics.get("tenses_used", []))
        err_count = len(errors)
        if band >= 7:
            return (
                f"You demonstrated good grammatical range with {variety:.0%} structure variety "
                f"and {tenses} tenses. {err_count} error(s) detected but they didn't impede communication."
            )
        if band >= 6:
            return (
                f"A mix of simple and complex structures was used ({variety:.0%} variety), "
                f"but {err_count} grammatical error(s) were found. "
                f"More accurate use of complex structures would improve this score."
            )
        return (
            f"Grammar was mostly limited to simple structures ({variety:.0%} variety) "
            f"with {err_count} error(s). Focus on reducing errors and adding complexity."
        )

    # ---- Pronunciation ----
    def _pronunciation_feedback(
        self, pronunciation: Dict, errors: List[Dict], scores: Dict
    ) -> Dict[str, Any]:
        band = self._get_band(scores, "pronunciation")
        intel = pronunciation.get("intelligibility", {})
        prosody = pronunciation.get("prosody", {})
        feedback_items = pronunciation.get("feedback", [])
        problems = pronunciation.get("problem_areas", [])
        avg_conf = intel.get("avg_confidence", 0)
        wpm = prosody.get("speaking_rate_wpm", 0)
        filler_rate = prosody.get("filler_rate", 0)
        pause_count = prosody.get("pause_count", 0)

        strengths: List[str] = []
        if avg_conf >= 0.85:
            strengths.append(f"High speech clarity ({avg_conf:.0%} confidence)")
        if 110 <= wpm <= 160:
            strengths.append(f"Natural speaking rate ({wpm:.0f} WPM)")
        if filler_rate < 0.03:
            strengths.append("Minimal filler sounds — speech sounds confident")
        if not problems:
            strengths.append("No major pronunciation problem areas detected")
        if not strengths:
            strengths.append("Speech was generally understandable")

        weaknesses: List[Dict] = []
        if avg_conf < 0.75:
            weaknesses.append({
                "issue": "Low speech clarity",
                "example": f"Average confidence: {avg_conf:.0%}",
                "fix": "Slow down slightly and pronounce word endings clearly",
                "rule": "Pronunciation score considers how easily a listener understands you",
            })
        for prob in problems[:3]:
            weaknesses.append({
                "issue": prob.get("description", "Pronunciation issue"),
                "example": prob.get("area", ""),
                "fix": f"Practice this sound with minimal pairs",
                "rule": f"Severity: {prob.get('severity', 'unknown')}",
            })
        if wpm > 180:
            weaknesses.append({
                "issue": "Speaking too fast",
                "example": f"{wpm:.0f} WPM (ideal: 120-160)",
                "fix": "Practice at 130 WPM — clarity is more important than speed",
                "rule": "Rushing causes unclear pronunciation and skipped sounds",
            })

        tips = list(feedback_items[:3])
        if not tips:
            tips.append("Practice tongue twisters to improve clarity")
        if wpm < 100 or wpm > 180:
            tips.append(f"Target 120-160 WPM (current: {wpm:.0f})")
        tips.append("Record yourself and compare with native speakers on the same topic")
        tips.append("Practice word stress patterns: phoTOGraphy, photoGRAPHic, PHOtograph")

        return {
            "score_explanation": self._pronunciation_explanation(band, pronunciation),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "tips": tips[:5],
            "metrics_summary": (
                f"Clarity: {avg_conf:.0%}, "
                f"Rate: {wpm:.0f} WPM, "
                f"Fillers: {filler_rate:.1%}, "
                f"Pauses: {pause_count}, "
                f"Problem areas: {len(problems)}"
            ),
        }

    def _pronunciation_explanation(self, band: float, pron: Dict) -> str:
        avg_conf = pron.get("intelligibility", {}).get("avg_confidence", 0)
        problems = len(pron.get("problem_areas", []))
        if band >= 7:
            return (
                f"Clear pronunciation with {avg_conf:.0%} clarity. "
                f"Natural intonation and rhythm with few issues."
            )
        if band >= 6:
            return (
                f"Generally clear ({avg_conf:.0%} clarity) but {problems} problem area(s) noted. "
                f"Some sounds may cause listener effort."
            )
        return (
            f"Pronunciation needs work ({avg_conf:.0%} clarity, {problems} problem areas). "
            f"Focus on individual sounds and natural stress patterns."
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _overall_strengths(
        self, fluency: Dict, lexical: Dict, grammar: Dict, pron: Dict, errors: List[Dict]
    ) -> List[str]:
        """Identify cross-criterion strengths."""
        strengths: List[str] = []
        wc = fluency.get("word_count", 0)
        if wc >= 100:
            strengths.append(f"Gave a substantial response ({wc} words)")
        if fluency.get("discourse_markers", 0) >= 2:
            strengths.append("Used discourse markers to connect ideas")
        if lexical.get("ttr", 0) >= 0.55:
            strengths.append("Good vocabulary variety")
        if grammar.get("structure_variety_ratio", 0) >= 0.3:
            strengths.append("Mixed sentence structures effectively")
        if pron.get("intelligibility", {}).get("avg_confidence", 0) >= 0.8:
            strengths.append("Speech was clear and easy to understand")
        if len(errors) < 3:
            strengths.append("Very few errors — shows solid language control")
        if not strengths:
            strengths.append("Willingness to communicate and express ideas")
        return strengths[:5]

    def _build_corrected_sample(self, errors: List[Dict], text: str) -> str:
        """Build a corrected version of 2-3 sentences from the transcript."""
        if not errors:
            return ""
        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
        if not sentences:
            return ""
        # Pick sentences that contain errors
        sample_sentences = sentences[:3]
        corrected = " ".join(sample_sentences)
        for err in errors:
            original = err.get("original_text", "")
            fix = err.get("corrected_text", "")
            if original and fix and original in corrected:
                corrected = corrected.replace(original, fix, 1)
        if corrected == " ".join(sample_sentences):
            return ""
        return corrected

    def _get_band(self, scores: Dict, criterion: str) -> float:
        val = scores.get(criterion, 6.0)
        if isinstance(val, dict):
            return val.get("band", 6.0)
        return float(val) if val else 6.0

    def _format_error_summary(self, errors: List[Dict]) -> str:
        if not errors:
            return "No errors detected."
        categories: Dict[str, List[Dict]] = {}
        for e in errors:
            cat = e.get("category", "other")
            categories.setdefault(cat, []).append(e)
        parts = []
        for cat, cat_errors in categories.items():
            examples = [
                f'  - "{e.get("original_text", "")}" → "{e.get("corrected_text", "")}" ({e.get("explanation", "")})'
                for e in cat_errors[:4]
            ]
            parts.append(f"{cat.upper()} ({len(cat_errors)} errors):\n" + "\n".join(examples))
        return "\n\n".join(parts)

    def _format_scores(self, scores: Dict) -> str:
        parts = [f"Overall: {scores.get('overall_band', '?')}"]
        for key in ["fluency_coherence", "lexical_resource", "grammatical_range", "pronunciation"]:
            val = scores.get(key, "?")
            if isinstance(val, dict):
                parts.append(f"{key}: {val.get('band', '?')}")
            else:
                parts.append(f"{key}: {val}")
        return " | ".join(parts)

    def _format_pronunciation(self, pron: Dict) -> str:
        if not pron:
            return "No pronunciation data available."
        intel = pron.get("intelligibility", {})
        prosody = pron.get("prosody", {})
        problems = pron.get("problem_areas", [])
        feedback = pron.get("feedback", [])
        return (
            f"Clarity: {intel.get('avg_confidence', 'N/A')}, "
            f"WPM: {prosody.get('speaking_rate_wpm', 'N/A')}, "
            f"Pauses: {prosody.get('pause_count', 'N/A')}, "
            f"Filler rate: {prosody.get('filler_rate', 'N/A')}, "
            f"Problems: {[p.get('description', '') for p in problems[:3]]}, "
            f"Tips: {feedback[:3]}"
        )

    def _validate_structure(self, data: Dict) -> bool:
        """Check that LLM output has the expected structure."""
        required_keys = [
            "fluency_coherence", "lexical_resource",
            "grammatical_range", "pronunciation",
        ]
        for key in required_keys:
            if key not in data:
                return False
            section = data[key]
            if not isinstance(section, dict):
                return False
            if "score_explanation" not in section:
                return False
        return True

    def _normalise_llm_output(self, data: Dict) -> Dict:
        """Ensure all expected fields exist in LLM output."""
        criteria = [
            "fluency_coherence", "lexical_resource",
            "grammatical_range", "pronunciation",
        ]
        for key in criteria:
            section = data.get(key, {})
            if not isinstance(section, dict):
                section = {}
            section.setdefault("score_explanation", "")
            section.setdefault("strengths", [])
            section.setdefault("weaknesses", [])
            section.setdefault("tips", [])
            section.setdefault("metrics_summary", "")
            # Normalise weaknesses to dicts
            normalised_weaknesses = []
            for w in section["weaknesses"]:
                if isinstance(w, str):
                    normalised_weaknesses.append({
                        "issue": w, "example": "", "fix": "", "rule": ""
                    })
                elif isinstance(w, dict):
                    w.setdefault("issue", "")
                    w.setdefault("example", "")
                    w.setdefault("fix", "")
                    w.setdefault("rule", "")
                    normalised_weaknesses.append(w)
            section["weaknesses"] = normalised_weaknesses
            data[key] = section

        data.setdefault("overall_strengths", [])
        data.setdefault("corrected_sample", "")
        return data


# Global instance
criterion_feedback_generator = CriterionFeedbackGenerator()
