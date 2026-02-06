"""
SpeakMate AI - Hybrid Error Analyzer (Production)

Combines rule-based detection with LLM for accurate error identification.
Key principle: Fast rules first, LLM for ambiguous cases.
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json
import logging

import google.generativeai as genai

from app.core.config import settings
from app.services.prompt_manager import prompt_manager

logger = logging.getLogger(__name__)


class ErrorCode:
    """Standardized error codes."""
    # Grammar
    GRAM_ARTICLE_MISSING = "GRAM_ARTICLE_MISSING"
    GRAM_ARTICLE_WRONG = "GRAM_ARTICLE_WRONG"
    GRAM_TENSE_PAST = "GRAM_TENSE_PAST"
    GRAM_TENSE_PRESENT = "GRAM_TENSE_PRESENT"
    GRAM_TENSE_FUTURE = "GRAM_TENSE_FUTURE"
    GRAM_TENSE_CONSISTENCY = "GRAM_TENSE_CONSISTENCY"
    GRAM_SV_AGREEMENT = "GRAM_SV_AGREEMENT"
    GRAM_PREPOSITION = "GRAM_PREPOSITION"
    GRAM_WORD_ORDER = "GRAM_WORD_ORDER"
    GRAM_PLURAL_SINGULAR = "GRAM_PLURAL_SINGULAR"
    
    # Vocabulary
    VOC_WORD_CHOICE = "VOC_WORD_CHOICE"
    VOC_COLLOCATION = "VOC_COLLOCATION"
    VOC_REPETITION = "VOC_REPETITION"
    VOC_BASIC_OVERUSE = "VOC_BASIC_OVERUSE"
    VOC_REGISTER = "VOC_REGISTER"
    
    # Fluency
    FLU_FILLER_WORDS = "FLU_FILLER_WORDS"
    FLU_LONG_PAUSE = "FLU_LONG_PAUSE"
    FLU_INCOMPLETE_SENT = "FLU_INCOMPLETE_SENT"
    FLU_SELF_CORRECTION = "FLU_SELF_CORRECTION"
    FLU_REPETITION = "FLU_REPETITION"
    
    # Pronunciation (markers, not actual pronunciation)
    PRON_LIKELY_TH = "PRON_LIKELY_TH"
    PRON_LIKELY_V_W = "PRON_LIKELY_V_W"
    PRON_LIKELY_STRESS = "PRON_LIKELY_STRESS"


class HybridErrorAnalyzer:
    """
    Production-grade error analyzer using hybrid approach.
    
    Pipeline:
    1. Rule-based detection (fast, deterministic)
    2. Pattern matching for L1 interference
    3. LLM adjudication for ambiguous cases
    4. Evidence extraction and confidence scoring
    """
    
    def __init__(self):
        self.model = None
        self._initialize_model()
        self._load_rules()
        self.last_tokens_used = 0
    
    def _initialize_model(self):
        """Initialize Gemini model."""
        try:
            genai.configure(api_key=settings.GOOGLE_API_KEY if hasattr(settings, 'GOOGLE_API_KEY') else '')
            self.model = genai.GenerativeModel('gemini-pro')
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {e}")
    
    def _load_rules(self):
        """Load rule-based patterns."""
        
        # Grammar rules
        self.grammar_rules = [
            # Article errors
            {
                "pattern": r"\b(a)\s+(information|advice|furniture|equipment|luggage|news)\b",
                "code": ErrorCode.GRAM_ARTICLE_WRONG,
                "subcategory": "uncountable_article",
                "message": "Uncountable nouns don't use 'a/an'",
                "correction_template": "Remove 'a' before uncountable noun"
            },
            {
                "pattern": r"\b(an)\s+([bcdfghjklmnpqrstvwxyz])",
                "code": ErrorCode.GRAM_ARTICLE_WRONG,
                "subcategory": "article_an_consonant",
                "message": "'An' is used before vowel sounds, not consonants",
                "correction_template": "Use 'a' instead of 'an'"
            },
            # Subject-verb agreement
            {
                "pattern": r"\b(he|she|it)\s+(go|do|have|make|take|come|give|say|get)\b(?!\s+to)",
                "code": ErrorCode.GRAM_SV_AGREEMENT,
                "subcategory": "third_person_s",
                "message": "Third person singular requires -s/-es",
                "correction_template": "Add -s to the verb"
            },
            {
                "pattern": r"\b(they|we|you|I)\s+(goes|does|has|makes|takes|comes|gives|says|gets)\b",
                "code": ErrorCode.GRAM_SV_AGREEMENT,
                "subcategory": "plural_verb_s",
                "message": "Plural subjects don't take -s on verbs",
                "correction_template": "Remove -s from the verb"
            },
            # Tense errors
            {
                "pattern": r"\byesterday\b.*?\b(go|do|have|make|is|are|am)\b",
                "code": ErrorCode.GRAM_TENSE_PAST,
                "subcategory": "past_tense_missing",
                "message": "Use past tense with 'yesterday'",
                "correction_template": "Change to past tense"
            },
            {
                "pattern": r"\btomorrow\b.*?\b(went|did|had|made|was|were)\b",
                "code": ErrorCode.GRAM_TENSE_FUTURE,
                "subcategory": "future_tense_needed",
                "message": "Use future tense with 'tomorrow'",
                "correction_template": "Change to future tense"
            },
            # Preposition errors (L1 interference for Uzbek speakers)
            {
                "pattern": r"\b(depend|depends|depended)\s+(from|of)\b",
                "code": ErrorCode.GRAM_PREPOSITION,
                "subcategory": "depend_on",
                "message": "'Depend' takes 'on', not 'from/of'",
                "correction_template": "Use 'depend on'"
            },
            {
                "pattern": r"\b(interested)\s+(about|with)\b",
                "code": ErrorCode.GRAM_PREPOSITION,
                "subcategory": "interested_in",
                "message": "'Interested' takes 'in'",
                "correction_template": "Use 'interested in'"
            },
            {
                "pattern": r"\b(arrive)\s+(to)\b",
                "code": ErrorCode.GRAM_PREPOSITION,
                "subcategory": "arrive_at_in",
                "message": "'Arrive' takes 'at' or 'in', not 'to'",
                "correction_template": "Use 'arrive at/in'"
            },
        ]
        
        # Fluency rules
        self.fluency_rules = [
            {
                "pattern": r"\b(um+|uh+|er+)\b",
                "code": ErrorCode.FLU_FILLER_WORDS,
                "subcategory": "filler_hesitation",
                "message": "Filler word detected",
                "severity": "minor"
            },
            {
                "pattern": r"\b(like)\s+(like)\b",
                "code": ErrorCode.FLU_FILLER_WORDS,
                "subcategory": "like_overuse",
                "message": "'Like' used as filler",
                "severity": "minor"
            },
            {
                "pattern": r"\byou know\b.*\byou know\b",
                "code": ErrorCode.FLU_FILLER_WORDS,
                "subcategory": "you_know_overuse",
                "message": "'You know' used multiple times as filler",
                "severity": "minor"
            },
            {
                "pattern": r"\b(basically|actually|honestly)\b.*\b(basically|actually|honestly)\b",
                "code": ErrorCode.FLU_FILLER_WORDS,
                "subcategory": "discourse_marker_overuse",
                "message": "Discourse marker overused",
                "severity": "minor"
            },
        ]
        
        # Vocabulary rules
        self.vocabulary_rules = [
            {
                "pattern": r"\b(good|nice|bad|big|small)\b.*\b\1\b.*\b\1\b",
                "code": ErrorCode.VOC_REPETITION,
                "subcategory": "adjective_repetition",
                "message": "Same basic adjective used multiple times",
                "suggestion": "Try using synonyms"
            },
            {
                "pattern": r"\b(very|really)\s+(very|really)",
                "code": ErrorCode.VOC_BASIC_OVERUSE,
                "subcategory": "intensifier_doubling",
                "message": "Double intensifier detected",
                "suggestion": "Use a stronger adjective instead"
            },
        ]
        
        # L1-specific patterns (Uzbek)
        self.l1_patterns_uz = [
            {
                "pattern": r"\b(think|this|that|the|they|them|their)\b",
                "code": ErrorCode.PRON_LIKELY_TH,
                "subcategory": "th_sound",
                "message": "Word with 'th' sound - Uzbek speakers may pronounce as 's' or 't'",
                "pronunciation_note": True
            },
            {
                "pattern": r"\b(very|have|love|live|give|over)\b",
                "code": ErrorCode.PRON_LIKELY_V_W,
                "subcategory": "v_sound",
                "message": "Word with 'v' sound - check pronunciation",
                "pronunciation_note": True
            },
        ]
    
    async def quick_analysis(self, text: str) -> List[Dict]:
        """
        Fast rule-based analysis only.
        Used for: Fast summary phase
        """
        errors = []
        
        text_lower = text.lower()
        
        # Apply grammar rules
        for rule in self.grammar_rules:
            matches = re.finditer(rule["pattern"], text_lower, re.IGNORECASE)
            for match in matches:
                errors.append({
                    "category": "grammar",
                    "subcategory": rule["subcategory"],
                    "error_code": rule["code"],
                    "original_text": match.group(),
                    "corrected_text": rule["correction_template"],
                    "explanation": rule["message"],
                    "confidence": 0.85,
                    "severity": "moderate",
                    "evidence": {
                        "rule_matched": rule["code"],
                        "match_position": match.span()
                    }
                })
        
        # Apply fluency rules
        for rule in self.fluency_rules:
            matches = re.finditer(rule["pattern"], text_lower, re.IGNORECASE)
            match_count = len(list(re.finditer(rule["pattern"], text_lower, re.IGNORECASE)))
            if match_count > 0:
                errors.append({
                    "category": "fluency",
                    "subcategory": rule["subcategory"],
                    "error_code": rule["code"],
                    "original_text": f"Detected {match_count} times",
                    "corrected_text": "Reduce filler words",
                    "explanation": rule["message"],
                    "confidence": 0.9,
                    "severity": rule.get("severity", "minor"),
                    "evidence": {
                        "occurrence_count": match_count
                    }
                })
        
        # Word repetition check
        words = text_lower.split()
        word_counts = {}
        for word in words:
            if len(word) > 3 and word not in {'that', 'this', 'with', 'have', 'from', 'they', 'were', 'been', 'what', 'when', 'where', 'which'}:
                word_counts[word] = word_counts.get(word, 0) + 1
        
        for word, count in word_counts.items():
            if count >= 4:
                errors.append({
                    "category": "vocabulary",
                    "subcategory": "word_repetition",
                    "error_code": ErrorCode.VOC_REPETITION,
                    "original_text": f"'{word}' used {count} times",
                    "corrected_text": f"Use synonyms for '{word}'",
                    "explanation": "Word repetition affects lexical resource score",
                    "confidence": 0.8,
                    "severity": "minor",
                    "evidence": {
                        "word": word,
                        "count": count
                    }
                })
        
        return errors
    
    async def full_analysis(
        self,
        text: str,
        utterances: List[Dict] = None,
        native_language: str = "uz"
    ) -> List[Dict]:
        """
        Full hybrid analysis with LLM.
        Used for: Deep analysis phase
        """
        self.last_tokens_used = 0
        errors = []
        
        # Step 1: Rule-based analysis
        rule_errors = await self.quick_analysis(text)
        errors.extend(rule_errors)
        
        # Step 2: LLM analysis for complex errors
        if self.model and len(text) > 20:
            llm_errors = await self._llm_analysis(text, native_language)
            
            # Merge and deduplicate
            errors = self._merge_errors(errors, llm_errors)
        
        # Step 3: Add evidence from utterances
        if utterances:
            errors = self._add_timestamp_evidence(errors, utterances)
        
        # Step 4: Calculate impact scores
        errors = self._calculate_impact_scores(errors)
        
        return errors
    
    async def _llm_analysis(self, text: str, native_language: str) -> List[Dict]:
        """Use LLM for deeper analysis."""
        
        prompt = f"""Analyze this English speech transcription for errors. Focus on:
1. Grammar: tense, articles, prepositions, word order, agreement
2. Vocabulary: wrong word choice, incorrect collocations
3. Fluency indicators: incomplete sentences, structure issues

Transcription: "{text}"
Speaker's native language: {native_language}

Return ONLY a JSON array of errors. Each error must have:
- category: "grammar" | "vocabulary" | "fluency"
- subcategory: specific type
- error_code: uppercase code like "GRAM_TENSE_PAST"
- original_text: the problematic phrase
- corrected_text: the correct version
- explanation: brief explanation
- confidence: 0.0-1.0
- severity: "minor" | "moderate" | "major"

Return [] if no errors found. Be thorough but avoid false positives.
"""
        
        try:
            response = self.model.generate_content(prompt)
            self.last_tokens_used = 500  # Estimate
            
            # Parse JSON from response
            result_text = response.text
            
            # Extract JSON array
            json_match = re.search(r'\[[\s\S]*\]', result_text)
            if json_match:
                errors = json.loads(json_match.group())
                
                # Validate and normalize
                validated = []
                for e in errors:
                    if all(k in e for k in ['category', 'original_text', 'corrected_text']):
                        e['evidence'] = {'source': 'llm', 'reasoning': e.get('explanation', '')}
                        validated.append(e)
                
                return validated
            
            return []
            
        except Exception as e:
            logger.error(f"LLM analysis error: {e}")
            return []
    
    def _merge_errors(self, rule_errors: List, llm_errors: List) -> List[Dict]:
        """Merge and deduplicate errors from different sources."""
        
        seen = set()
        merged = []
        
        # Rule-based errors take precedence
        for error in rule_errors:
            key = (error['category'], error['original_text'][:30])
            if key not in seen:
                seen.add(key)
                error['source'] = 'rule'
                merged.append(error)
        
        # Add unique LLM errors
        for error in llm_errors:
            key = (error['category'], error['original_text'][:30])
            if key not in seen:
                seen.add(key)
                error['source'] = 'llm'
                merged.append(error)
        
        return merged
    
    def _add_timestamp_evidence(self, errors: List, utterances: List) -> List[Dict]:
        """Add timestamp evidence from utterances."""
        
        # Build word index
        full_text = ""
        word_map = []  # (word, utterance_idx, word_idx, timestamp)
        
        for u_idx, utterance in enumerate(utterances):
            words = utterance['text'].split()
            timestamps = utterance.get('word_timestamps', [])
            
            for w_idx, word in enumerate(words):
                ts = timestamps[w_idx] if w_idx < len(timestamps) else {}
                word_map.append({
                    'word': word.lower(),
                    'utterance_idx': u_idx,
                    'word_idx': w_idx,
                    'start_ms': ts.get('start_ms', 0),
                    'end_ms': ts.get('end_ms', 0)
                })
        
        # Try to find timestamps for errors
        for error in errors:
            original = error['original_text'].lower()
            first_word = original.split()[0] if original else ''
            
            for wm in word_map:
                if wm['word'] == first_word:
                    error['evidence']['timestamps'] = {
                        'start_ms': wm['start_ms'],
                        'end_ms': wm['end_ms']
                    }
                    error['timestamp_ms'] = wm['start_ms']
                    break
        
        return errors
    
    def _calculate_impact_scores(self, errors: List) -> List[Dict]:
        """Calculate IELTS impact score for each error."""
        
        # Impact weights by category and severity
        impact_weights = {
            'grammar': {'minor': 0.3, 'moderate': 0.5, 'major': 0.8},
            'vocabulary': {'minor': 0.2, 'moderate': 0.4, 'major': 0.6},
            'fluency': {'minor': 0.2, 'moderate': 0.4, 'major': 0.7},
            'pronunciation': {'minor': 0.3, 'moderate': 0.5, 'major': 0.7}
        }
        
        for error in errors:
            cat = error.get('category', 'grammar')
            sev = error.get('severity', 'moderate')
            
            base_impact = impact_weights.get(cat, {}).get(sev, 0.5)
            confidence = error.get('confidence', 0.8)
            
            error['impact_score'] = round(base_impact * confidence, 3)
        
        return errors


# Global instance
hybrid_analyzer = HybridErrorAnalyzer()
