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
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'shall', 'can', 'that', 'this', 'with',
            'from', 'they', 'what', 'when', 'where', 'which', 'but', 'and',
            'for', 'not', 'you', 'all', 'her', 'his', 'its', 'our', 'their',
            'your', 'about', 'into', 'just', 'also', 'than', 'like', 'very',
            'really', 'there', 'here', 'some', 'more', 'much', 'many',
        }
        for word in words:
            if len(word) > 3 and word not in stop_words:
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
    
    # ------------------------------------------------------------------
    # IELTS-style detailed metrics (used by AnalysisCoordinator)
    # ------------------------------------------------------------------
    def compute_fluency_metrics(self, text: str) -> Dict[str, Any]:
        """
        Compute Fluency & Coherence metrics from transcription.

        Returns dict with:
          discourse_markers, self_corrections, filler_density,
          topic_development (simple heuristic)
        """
        words = text.lower().split()
        word_count = len(words) or 1

        # Discourse markers
        dm_patterns = [
            'however', 'moreover', 'furthermore', 'on the other hand',
            'in addition', 'for example', 'for instance', 'in contrast',
            'nevertheless', 'meanwhile', 'therefore', 'consequently',
            'as a result', 'in fact', 'actually', 'basically',
            'first of all', 'secondly', 'finally', 'to sum up',
            'in conclusion', 'so', 'because', 'although', 'even though',
            'while', 'whereas', 'besides', 'anyway', 'well',
        ]
        text_lower = text.lower()
        dm_count = sum(1 for dm in dm_patterns if dm in text_lower)

        # Filler density
        filler_re = r'\b(um+|uh+|er+|ah+|like|you know|basically|i mean)\b'
        filler_count = len(re.findall(filler_re, text_lower))
        filler_density = filler_count / word_count

        # Self-corrections
        sc_patterns = [
            r'\b(i mean|no wait|sorry|what i meant|let me rephrase)\b',
            r'\b(\w+)\s+\1\b',  # immediate repetition (e.g. "I I")
        ]
        sc_count = 0
        for p in sc_patterns:
            sc_count += len(re.findall(p, text_lower))

        # Sentence count (rough)
        sentences = re.split(r'[.!?]+', text)
        sentence_count = max(1, len([s for s in sentences if s.strip()]))
        avg_sentence_length = word_count / sentence_count

        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(avg_sentence_length, 1),
            "discourse_markers": dm_count,
            "filler_count": filler_count,
            "filler_density": round(filler_density, 4),
            "self_correction_count": sc_count,
        }

    def compute_lexical_metrics(self, text: str) -> Dict[str, Any]:
        """
        Compute Lexical Resource metrics.

        Returns TTR, advanced word ratio, basic-only ratio, collocation hints.
        """
        words = re.findall(r'\b[a-z]+\b', text.lower())
        word_count = len(words) or 1
        unique_words = set(words)

        ttr = len(unique_words) / word_count  # Type-Token Ratio

        # Basic vocabulary (first 1000 most common words approximation)
        basic_words = {
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your',
            'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'can', 'could', 'would', 'should',
            'go', 'going', 'get', 'got', 'make', 'take', 'come', 'see',
            'know', 'think', 'say', 'said', 'want', 'give', 'use',
            'good', 'nice', 'bad', 'big', 'small', 'old', 'new',
            'great', 'little', 'long', 'high', 'young', 'important',
            'thing', 'things', 'people', 'time', 'day', 'year', 'way',
            'man', 'woman', 'world', 'life', 'work', 'school', 'home',
            'place', 'house', 'city', 'country', 'very', 'really',
            'also', 'just', 'then', 'than', 'about', 'after', 'before',
            'because', 'but', 'and', 'or', 'not', 'so', 'much', 'many',
            'some', 'other', 'like', 'there', 'here', 'what', 'where',
            'when', 'how', 'why', 'which', 'who', 'this', 'that',
        }
        basic_count = sum(1 for w in words if w in basic_words)
        basic_ratio = basic_count / word_count

        # Advanced vocabulary heuristic (words > 7 letters, not in basic)
        advanced_words = [w for w in unique_words if len(w) > 7 and w not in basic_words]
        advanced_ratio = len(advanced_words) / word_count

        # Collocations (common correct collocations check)
        good_collocations = [
            'make a decision', 'take advantage', 'pay attention',
            'make progress', 'do homework', 'take a break',
            'come to a conclusion', 'have an impact', 'play a role',
            'on the other hand', 'to a certain extent', 'as a matter of fact',
        ]
        collocation_count = sum(1 for c in good_collocations if c in text.lower())

        # Idiomatic expressions
        idioms = [
            'at the end of the day', 'in my opinion', 'from my point of view',
            'when it comes to', 'as far as i know', 'on top of that',
            'to be honest', 'generally speaking', 'broadly speaking',
            'without a doubt', 'it goes without saying',
        ]
        idiom_count = sum(1 for i in idioms if i in text.lower())

        return {
            "word_count": word_count,
            "unique_word_count": len(unique_words),
            "ttr": round(ttr, 3),
            "basic_word_ratio": round(basic_ratio, 3),
            "advanced_word_ratio": round(advanced_ratio, 3),
            "advanced_words": advanced_words[:10],
            "collocation_count": collocation_count,
            "idiom_count": idiom_count,
        }

    def compute_grammar_metrics(self, text: str) -> Dict[str, Any]:
        """
        Compute Grammatical Range & Accuracy metrics.

        Returns sentence structure variety, tense variety, complexity indicators.
        """
        sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
        word_count = len(text.split()) or 1

        # Sentence structure variety
        simple_count = 0
        compound_count = 0
        complex_count = 0

        coordinating = {'and', 'but', 'or', 'so', 'yet', 'for', 'nor'}
        subordinating = {
            'because', 'although', 'even though', 'while', 'whereas',
            'if', 'unless', 'until', 'since', 'when', 'after', 'before',
            'as', 'though', 'whether', 'wherever', 'whenever',
        }

        for sent in sentences:
            words = sent.lower().split()
            has_coord = any(w in coordinating for w in words)
            has_subord = any(sub in sent.lower() for sub in subordinating)
            has_relative = any(r in sent.lower() for r in ['who ', 'which ', 'that '])

            if has_subord or has_relative:
                complex_count += 1
            elif has_coord:
                compound_count += 1
            else:
                simple_count += 1

        total_sent = max(len(sentences), 1)

        # Tense variety
        tense_markers = {
            'present_simple': r'\b(is|am|are|do|does|have|has|go|goes|work|works)\b',
            'past_simple': r'\b(was|were|did|had|went|worked|said|made|came|got)\b',
            'present_continuous': r'\b(am|is|are)\s+\w+ing\b',
            'past_continuous': r'\b(was|were)\s+\w+ing\b',
            'present_perfect': r'\bhave\s+(been|had|made|done|seen|gone|taken|given)\b',
            'future': r'\b(will|going to|shall)\b',
            'conditional': r'\bwould\b',
            'passive': r'\b(was|were|is|are|been)\s+\w+ed\b',
        }
        text_lower = text.lower()
        tenses_found = []
        for tense_name, pattern in tense_markers.items():
            if re.search(pattern, text_lower):
                tenses_found.append(tense_name)

        # Complex structures
        complex_features = {
            'conditional': r'\bif\b.*\bwould\b|\bwould\b.*\bif\b',
            'passive_voice': r'\b(was|were|is|are|been)\s+\w+(ed|en)\b',
            'relative_clause': r'\b(who|which|that|whom|whose)\b',
            'subordinate_clause': '|'.join(subordinating),
            'comparative': r'\b\w+er\s+than\b|\bmore\s+\w+\s+than\b',
            'superlative': r'\bthe\s+\w+est\b|\bthe\s+most\s+\w+\b',
        }
        complex_found = []
        for feat_name, pattern in complex_features.items():
            if re.search(pattern, text_lower):
                complex_found.append(feat_name)

        return {
            "sentence_count": total_sent,
            "simple_sentences": simple_count,
            "compound_sentences": compound_count,
            "complex_sentences": complex_count,
            "structure_variety_ratio": round(
                (compound_count + complex_count) / total_sent, 2
            ),
            "tenses_used": tenses_found,
            "tense_variety": len(tenses_found),
            "complex_features": complex_found,
            "complex_feature_count": len(complex_found),
        }
    
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


    async def get_improvement_suggestions(
        self, errors: List[Dict], current_scores: Dict
    ) -> List[str]:
        """Generate personalized improvement suggestions based on errors and scores."""
        suggestions: List[str] = []

        categories: Dict[str, List[Dict]] = {}
        for error in errors:
            cat = error.get("category", "other")
            categories.setdefault(cat, []).append(error)

        sorted_cats = sorted(categories.items(), key=lambda x: len(x[1]), reverse=True)

        templates = {
            "grammar": "Review {sub} rules — this was your most common grammar issue.",
            "pronunciation": "Work on pronouncing {sub} sounds correctly.",
            "vocabulary": "Expand your vocabulary — try learning synonyms for common words.",
            "fluency": "Practice speaking without filler words like 'um' and 'uh'.",
        }

        for category, cat_errors in sorted_cats[:3]:
            tpl = templates.get(category)
            if tpl and cat_errors:
                subs = [e.get("subcategory", "") for e in cat_errors if e.get("subcategory")]
                most_common = max(set(subs), key=subs.count) if subs else category
                suggestions.append(tpl.format(sub=most_common))

        overall = 0
        if isinstance(current_scores, dict):
            raw = current_scores.get("overall_band", 0)
            try:
                overall = float(raw)
            except (TypeError, ValueError):
                overall = 0

        if overall < 6.0:
            suggestions.append("Focus on accuracy first. Complete sentences correctly.")
        elif overall < 7.0:
            suggestions.append("To reach Band 7, use more complex sentence structures.")
        else:
            suggestions.append("Excellent progress! Focus on consistency and natural expression.")

        return suggestions


# Global instance
hybrid_analyzer = HybridErrorAnalyzer()
