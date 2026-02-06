"""
SpeakMate AI - Error Analysis Service
"""
import google.generativeai as genai
from typing import List, Optional
import json
import re
import os

from app.core.config import settings


class ErrorAnalyzer:
    """AI-powered error analysis for English speech."""
    
    def __init__(self):
        self.model = None
        self._initialize_model()
        self._load_prompts()
        self._load_error_patterns()
    
    def _initialize_model(self):
        """Initialize Gemini model for analysis."""
        try:
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        except Exception as e:
            print(f"Warning: Could not initialize Gemini for analysis: {e}")
    
    def _load_prompts(self):
        """Load analysis prompt templates."""
        try:
            with open("prompts/error_analysis.txt", "r", encoding="utf-8") as f:
                self.analysis_prompt = f.read()
        except FileNotFoundError:
            self.analysis_prompt = ""
    
    def _load_error_patterns(self):
        """Load common error patterns for different L1 speakers."""
        # Common errors for Uzbek speakers learning English
        self.l1_patterns = {
            "uz": {
                "pronunciation": [
                    {"pattern": r"\bth\w+", "issue": "th_sound", "description": "Uzbek speakers often replace 'th' with 's' or 't'"},
                    {"pattern": r"\w+tion\b", "issue": "tion_ending", "description": "May pronounce '-tion' as separate syllables"},
                    {"pattern": r"\b\w+ed\b", "issue": "ed_ending", "description": "Past tense '-ed' endings may be overpronounced"},
                ],
                "grammar": [
                    {"pattern": r"\b(he|she|it) (go|do|have|make)\b", "issue": "third_person_s", "correction": "Missing -s for third person singular"},
                    {"pattern": r"\b(a|an) (information|advice|furniture)", "issue": "uncountable_article", "correction": "Uncountable nouns don't use a/an"},
                    {"pattern": r"\bdepend from\b", "issue": "preposition_depend", "correction": "Should be 'depend on'"},
                ],
                "vocabulary": [
                    {"pattern": r"\bvery much\b.*\bvery much\b", "issue": "repetition", "description": "Overuse of 'very much'"},
                    {"pattern": r"\b(good|bad|big|small)\b", "issue": "basic_adjectives", "description": "Could use more varied vocabulary"},
                ]
            },
            "ru": {
                "pronunciation": [
                    {"pattern": r"\b\w*h\w*", "issue": "h_sound", "description": "Russian speakers may drop or over-aspirate 'h'"},
                ],
                "grammar": [
                    {"pattern": r"\b(the|a|an)\b", "issue": "articles", "description": "Article usage may be challenging"},
                ]
            }
        }
        
        # Common filler words
        self.filler_patterns = [
            r"\bum+\b",
            r"\buh+\b",
            r"\ber+\b",
            r"\blike\b(?=.*\blike\b)",  # Multiple "like"
            r"\byou know\b",
            r"\bbasically\b",
            r"\bactually\b",
            r"\bso+\b(?=\s*,)",  # "so" followed by pause
        ]
    
    async def analyze_text(
        self,
        text: str,
        native_language: str = "uz",
        topic: str = "general"
    ) -> List[dict]:
        """
        Analyze text for errors.
        
        Args:
            text: Transcribed speech text
            native_language: User's native language code
            topic: Conversation topic for context
        
        Returns:
            List of detected errors
        """
        errors = []
        
        # Rule-based analysis first (fast)
        rule_errors = self._rule_based_analysis(text, native_language)
        errors.extend(rule_errors)
        
        # AI-powered analysis (more thorough)
        if self.model and len(text) > 10:
            ai_errors = await self._ai_analysis(text, native_language, topic)
            errors.extend(ai_errors)
        
        # Deduplicate errors
        unique_errors = self._deduplicate_errors(errors)
        
        return unique_errors
    
    def _rule_based_analysis(self, text: str, native_language: str) -> List[dict]:
        """Apply rule-based error detection."""
        errors = []
        text_lower = text.lower()
        
        # Check L1-specific patterns
        l1_patterns = self.l1_patterns.get(native_language, {})
        
        for category, patterns in l1_patterns.items():
            for pattern_info in patterns:
                matches = re.finditer(pattern_info["pattern"], text_lower, re.IGNORECASE)
                for match in matches:
                    errors.append({
                        "category": category,
                        "subcategory": pattern_info.get("issue", "general"),
                        "original_text": match.group(),
                        "corrected_text": pattern_info.get("correction", "See explanation"),
                        "explanation": pattern_info.get("description", ""),
                        "confidence": 0.7,
                        "timestamp_ms": 0
                    })
        
        # Check filler words
        filler_count = 0
        for pattern in self.filler_patterns:
            matches = re.findall(pattern, text_lower)
            filler_count += len(matches)
        
        if filler_count >= 3:
            errors.append({
                "category": "fluency",
                "subcategory": "filler_words",
                "original_text": f"Multiple filler words detected ({filler_count})",
                "corrected_text": "Try to reduce filler words like 'um', 'uh', 'like', 'you know'",
                "explanation": "Excessive filler words can affect fluency score",
                "confidence": 0.9,
                "timestamp_ms": 0
            })
        
        # Check for very long sentences (fluency)
        sentences = text.split('.')
        for sentence in sentences:
            words = sentence.split()
            if len(words) > 40:
                errors.append({
                    "category": "fluency",
                    "subcategory": "sentence_length",
                    "original_text": sentence[:50] + "...",
                    "corrected_text": "Break into shorter sentences",
                    "explanation": "Very long sentences can be hard to follow",
                    "confidence": 0.6,
                    "timestamp_ms": 0
                })
        
        # Check word repetition
        words = text_lower.split()
        word_count = {}
        for word in words:
            if len(word) > 3:  # Ignore short words
                word_count[word] = word_count.get(word, 0) + 1
        
        for word, count in word_count.items():
            if count >= 4 and word not in ['that', 'this', 'with', 'have', 'from', 'they', 'were', 'been']:
                errors.append({
                    "category": "vocabulary",
                    "subcategory": "word_repetition",
                    "original_text": f"'{word}' used {count} times",
                    "corrected_text": f"Try using synonyms for '{word}'",
                    "explanation": "Repetition can lower lexical resource score",
                    "confidence": 0.75,
                    "timestamp_ms": 0
                })
        
        return errors
    
    async def _ai_analysis(
        self,
        text: str,
        native_language: str,
        topic: str
    ) -> List[dict]:
        """Use AI for deeper error analysis."""
        if not self.model:
            return []
        
        prompt = self.analysis_prompt.format(
            transcription=text,
            native_language=native_language,
            topic=topic
        ) if self.analysis_prompt else f"""
Analyze this English speech for errors:

"{text}"

Return JSON array of errors with: category, subcategory, original_text, corrected_text, explanation, confidence (0-1).
Categories: pronunciation, grammar, vocabulary, fluency.
Be thorough but fair. Only flag clear errors.
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text
            
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                return result.get("errors", [])
            
            # Try parsing as array
            json_array_match = re.search(r'\[[\s\S]*\]', result_text)
            if json_array_match:
                return json.loads(json_array_match.group())
            
            return []
            
        except Exception as e:
            print(f"AI analysis error: {e}")
            return []
    
    def _deduplicate_errors(self, errors: List[dict]) -> List[dict]:
        """Remove duplicate errors."""
        seen = set()
        unique = []
        
        for error in errors:
            key = (
                error.get("category"),
                error.get("subcategory"),
                error.get("original_text", "")[:30]
            )
            if key not in seen:
                seen.add(key)
                unique.append(error)
        
        return unique
    
    async def generate_scores(
        self,
        full_transcription: str,
        errors: List[dict]
    ) -> dict:
        """
        Generate IELTS-style scores based on transcription and errors.
        
        Args:
            full_transcription: Complete speech transcription
            errors: List of detected errors
        
        Returns:
            dict with scores for each category
        """
        # Count errors by category
        error_counts = {
            "pronunciation": 0,
            "grammar": 0,
            "vocabulary": 0,
            "fluency": 0
        }
        
        for error in errors:
            category = error.get("category", "grammar")
            if category in error_counts:
                error_counts[category] += 1
        
        # Calculate word count
        word_count = len(full_transcription.split())
        
        # Base scores (starting from 6.0)
        base_score = 6.0
        
        # Calculate scores based on error density
        def calculate_score(error_count: int, base: float = 6.0) -> float:
            if word_count == 0:
                return base
            
            error_rate = error_count / max(word_count / 50, 1)  # Per 50 words
            
            if error_rate < 0.5:
                return min(base + 1.5, 9.0)
            elif error_rate < 1:
                return min(base + 1.0, 8.5)
            elif error_rate < 2:
                return base + 0.5
            elif error_rate < 3:
                return base
            elif error_rate < 4:
                return max(base - 0.5, 4.0)
            else:
                return max(base - 1.0, 3.5)
        
        scores = {
            "pronunciation": calculate_score(error_counts["pronunciation"]),
            "grammatical_range": calculate_score(error_counts["grammar"]),
            "lexical_resource": calculate_score(error_counts["vocabulary"]),
            "fluency_coherence": calculate_score(error_counts["fluency"]),
        }
        
        # Calculate overall band (average, rounded to nearest 0.5)
        avg = sum(scores.values()) / len(scores)
        overall = round(avg * 2) / 2
        
        scores["overall_band"] = overall
        scores["word_count"] = word_count
        scores["total_errors"] = sum(error_counts.values())
        
        return scores
    
    async def get_improvement_suggestions(
        self,
        errors: List[dict],
        current_scores: dict
    ) -> List[str]:
        """Generate personalized improvement suggestions."""
        suggestions = []
        
        # Group errors by category
        categories = {}
        for error in errors:
            cat = error.get("category", "other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(error)
        
        # Generate suggestions based on most common errors
        sorted_categories = sorted(
            categories.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )
        
        suggestion_templates = {
            "grammar": [
                "Review {subcategory} rules - this was your most common grammar issue.",
                "Practice forming sentences with correct {subcategory}.",
            ],
            "pronunciation": [
                "Work on pronouncing {subcategory} sounds correctly.",
                "Listen to native speakers and practice {subcategory}.",
            ],
            "vocabulary": [
                "Expand your vocabulary by learning synonyms for common words.",
                "Read more to encounter varied vocabulary in context.",
            ],
            "fluency": [
                "Practice speaking without filler words like 'um' and 'uh'.",
                "Try recording yourself and listening back to identify pauses.",
            ]
        }
        
        for category, cat_errors in sorted_categories[:3]:
            templates = suggestion_templates.get(category, [])
            if templates and cat_errors:
                most_common = max(
                    set(e.get("subcategory", "") for e in cat_errors),
                    key=lambda x: sum(1 for e in cat_errors if e.get("subcategory") == x)
                )
                suggestion = templates[0].format(subcategory=most_common)
                suggestions.append(suggestion)
        
        # Add score-based suggestions
        if current_scores.get("overall_band", 0) < 6.0:
            suggestions.append(
                "Focus on accuracy first. Make sure you complete sentences correctly."
            )
        elif current_scores.get("overall_band", 0) < 7.0:
            suggestions.append(
                "To reach Band 7, work on using more complex sentence structures."
            )
        else:
            suggestions.append(
                "Excellent progress! Focus on consistency and natural expression."
            )
        
        return suggestions


# Global instance
error_analyzer = ErrorAnalyzer()
