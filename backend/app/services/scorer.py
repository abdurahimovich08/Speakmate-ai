"""
SpeakMate AI - IELTS Scoring Service
"""
import google.generativeai as genai
from typing import List, Optional
import json
import os

from app.core.config import settings


class IELTSScorer:
    """Official IELTS-style scoring service."""
    
    # Official IELTS band descriptors (simplified)
    BAND_DESCRIPTORS = {
        "fluency_coherence": {
            9: "Speaks fluently with only rare repetition or self-correction",
            8: "Speaks fluently with only occasional repetition or self-correction",
            7: "Speaks at length without noticeable effort or loss of coherence",
            6: "Is willing to speak at length but may lose coherence at times",
            5: "Usually maintains flow of speech but uses repetition and self-correction",
            4: "Cannot respond without noticeable pauses",
            3: "Speaks with long pauses",
        },
        "lexical_resource": {
            9: "Uses vocabulary with full flexibility and precision",
            8: "Uses a wide vocabulary resource readily and flexibly",
            7: "Uses vocabulary resource flexibly to discuss a variety of topics",
            6: "Has a wide enough vocabulary to discuss topics at length",
            5: "Manages to talk about familiar topics but uses vocabulary with limited flexibility",
            4: "Uses basic vocabulary to convey personal information",
            3: "Uses simple vocabulary to convey personal information",
        },
        "grammatical_range": {
            9: "Uses a full range of structures naturally and appropriately",
            8: "Uses a wide range of structures flexibly",
            7: "Uses a range of complex structures with some flexibility",
            6: "Uses a mix of simple and complex structures",
            5: "Produces basic sentence forms with reasonable accuracy",
            4: "Produces basic sentence forms and some correct simple sentences",
            3: "Attempts basic sentence forms but with limited success",
        },
        "pronunciation": {
            9: "Uses a full range of pronunciation features with precision",
            8: "Uses a wide range of pronunciation features",
            7: "Shows all the positive features of Band 6 and some of Band 8",
            6: "Uses a range of pronunciation features with mixed control",
            5: "Shows some effective use of features but control is variable",
            4: "Uses a limited range of pronunciation features",
            3: "Shows some features but control is very limited",
        }
    }
    
    def __init__(self):
        self.model = None
        self._initialize_model()
        self._load_scoring_prompt()
    
    def _initialize_model(self):
        """Initialize Gemini model."""
        try:
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        except Exception as e:
            print(f"Warning: Could not initialize Gemini for scoring: {e}")
    
    def _load_scoring_prompt(self):
        """Load scoring prompt template."""
        try:
            with open("prompts/ielts_scoring.txt", "r", encoding="utf-8") as f:
                self.scoring_prompt = f.read()
        except FileNotFoundError:
            self.scoring_prompt = ""
    
    async def score_response(
        self,
        transcription: str,
        test_part: int,
        questions: List[str],
        detected_errors: List[dict] = None
    ) -> dict:
        """
        Score a speaking response using IELTS criteria.
        
        Args:
            transcription: Full transcription of user's speech
            test_part: IELTS part (1, 2, or 3)
            questions: Questions that were asked
            detected_errors: Pre-analyzed errors
        
        Returns:
            dict with scores and feedback
        """
        if not self.model:
            # Return estimated scores based on detected errors
            return self._estimate_scores_from_errors(transcription, detected_errors or [])
        
        # Build prompt
        questions_text = "\n".join([f"- {q}" for q in questions])
        
        prompt = self.scoring_prompt.format(
            transcription=transcription,
            test_part=test_part,
            questions=questions_text
        ) if self.scoring_prompt else self._build_default_prompt(
            transcription, test_part, questions_text
        )
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                return self._validate_scores(result)
            
            return self._estimate_scores_from_errors(transcription, detected_errors or [])
            
        except Exception as e:
            print(f"Scoring error: {e}")
            return self._estimate_scores_from_errors(transcription, detected_errors or [])
    
    def _build_default_prompt(
        self,
        transcription: str,
        test_part: int,
        questions: str
    ) -> str:
        """Build default scoring prompt."""
        return f"""Score this IELTS Speaking Part {test_part} response:

QUESTIONS:
{questions}

CANDIDATE'S RESPONSE:
"{transcription}"

Score using official IELTS criteria (0-9 scale, can use half bands):
1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

Return JSON with:
{{
    "scores": {{
        "fluency_coherence": X.X,
        "lexical_resource": X.X,
        "grammatical_range": X.X,
        "pronunciation": X.X,
        "overall_band": X.X
    }},
    "detailed_feedback": {{
        "fluency_coherence": "feedback",
        "lexical_resource": "feedback",
        "grammatical_range": "feedback",
        "pronunciation": "feedback"
    }},
    "strengths": ["strength1", "strength2"],
    "areas_for_improvement": ["area1", "area2"]
}}
"""
    
    def _estimate_scores_from_errors(
        self,
        transcription: str,
        errors: List[dict]
    ) -> dict:
        """Estimate scores based on detected errors."""
        word_count = len(transcription.split())
        
        # Count errors by category
        error_counts = {"grammar": 0, "vocabulary": 0, "fluency": 0, "pronunciation": 0}
        for error in errors:
            cat = error.get("category", "grammar")
            if cat in error_counts:
                error_counts[cat] += 1
        
        # Base score calculation
        def calc_score(error_count: int, base: float = 6.0) -> float:
            if word_count < 20:
                return 5.0  # Not enough content
            
            error_rate = error_count / (word_count / 50)
            
            if error_rate < 0.5:
                return min(base + 1.0, 8.0)
            elif error_rate < 1.0:
                return base + 0.5
            elif error_rate < 2.0:
                return base
            elif error_rate < 3.0:
                return base - 0.5
            else:
                return max(base - 1.0, 4.0)
        
        scores = {
            "fluency_coherence": calc_score(error_counts["fluency"]),
            "lexical_resource": calc_score(error_counts["vocabulary"]),
            "grammatical_range": calc_score(error_counts["grammar"]),
            "pronunciation": calc_score(error_counts["pronunciation"]),
        }
        
        # Overall band
        avg = sum(scores.values()) / 4
        scores["overall_band"] = round(avg * 2) / 2
        
        return {
            "scores": scores,
            "detailed_feedback": {
                "fluency_coherence": self._get_band_descriptor("fluency_coherence", scores["fluency_coherence"]),
                "lexical_resource": self._get_band_descriptor("lexical_resource", scores["lexical_resource"]),
                "grammatical_range": self._get_band_descriptor("grammatical_range", scores["grammatical_range"]),
                "pronunciation": self._get_band_descriptor("pronunciation", scores["pronunciation"]),
            },
            "strengths": self._identify_strengths(scores),
            "areas_for_improvement": self._identify_weaknesses(scores, error_counts),
        }
    
    def _validate_scores(self, result: dict) -> dict:
        """Validate and normalize scores."""
        scores = result.get("scores", {})
        
        # Ensure all scores are within 0-9 range
        for key in scores:
            if isinstance(scores[key], (int, float)):
                scores[key] = max(0, min(9, scores[key]))
        
        # Recalculate overall if needed
        if "overall_band" not in scores:
            component_scores = [
                scores.get("fluency_coherence", 5),
                scores.get("lexical_resource", 5),
                scores.get("grammatical_range", 5),
                scores.get("pronunciation", 5),
            ]
            avg = sum(component_scores) / len(component_scores)
            scores["overall_band"] = round(avg * 2) / 2
        
        result["scores"] = scores
        return result
    
    def _get_band_descriptor(self, criterion: str, score: float) -> str:
        """Get band descriptor for a score."""
        band = int(score)
        descriptors = self.BAND_DESCRIPTORS.get(criterion, {})
        return descriptors.get(band, descriptors.get(5, "Average performance"))
    
    def _identify_strengths(self, scores: dict) -> List[str]:
        """Identify areas where user performed well."""
        strengths = []
        
        if scores.get("fluency_coherence", 0) >= 6.5:
            strengths.append("Good fluency - speaks with reasonable flow")
        if scores.get("lexical_resource", 0) >= 6.5:
            strengths.append("Good vocabulary range")
        if scores.get("grammatical_range", 0) >= 6.5:
            strengths.append("Uses a variety of grammatical structures")
        if scores.get("pronunciation", 0) >= 6.5:
            strengths.append("Clear pronunciation")
        
        if not strengths:
            strengths.append("Willing to communicate and attempt responses")
        
        return strengths
    
    def _identify_weaknesses(
        self,
        scores: dict,
        error_counts: dict
    ) -> List[str]:
        """Identify areas for improvement."""
        weaknesses = []
        
        # Score-based weaknesses
        if scores.get("fluency_coherence", 9) < 6:
            weaknesses.append("Work on speaking more fluently with fewer pauses")
        if scores.get("lexical_resource", 9) < 6:
            weaknesses.append("Expand vocabulary range")
        if scores.get("grammatical_range", 9) < 6:
            weaknesses.append("Practice using more complex grammatical structures")
        if scores.get("pronunciation", 9) < 6:
            weaknesses.append("Focus on clearer pronunciation")
        
        # Error-based weaknesses
        max_error_cat = max(error_counts.items(), key=lambda x: x[1])
        if max_error_cat[1] > 2:
            weaknesses.append(f"Most errors in {max_error_cat[0]} - focus here first")
        
        return weaknesses[:3]  # Top 3 weaknesses
    
    async def compare_with_target(
        self,
        current_scores: dict,
        target_band: float
    ) -> dict:
        """
        Compare current scores with target band.
        
        Args:
            current_scores: Current IELTS scores
            target_band: User's target band score
        
        Returns:
            dict with gap analysis and recommendations
        """
        scores = current_scores.get("scores", current_scores)
        current_overall = scores.get("overall_band", 5.0)
        
        gap = target_band - current_overall
        
        if gap <= 0:
            return {
                "status": "achieved",
                "message": f"Congratulations! You've reached your target of Band {target_band}!",
                "next_target": min(target_band + 0.5, 9.0),
                "recommendations": [
                    "Maintain consistency across different topics",
                    "Challenge yourself with more complex topics",
                    "Practice timed responses for exam conditions"
                ]
            }
        
        # Find weakest areas
        component_scores = {
            "fluency_coherence": scores.get("fluency_coherence", 5),
            "lexical_resource": scores.get("lexical_resource", 5),
            "grammatical_range": scores.get("grammatical_range", 5),
            "pronunciation": scores.get("pronunciation", 5),
        }
        
        sorted_components = sorted(component_scores.items(), key=lambda x: x[1])
        weakest = sorted_components[:2]
        
        recommendations = []
        for component, score in weakest:
            needed = target_band - score
            if needed > 0:
                component_name = component.replace("_", " ").title()
                recommendations.append(
                    f"Improve {component_name} by {needed:.1f} bands"
                )
        
        return {
            "status": "in_progress",
            "current_band": current_overall,
            "target_band": target_band,
            "gap": gap,
            "weakest_areas": [w[0] for w in weakest],
            "recommendations": recommendations,
            "estimated_practice_needed": f"{int(gap * 20)} hours of focused practice"
        }


# Global instance
ielts_scorer = IELTSScorer()
