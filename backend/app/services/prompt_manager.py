"""
SpeakMate AI - Prompt Management System (Production)

Features:
- Versioned prompt templates
- Schema validation for outputs
- Usage tracking
- A/B testing support
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
import json
import logging
import os

from pydantic import BaseModel, ValidationError
from jsonschema import validate, ValidationError as JsonSchemaError

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PromptConfig:
    """Configuration for a prompt template."""
    key: str
    version: str
    template: str
    system_instructions: Optional[str] = None
    model: str = "gemini-pro"
    temperature: float = 0.7
    max_tokens: int = 500
    output_schema: Optional[Dict] = None
    tags: List[str] = None


class PromptManager:
    """
    Manages versioned prompt templates with validation.
    
    Features:
    - Load from files or database
    - Variable substitution
    - Output schema validation
    - Usage tracking for analytics
    """
    
    def __init__(self):
        self._prompts: Dict[str, PromptConfig] = {}
        self._usage_stats: Dict[str, Dict] = {}
        self._load_prompts()
    
    def _load_prompts(self):
        """Load all prompt templates from files."""
        
        prompts_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'prompts')
        
        # Core conversation prompts
        self._register_prompt(PromptConfig(
            key="conversation.free",
            version="v1",
            template=self._load_file(prompts_dir, "conversation/free_v1.txt"),
            system_instructions="""You are a friendly English conversation partner.
Never correct errors during conversation - just respond naturally.
Keep responses to 2-3 sentences. Ask follow-up questions.""",
            model="gemini-pro",
            temperature=0.8,
            max_tokens=200
        ))
        
        self._register_prompt(PromptConfig(
            key="conversation.ielts_examiner",
            version="v1",
            template=self._load_file(prompts_dir, "conversation/ielts_examiner_v1.txt") or """
You are an IELTS speaking examiner conducting a formal test.

Part: {part}
Question: {question}
Candidate level estimate: {level}

Guidelines:
- Part 1: Ask simple questions, allow 30s-1min answers
- Part 2: Give cue card, 1 min prep, 2 min response
- Part 3: Ask complex follow-up questions

Be formal but encouraging. Don't help or correct.
Previous exchanges: {history}
""",
            system_instructions="Act as professional IELTS examiner. Be neutral and formal.",
            model="gemini-pro",
            temperature=0.5,
            max_tokens=150
        ))
        
        # Analysis prompts
        self._register_prompt(PromptConfig(
            key="analysis.errors",
            version="v2",
            template="""Analyze this English speech for errors.

Transcription: "{text}"
Speaker's L1: {native_language}

Find errors in:
1. Grammar (tenses, articles, prepositions, agreement)
2. Vocabulary (word choice, collocations)
3. Fluency markers (incomplete sentences, structure)

Return JSON array of errors:
[{
    "category": "grammar|vocabulary|fluency",
    "subcategory": "specific_type",
    "error_code": "GRAM_TENSE_PAST",
    "original_text": "problematic phrase",
    "corrected_text": "correct version",
    "explanation": "why this is wrong",
    "confidence": 0.0-1.0,
    "severity": "minor|moderate|major"
}]

Be thorough but avoid false positives. Return [] if no clear errors.""",
            model="gemini-pro",
            temperature=0.3,
            max_tokens=1000,
            output_schema={
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["category", "original_text", "corrected_text"],
                    "properties": {
                        "category": {"type": "string", "enum": ["grammar", "vocabulary", "fluency"]},
                        "subcategory": {"type": "string"},
                        "error_code": {"type": "string"},
                        "original_text": {"type": "string"},
                        "corrected_text": {"type": "string"},
                        "explanation": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "severity": {"type": "string", "enum": ["minor", "moderate", "major"]}
                    }
                }
            }
        ))
        
        # IELTS Scoring prompt
        self._register_prompt(PromptConfig(
            key="scoring.ielts",
            version="v1",
            template="""Score this IELTS speaking response using official band descriptors.

Transcription: "{transcription}"
Mode: {mode}
Detected errors: {error_summary}

Score each criterion (0-9, 0.5 steps):

1. Fluency and Coherence:
   - Band 7+: speaks fluently, develops topics fully
   - Band 5-6: noticeable pauses, some repetition
   - Band <5: slow with frequent pauses

2. Lexical Resource:
   - Band 7+: flexible, idiomatic, paraphrases
   - Band 5-6: adequate vocabulary, some errors
   - Band <5: limited, repetitive

3. Grammatical Range & Accuracy:
   - Band 7+: variety of structures, few errors
   - Band 5-6: mix of simple/complex, some errors
   - Band <5: limited structures, frequent errors

4. Pronunciation:
   - Band 7+: clear, natural intonation
   - Band 5-6: generally clear, some issues
   - Band <5: pronunciation affects understanding

Return JSON:
{{
    "fluency_coherence": {{
        "band": X.X,
        "evidence": ["quote from transcript"],
        "descriptor": "matched band descriptor"
    }},
    "lexical_resource": {{...}},
    "grammatical_range": {{...}},
    "pronunciation": {{...}},
    "overall_band": X.X,
    "summary": "brief overall assessment"
}}""",
            model="gemini-pro",
            temperature=0.2,
            max_tokens=800
        ))
        
        # Training drill prompts
        self._register_prompt(PromptConfig(
            key="training.drill_generator",
            version="v1",
            template="""Generate a practice drill for this error:

Error code: {error_code}
Category: {category}
Example: "{original}" → "{corrected}"
Explanation: {explanation}

Create a drill with:
1. Task type (fill_blank, multiple_choice, correction, sentence_building)
2. Clear instructions
3. 3-5 practice items
4. Explanations for answers

Return JSON:
{{
    "task_type": "...",
    "instructions": "...",
    "items": [
        {{
            "prompt": "...",
            "options": [...],  // for multiple choice
            "correct_answer": "...",
            "explanation": "..."
        }}
    ],
    "tip": "quick learning tip"
}}""",
            model="gemini-pro",
            temperature=0.5,
            max_tokens=600
        ))
        
        # Feedback generation
        self._register_prompt(PromptConfig(
            key="feedback.session_summary",
            version="v1",
            template="""Generate a brief, encouraging feedback summary.

Session duration: {duration} minutes
Topic: {topic}
Error count: {error_count}
Scores: {scores}
Top issues: {top_issues}

Write 2-3 sentences that:
1. Acknowledge effort
2. Highlight one positive
3. Give one specific actionable tip

Keep tone supportive and motivating. Don't be generic.""",
            model="gemini-pro",
            temperature=0.7,
            max_tokens=150
        ))
        
        # ---- Criterion Feedback prompt (comprehensive per-criterion analysis) ----
        self._register_prompt(PromptConfig(
            key="feedback.criterion_analysis",
            version="v1",
            template="""You are an expert IELTS speaking examiner and English language coach.
Analyze this IELTS speaking response and produce a DETAILED per-criterion feedback report.

=== TRANSCRIPTION ===
"{transcription}"

=== DETECTED ERRORS (grouped by category) ===
{error_summary}

=== COMPUTED METRICS ===
Fluency metrics: {fluency_metrics}
Lexical metrics: {lexical_metrics}
Grammar metrics: {grammar_metrics}

=== CURRENT SCORES ===
{scores}

=== PRONUNCIATION DATA ===
{pronunciation_data}

=== INSTRUCTIONS ===
Generate a comprehensive JSON feedback report. For EACH of the 4 IELTS criteria, provide:
1. score_explanation: 2-3 sentences explaining WHY this score was given, referencing specific parts of the transcript
2. strengths: 2-4 specific things the speaker did well (cite actual phrases from transcript)
3. weaknesses: 2-4 specific issues, each with:
   - issue: what the problem is
   - example: the exact phrase from transcript that shows the problem
   - fix: the corrected version with explanation
   - rule: the grammar/vocabulary/fluency rule being violated (if applicable)
4. tips: 3-5 actionable, specific improvement tips (not generic advice)
5. metrics_summary: one-line summary of key metrics for this criterion

Also provide:
- overall_strengths: 3-5 things the speaker does well across all criteria
- corrected_sample: Rewrite 2-3 sentences from the transcript showing how they SHOULD sound at Band 7+. Keep the same meaning but fix all errors and improve vocabulary/grammar.

Return ONLY valid JSON in this exact structure:
{{
  "fluency_coherence": {{
    "score_explanation": "...",
    "strengths": ["...", "..."],
    "weaknesses": [
      {{"issue": "...", "example": "...", "fix": "...", "rule": "..."}}
    ],
    "tips": ["...", "..."],
    "metrics_summary": "..."
  }},
  "lexical_resource": {{
    "score_explanation": "...",
    "strengths": ["...", "..."],
    "weaknesses": [
      {{"issue": "...", "example": "...", "fix": "...", "rule": "..."}}
    ],
    "tips": ["...", "..."],
    "metrics_summary": "..."
  }},
  "grammatical_range": {{
    "score_explanation": "...",
    "strengths": ["...", "..."],
    "weaknesses": [
      {{"issue": "...", "example": "...", "fix": "...", "rule": "..."}}
    ],
    "tips": ["...", "..."],
    "metrics_summary": "..."
  }},
  "pronunciation": {{
    "score_explanation": "...",
    "strengths": ["...", "..."],
    "weaknesses": [
      {{"issue": "...", "example": "...", "fix": "...", "rule": "..."}}
    ],
    "tips": ["...", "..."],
    "metrics_summary": "..."
  }},
  "overall_strengths": ["...", "...", "..."],
  "corrected_sample": "..."
}}

IMPORTANT:
- Be SPECIFIC — cite actual words/phrases from the transcript, not generic feedback
- Strengths must be REAL things the speaker did well, not invented
- Tips must be actionable and concrete (e.g., "Replace 'good' with 'beneficial/advantageous'" not "use better words")
- The corrected_sample must rewrite actual sentences from the transcript
- If a criterion has no weaknesses, say so honestly
- Keep weaknesses array empty [] if truly no issues found""",
            model="gemini-pro",
            temperature=0.4,
            max_tokens=2000
        ))

        # ---- Coaching prompts ----
        self._register_prompt(PromptConfig(
            key="coaching.free_coach",
            version="v1",
            template=self._load_file(prompts_dir, "coaching/free_coach_v1.txt") or "",
            system_instructions=("You are an expert IELTS speaking coach. "
                                 "Correct gently using recasts. Stay conversational."),
            model="gemini-pro",
            temperature=0.8,
            max_tokens=250
        ))
        
        self._register_prompt(PromptConfig(
            key="coaching.ielts_examiner",
            version="v2",
            template=self._load_file(prompts_dir, "coaching/ielts_examiner_v2.txt") or "",
            system_instructions="You are a professional IELTS examiner. Be neutral and formal.",
            model="gemini-pro",
            temperature=0.5,
            max_tokens=150
        ))
        
        self._register_prompt(PromptConfig(
            key="coaching.training_drill",
            version="v1",
            template=self._load_file(prompts_dir, "coaching/training_drill_v1.txt") or "",
            system_instructions="You are a focused English training coach. Be patient and clear.",
            model="gemini-pro",
            temperature=0.6,
            max_tokens=300
        ))
    
    def _load_file(self, base_dir: str, filename: str) -> Optional[str]:
        """Load prompt from file if exists."""
        filepath = os.path.join(base_dir, filename)
        try:
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    return f.read()
        except Exception as e:
            logger.warning(f"Could not load prompt file {filepath}: {e}")
        return None
    
    def _register_prompt(self, config: PromptConfig):
        """Register a prompt configuration."""
        key = f"{config.key}_{config.version}"
        self._prompts[key] = config
        
        # Also register as latest version
        self._prompts[config.key] = config
        
        logger.debug(f"Registered prompt: {config.key} {config.version}")
    
    def get_prompt(
        self,
        key: str,
        version: Optional[str] = None,
        **variables
    ) -> Dict[str, Any]:
        """
        Get a prompt with variables substituted.
        
        Args:
            key: Prompt key (e.g., "conversation.free")
            version: Specific version or None for latest
            **variables: Variables to substitute
        
        Returns:
            Dict with prompt text, config, and metadata
        """
        lookup_key = f"{key}_{version}" if version else key
        
        config = self._prompts.get(lookup_key)
        if not config:
            raise ValueError(f"Prompt not found: {lookup_key}")
        
        # Substitute variables
        prompt_text = config.template
        for var_name, var_value in variables.items():
            placeholder = "{" + var_name + "}"
            if placeholder in prompt_text:
                prompt_text = prompt_text.replace(placeholder, str(var_value))
        
        # Track usage
        self._track_usage(config.key, config.version)
        
        return {
            "prompt": prompt_text,
            "system_instructions": config.system_instructions,
            "model": config.model,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "version": config.version,
            "key": config.key
        }
    
    def validate_output(
        self,
        key: str,
        output: Any,
        version: Optional[str] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate LLM output against schema.
        
        Returns:
            (is_valid, error_message)
        """
        lookup_key = f"{key}_{version}" if version else key
        config = self._prompts.get(lookup_key)
        
        if not config or not config.output_schema:
            return (True, None)  # No schema = no validation
        
        try:
            validate(instance=output, schema=config.output_schema)
            return (True, None)
        except JsonSchemaError as e:
            return (False, str(e.message))
    
    def _track_usage(self, key: str, version: str):
        """Track prompt usage for analytics."""
        stat_key = f"{key}_{version}"
        
        if stat_key not in self._usage_stats:
            self._usage_stats[stat_key] = {
                "count": 0,
                "first_used": datetime.utcnow(),
                "last_used": None
            }
        
        self._usage_stats[stat_key]["count"] += 1
        self._usage_stats[stat_key]["last_used"] = datetime.utcnow()
    
    def get_usage_stats(self) -> Dict[str, Dict]:
        """Get usage statistics for all prompts."""
        return self._usage_stats
    
    def list_prompts(self) -> List[Dict]:
        """List all registered prompts."""
        seen = set()
        prompts = []
        
        for key, config in self._prompts.items():
            if '_' not in key:  # Skip versioned duplicates
                continue
            if config.key in seen:
                continue
            seen.add(config.key)
            
            prompts.append({
                "key": config.key,
                "version": config.version,
                "model": config.model,
                "has_schema": config.output_schema is not None
            })
        
        return prompts


# Global instance
prompt_manager = PromptManager()
