"""
SpeakMate AI - IELTS Scorer (Production)

Professional IELTS scoring with:
- Evidence-based band assignment
- Official descriptor mapping
- Detailed rubric explanations
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import json
import re
import logging

import google.generativeai as genai

from app.core.config import settings
from app.services.prompt_manager import prompt_manager

logger = logging.getLogger(__name__)


@dataclass
class BandDescriptor:
    """IELTS band descriptor."""
    band: float
    fluency_coherence: str
    lexical_resource: str
    grammatical_range: str
    pronunciation: str


# Official IELTS Band Descriptors (simplified)
BAND_DESCRIPTORS = {
    9.0: BandDescriptor(
        band=9.0,
        fluency_coherence="Speaks fluently with only rare repetition or self-correction",
        lexical_resource="Uses vocabulary with full flexibility and precision",
        grammatical_range="Uses a full range of structures naturally and appropriately",
        pronunciation="Uses a full range of pronunciation features with precision"
    ),
    8.0: BandDescriptor(
        band=8.0,
        fluency_coherence="Speaks fluently with only occasional repetition or self-correction",
        lexical_resource="Uses a wide vocabulary resource readily and flexibly",
        grammatical_range="Uses a wide range of structures flexibly",
        pronunciation="Uses a wide range of pronunciation features"
    ),
    7.0: BandDescriptor(
        band=7.0,
        fluency_coherence="Speaks at length without noticeable effort or loss of coherence",
        lexical_resource="Uses vocabulary resource flexibly to discuss a variety of topics",
        grammatical_range="Uses a range of complex structures with some flexibility",
        pronunciation="Shows all the positive features of Band 6 and some of Band 8"
    ),
    6.0: BandDescriptor(
        band=6.0,
        fluency_coherence="Is willing to speak at length but coherence may be lost at times",
        lexical_resource="Has a wide enough vocabulary for most topics",
        grammatical_range="Uses a mix of simple and complex structures",
        pronunciation="Uses a range of pronunciation features with mixed control"
    ),
    5.0: BandDescriptor(
        band=5.0,
        fluency_coherence="Usually maintains flow but uses repetition and self-correction",
        lexical_resource="Has sufficient vocabulary for familiar topics",
        grammatical_range="Produces basic sentence forms with reasonable accuracy",
        pronunciation="Shows all the positive features of Band 4 and some of Band 6"
    ),
    4.0: BandDescriptor(
        band=4.0,
        fluency_coherence="Cannot respond without noticeable pauses",
        lexical_resource="Is able to talk about familiar topics but limited flexibility",
        grammatical_range="Produces basic sentence forms and some correct simple sentences",
        pronunciation="Uses a limited range of pronunciation features"
    ),
}


class IELTSScorerProduction:
    """
    Production-grade IELTS scorer with evidence tracking.
    """
    
    def __init__(self):
        self.model = None
        self.last_tokens_used = 0
        self._initialize()
    
    def _initialize(self):
        """Initialize Gemini model."""
        try:
            genai.configure(api_key=settings.GOOGLE_API_KEY if hasattr(settings, 'GOOGLE_API_KEY') else '')
            self.model = genai.GenerativeModel('gemini-pro')
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {e}")
    
    async def score_with_evidence(
        self,
        transcription: str,
        errors: List[Dict],
        pronunciation_scores: Dict,
        mode: str
    ) -> Dict[str, Any]:
        """
        Score speaking with evidence from analysis.
        
        Args:
            transcription: Full transcription
            errors: Detected errors from analyzer
            pronunciation_scores: From pronunciation engine
            mode: IELTS mode (part1, part2, part3)
        
        Returns:
            Detailed scores with evidence
        """
        self.last_tokens_used = 0
        
        # Prepare error summary for prompt
        error_summary = self._prepare_error_summary(errors)
        
        # Get scoring prompt
        prompt_data = prompt_manager.get_prompt(
            "scoring.ielts",
            transcription=transcription,
            mode=mode,
            error_summary=error_summary
        )
        
        # Try LLM scoring
        if self.model:
            try:
                llm_scores = await self._get_llm_scores(
                    prompt_data["prompt"],
                    prompt_data["temperature"],
                    prompt_data["max_tokens"]
                )
                
                if llm_scores:
                    # Validate and adjust scores
                    validated = self._validate_and_adjust_scores(
                        llm_scores, errors, pronunciation_scores
                    )
                    return validated
                    
            except Exception as e:
                logger.error(f"LLM scoring failed: {e}")
        
        # Fallback to rule-based scoring
        return self._rule_based_scoring(errors, pronunciation_scores, transcription)
    
    def _prepare_error_summary(self, errors: List[Dict]) -> str:
        """Prepare error summary for scoring prompt."""
        if not errors:
            return "No significant errors detected"
        
        # Group by category
        categories = {}
        for e in errors:
            cat = e.get("category", "other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(e)
        
        summary_parts = []
        for cat, cat_errors in categories.items():
            examples = [f'"{e["original_text"]}" → "{e["corrected_text"]}"' 
                       for e in cat_errors[:3]]
            summary_parts.append(f"{cat.title()} ({len(cat_errors)}): {'; '.join(examples)}")
        
        return "\n".join(summary_parts)
    
    async def _get_llm_scores(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> Optional[Dict]:
        """Get scores from LLM."""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": temperature,
                    "max_output_tokens": max_tokens
                }
            )
            
            self.last_tokens_used = 500  # Estimate
            
            # Parse JSON response
            result_text = response.text
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            
            if json_match:
                return json.loads(json_match.group())
            
            return None
            
        except Exception as e:
            logger.error(f"LLM scoring error: {e}")
            return None
    
    def _validate_and_adjust_scores(
        self,
        llm_scores: Dict,
        errors: List[Dict],
        pronunciation_scores: Dict
    ) -> Dict[str, Any]:
        """Validate LLM scores and adjust if needed."""
        
        # Extract scores
        scores = {
            "fluency_coherence": self._extract_score(llm_scores, "fluency_coherence"),
            "lexical_resource": self._extract_score(llm_scores, "lexical_resource"),
            "grammatical_range": self._extract_score(llm_scores, "grammatical_range"),
            "pronunciation": self._extract_score(llm_scores, "pronunciation"),
        }
        
        # Use pronunciation engine score if available
        if pronunciation_scores.get("overall_score"):
            pron_engine_score = pronunciation_scores["overall_score"]
            # Average LLM and engine scores for pronunciation
            scores["pronunciation"] = round((scores["pronunciation"] + pron_engine_score) / 2 * 2) / 2
        
        # Sanity checks
        error_counts = {}
        for e in errors:
            cat = e.get("category", "other")
            error_counts[cat] = error_counts.get(cat, 0) + 1
        
        # Adjust if too generous given error counts
        if error_counts.get("grammar", 0) > 5 and scores["grammatical_range"] > 7:
            scores["grammatical_range"] = 6.5
        if error_counts.get("vocabulary", 0) > 5 and scores["lexical_resource"] > 7:
            scores["lexical_resource"] = 6.5
        if error_counts.get("fluency", 0) > 3 and scores["fluency_coherence"] > 7:
            scores["fluency_coherence"] = 6.5
        
        # Calculate overall
        overall = (
            scores["fluency_coherence"] +
            scores["lexical_resource"] +
            scores["grammatical_range"] +
            scores["pronunciation"]
        ) / 4
        
        # Round to 0.5
        scores["overall_band"] = round(overall * 2) / 2
        
        # Add evidence and descriptors
        return self._add_evidence_and_descriptors(scores, llm_scores, errors)
    
    def _extract_score(self, llm_scores: Dict, key: str) -> float:
        """Extract and validate a score."""
        if key in llm_scores:
            val = llm_scores[key]
            if isinstance(val, dict):
                score = val.get("band", 6.0)
            else:
                score = val
            
            # Validate range
            score = float(score)
            score = max(4.0, min(9.0, score))
            return round(score * 2) / 2
        
        return 6.0  # Default
    
    def _add_evidence_and_descriptors(
        self,
        scores: Dict,
        llm_scores: Dict,
        errors: List[Dict]
    ) -> Dict[str, Any]:
        """Add evidence and band descriptors to scores."""
        
        result = {"overall_band": scores["overall_band"]}
        
        criteria = ["fluency_coherence", "lexical_resource", "grammatical_range", "pronunciation"]
        
        for criterion in criteria:
            band = scores[criterion]
            
            # Get evidence from LLM if available
            evidence = []
            if criterion in llm_scores and isinstance(llm_scores[criterion], dict):
                evidence = llm_scores[criterion].get("evidence", [])
            
            # Get nearest descriptor
            descriptor_band = round(band)
            if descriptor_band > 9:
                descriptor_band = 9
            if descriptor_band < 4:
                descriptor_band = 4
            
            descriptor = BAND_DESCRIPTORS.get(float(descriptor_band), BAND_DESCRIPTORS[6.0])
            
            # Map criterion to descriptor attribute
            attr_map = {
                "fluency_coherence": "fluency_coherence",
                "lexical_resource": "lexical_resource",
                "grammatical_range": "grammatical_range",
                "pronunciation": "pronunciation"
            }
            descriptor_text = getattr(descriptor, attr_map[criterion], "")
            
            result[criterion] = {
                "band": band,
                "evidence": evidence[:3],
                "descriptor": descriptor_text,
                "error_count": len([e for e in errors if self._criterion_matches_category(criterion, e)])
            }
        
        # Add summary
        result["summary"] = self._generate_summary(scores, errors)
        
        return result
    
    def _criterion_matches_category(self, criterion: str, error: Dict) -> bool:
        """Check if error category matches criterion."""
        category = error.get("category", "")
        mapping = {
            "grammatical_range": "grammar",
            "lexical_resource": "vocabulary",
            "fluency_coherence": "fluency",
            "pronunciation": "pronunciation"
        }
        return category == mapping.get(criterion, "")
    
    def _generate_summary(self, scores: Dict, errors: List[Dict]) -> str:
        """Generate brief assessment summary."""
        overall = scores["overall_band"]
        
        if overall >= 7.5:
            base = "Excellent performance! You demonstrate strong English skills."
        elif overall >= 6.5:
            base = "Good performance. You communicate effectively with some room for improvement."
        elif overall >= 5.5:
            base = "Competent performance. Focus on reducing errors and improving fluency."
        else:
            base = "Keep practicing! Regular speaking practice will help you improve."
        
        # Find weakest area
        criteria = ["fluency_coherence", "lexical_resource", "grammatical_range", "pronunciation"]
        weakest = min(criteria, key=lambda c: scores.get(c, 9))
        
        focus_map = {
            "fluency_coherence": "Work on speaking more smoothly without long pauses.",
            "lexical_resource": "Expand vocabulary and use more varied expressions.",
            "grammatical_range": "Practice using complex sentence structures accurately.",
            "pronunciation": "Focus on clear pronunciation and natural intonation."
        }
        
        return f"{base} {focus_map.get(weakest, '')}"
    
    def _rule_based_scoring(
        self,
        errors: List[Dict],
        pronunciation_scores: Dict,
        transcription: str
    ) -> Dict[str, Any]:
        """Fallback rule-based scoring."""
        
        word_count = len(transcription.split())
        
        # Count errors by category
        error_counts = {"grammar": 0, "vocabulary": 0, "fluency": 0, "pronunciation": 0}
        for e in errors:
            cat = e.get("category", "grammar")
            if cat in error_counts:
                error_counts[cat] += 1
        
        def calc_band(category: str) -> float:
            count = error_counts.get(category, 0)
            rate = count / max(word_count / 50, 1)
            
            if rate < 0.3:
                return 7.5
            elif rate < 0.6:
                return 7.0
            elif rate < 1.0:
                return 6.5
            elif rate < 1.5:
                return 6.0
            elif rate < 2.5:
                return 5.5
            else:
                return 5.0
        
        fluency = calc_band("fluency")
        lexical = calc_band("vocabulary")
        grammar = calc_band("grammar")
        pronunciation = pronunciation_scores.get("overall_score", calc_band("pronunciation"))
        
        overall = round((fluency + lexical + grammar + pronunciation) / 4 * 2) / 2
        
        return {
            "overall_band": overall,
            "fluency_coherence": {
                "band": fluency,
                "evidence": [],
                "descriptor": BAND_DESCRIPTORS.get(round(fluency), BAND_DESCRIPTORS[6.0]).fluency_coherence,
                "error_count": error_counts["fluency"]
            },
            "lexical_resource": {
                "band": lexical,
                "evidence": [],
                "descriptor": BAND_DESCRIPTORS.get(round(lexical), BAND_DESCRIPTORS[6.0]).lexical_resource,
                "error_count": error_counts["vocabulary"]
            },
            "grammatical_range": {
                "band": grammar,
                "evidence": [],
                "descriptor": BAND_DESCRIPTORS.get(round(grammar), BAND_DESCRIPTORS[6.0]).grammatical_range,
                "error_count": error_counts["grammar"]
            },
            "pronunciation": {
                "band": pronunciation,
                "evidence": [],
                "descriptor": BAND_DESCRIPTORS.get(round(pronunciation), BAND_DESCRIPTORS[6.0]).pronunciation,
                "error_count": error_counts["pronunciation"]
            },
            "summary": self._generate_summary({
                "overall_band": overall,
                "fluency_coherence": fluency,
                "lexical_resource": lexical,
                "grammatical_range": grammar,
                "pronunciation": pronunciation
            }, errors)
        }


# Global instance
ielts_scorer = IELTSScorerProduction()
