"""
SpeakMate AI - Training Engine (Production)

Generates personalized training tasks based on errors.
Implements spaced repetition for effective learning.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import logging
import random

import google.generativeai as genai

from app.core.config import settings
from app.services.prompt_manager import prompt_manager

logger = logging.getLogger(__name__)


@dataclass
class DrillTemplate:
    """Template for generating drills."""
    error_code: str
    task_type: str
    difficulty: float
    template: Dict[str, Any]


# Predefined drill templates
DRILL_TEMPLATES = {
    # Grammar drills
    "GRAM_ARTICLE_MISSING": DrillTemplate(
        error_code="GRAM_ARTICLE_MISSING",
        task_type="fill_blank",
        difficulty=0.3,
        template={
            "instructions": "Choose the correct article (a, an, the, or no article).",
            "items": [
                {"prompt": "I saw ___ elephant at the zoo.", "correct": "an", "options": ["a", "an", "the", "-"]},
                {"prompt": "She is ___ teacher.", "correct": "a", "options": ["a", "an", "the", "-"]},
                {"prompt": "I need ___ information about this.", "correct": "-", "options": ["a", "an", "the", "-"]},
            ],
            "tip": "Use 'a/an' for first mention, 'the' for specific things, no article for uncountable nouns."
        }
    ),
    "GRAM_TENSE_PAST": DrillTemplate(
        error_code="GRAM_TENSE_PAST",
        task_type="correction",
        difficulty=0.4,
        template={
            "instructions": "Correct the verb tense in these sentences.",
            "items": [
                {"prompt": "Yesterday I go to the market.", "correct": "Yesterday I went to the market."},
                {"prompt": "Last week she buy a new car.", "correct": "Last week she bought a new car."},
                {"prompt": "They visit us last month.", "correct": "They visited us last month."},
            ],
            "tip": "With past time markers (yesterday, last week), use past tense forms."
        }
    ),
    "GRAM_SV_AGREEMENT": DrillTemplate(
        error_code="GRAM_SV_AGREEMENT",
        task_type="multiple_choice",
        difficulty=0.3,
        template={
            "instructions": "Choose the correct verb form.",
            "items": [
                {"prompt": "She ___ to school every day.", "options": ["go", "goes"], "correct": "goes"},
                {"prompt": "They ___ playing football.", "options": ["is", "are"], "correct": "are"},
                {"prompt": "He ___ a doctor.", "options": ["is", "are"], "correct": "is"},
            ],
            "tip": "Third person singular (he/she/it) takes -s/-es on verbs in present simple."
        }
    ),
    "GRAM_PREPOSITION": DrillTemplate(
        error_code="GRAM_PREPOSITION",
        task_type="fill_blank",
        difficulty=0.4,
        template={
            "instructions": "Choose the correct preposition.",
            "items": [
                {"prompt": "I'm interested ___ learning English.", "correct": "in", "options": ["in", "on", "at", "about"]},
                {"prompt": "She arrived ___ the airport.", "correct": "at", "options": ["to", "at", "in", "on"]},
                {"prompt": "The answer depends ___ your choice.", "correct": "on", "options": ["on", "of", "from", "to"]},
            ],
            "tip": "Common patterns: interested IN, arrive AT/IN, depend ON, listen TO."
        }
    ),
    # Vocabulary drills
    "VOC_COLLOCATION": DrillTemplate(
        error_code="VOC_COLLOCATION",
        task_type="matching",
        difficulty=0.5,
        template={
            "instructions": "Match the words to form correct collocations.",
            "items": [
                {"word": "make", "matches": ["a decision", "a mistake", "progress"], "wrong": ["a homework"]},
                {"word": "do", "matches": ["homework", "research", "business"], "wrong": ["a decision"]},
                {"word": "take", "matches": ["a break", "notes", "responsibility"], "wrong": ["a progress"]},
            ],
            "tip": "Collocations are word combinations that 'sound right' to native speakers."
        }
    ),
    "VOC_REPETITION": DrillTemplate(
        error_code="VOC_REPETITION",
        task_type="synonym_practice",
        difficulty=0.5,
        template={
            "instructions": "Replace the word with a synonym.",
            "items": [
                {"word": "good", "synonyms": ["excellent", "wonderful", "great", "fantastic", "superb"]},
                {"word": "bad", "synonyms": ["terrible", "awful", "poor", "dreadful", "horrible"]},
                {"word": "big", "synonyms": ["large", "huge", "enormous", "massive", "vast"]},
            ],
            "tip": "Using varied vocabulary improves your Lexical Resource score."
        }
    ),
    # Fluency drills
    "FLU_FILLER_WORDS": DrillTemplate(
        error_code="FLU_FILLER_WORDS",
        task_type="speaking_practice",
        difficulty=0.6,
        template={
            "instructions": "Practice speaking without filler words. Pause silently instead of saying 'um' or 'uh'.",
            "items": [
                {"task": "Describe your daily routine in 1 minute.", "focus": "Replace 'um' with brief pauses"},
                {"task": "Talk about your favorite hobby.", "focus": "Use 'well' or 'let me think' instead of fillers"},
                {"task": "Describe a recent trip.", "focus": "Practice flowing speech with natural pauses"},
            ],
            "tip": "Silent pauses are better than filler words. They give you time to think and sound more confident."
        }
    ),
    # Pronunciation drills
    "PRON_LIKELY_TH": DrillTemplate(
        error_code="PRON_LIKELY_TH",
        task_type="minimal_pairs",
        difficulty=0.6,
        template={
            "instructions": "Practice the 'th' sound with these minimal pairs.",
            "items": [
                {"pair": ["think", "sink"], "focus": "Place tongue between teeth for 'th'"},
                {"pair": ["thick", "sick"], "focus": "Feel air flow over tongue"},
                {"pair": ["math", "mass"], "focus": "Tongue touches upper teeth"},
            ],
            "tip": "The 'th' sound requires placing your tongue between your teeth. Practice in front of a mirror."
        }
    ),
}


class TrainingEngine:
    """
    Generates and manages personalized training tasks.
    
    Features:
    - Error-to-drill mapping
    - Spaced repetition scheduling
    - Progress tracking
    - LLM-assisted drill generation
    """
    
    def __init__(self):
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize Gemini for custom drill generation."""
        try:
            genai.configure(api_key=settings.GOOGLE_API_KEY if hasattr(settings, 'GOOGLE_API_KEY') else '')
            self.model = genai.GenerativeModel('gemini-pro')
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {e}")
    
    async def generate_tasks_for_errors(
        self,
        user_id: str,
        errors: List[Dict]
    ) -> List[Dict]:
        """
        Generate training tasks for detected errors.
        
        Args:
            user_id: User to create tasks for
            errors: List of error instances
        
        Returns:
            List of training task definitions
        """
        tasks = []
        
        # Group errors by code
        error_codes = {}
        for error in errors:
            code = error.get("error_code", "GRAM_OTHER")
            if code not in error_codes:
                error_codes[code] = []
            error_codes[code].append(error)
        
        # Generate tasks for each error type
        for code, code_errors in error_codes.items():
            # Get predefined template if available
            if code in DRILL_TEMPLATES:
                template = DRILL_TEMPLATES[code]
                task = self._create_task_from_template(
                    user_id=user_id,
                    template=template,
                    errors=code_errors
                )
                tasks.append(task)
            else:
                # Generate custom drill using LLM
                task = await self._generate_custom_drill(
                    user_id=user_id,
                    error_code=code,
                    errors=code_errors
                )
                if task:
                    tasks.append(task)
        
        return tasks
    
    def _create_task_from_template(
        self,
        user_id: str,
        template: DrillTemplate,
        errors: List[Dict]
    ) -> Dict:
        """Create task from predefined template."""
        
        # Customize with user's actual errors
        custom_items = []
        
        for error in errors[:3]:  # Up to 3 custom items
            original = error.get("original_text", "")
            corrected = error.get("corrected_text", "")
            
            if template.task_type == "correction":
                custom_items.append({
                    "prompt": original,
                    "correct": corrected,
                    "from_session": True
                })
            elif template.task_type == "fill_blank":
                # Try to create fill-blank from error
                # This is simplified - real implementation would be smarter
                pass
        
        # Combine custom items with template items
        all_items = custom_items + template.template.get("items", [])
        
        return {
            "user_id": user_id,
            "task_type": template.task_type,
            "error_code": template.error_code,
            "content": {
                "instructions": template.template.get("instructions", ""),
                "items": all_items[:5],  # Max 5 items per task
                "tip": template.template.get("tip", "")
            },
            "difficulty": template.difficulty,
            "interval_days": 1,
            "ease_factor": 2.5,
            "next_due_at": datetime.utcnow().isoformat(),
            "status": "active"
        }
    
    async def _generate_custom_drill(
        self,
        user_id: str,
        error_code: str,
        errors: List[Dict]
    ) -> Optional[Dict]:
        """Generate custom drill using LLM."""
        
        if not self.model:
            return None
        
        if not errors:
            return None
        
        example_error = errors[0]
        
        try:
            prompt_data = prompt_manager.get_prompt(
                "training.drill_generator",
                error_code=error_code,
                category=example_error.get("category", "grammar"),
                original=example_error.get("original_text", ""),
                corrected=example_error.get("corrected_text", ""),
                explanation=example_error.get("explanation", "")
            )
            
            response = self.model.generate_content(prompt_data["prompt"])
            
            # Parse response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response.text)
            if json_match:
                drill_content = json.loads(json_match.group())
                
                return {
                    "user_id": user_id,
                    "task_type": drill_content.get("task_type", "correction"),
                    "error_code": error_code,
                    "content": drill_content,
                    "difficulty": 0.5,
                    "interval_days": 1,
                    "ease_factor": 2.5,
                    "next_due_at": datetime.utcnow().isoformat(),
                    "status": "active"
                }
            
        except Exception as e:
            logger.error(f"Custom drill generation failed: {e}")
        
        return None
    
    def calculate_next_review(
        self,
        task: Dict,
        was_correct: bool
    ) -> Dict:
        """
        Calculate next review using SM-2 algorithm.
        
        Args:
            task: Current task data
            was_correct: Whether user got it right
        
        Returns:
            Updated task with new schedule
        """
        ease_factor = task.get("ease_factor", 2.5)
        interval = task.get("interval_days", 1)
        repetition = task.get("repetition_count", 0)
        
        if was_correct:
            # Increase interval
            if repetition == 0:
                new_interval = 1
            elif repetition == 1:
                new_interval = 6
            else:
                new_interval = round(interval * ease_factor)
            
            # Adjust ease factor (slightly increase)
            new_ease = max(1.3, ease_factor + 0.1)
            new_repetition = repetition + 1
        else:
            # Reset interval
            new_interval = 1
            new_repetition = 0
            
            # Decrease ease factor
            new_ease = max(1.3, ease_factor - 0.2)
        
        # Calculate next due date
        next_due = datetime.utcnow() + timedelta(days=new_interval)
        
        return {
            **task,
            "interval_days": new_interval,
            "ease_factor": round(new_ease, 2),
            "repetition_count": new_repetition,
            "next_due_at": next_due.isoformat(),
            "last_practiced_at": datetime.utcnow().isoformat(),
            "last_result": "correct" if was_correct else "incorrect"
        }
    
    async def get_due_tasks(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """Get tasks due for review."""
        from app.db.supabase import db_service
        
        # This would query the database
        # For now, return placeholder
        return []
    
    async def record_practice_result(
        self,
        task_id: str,
        was_correct: bool
    ):
        """Record practice session result."""
        from app.db.supabase import db_service
        
        # Get task
        # Update with new schedule
        # Save to database
        pass
    
    def generate_session_plan(
        self,
        error_profile: Dict,
        available_minutes: int = 15
    ) -> List[Dict]:
        """
        Generate a training session plan based on error profile.
        
        Args:
            error_profile: User's aggregated error data
            available_minutes: Time available for practice
        
        Returns:
            Ordered list of tasks for the session
        """
        tasks = []
        
        # Prioritize high-frequency errors
        error_counts = error_profile.get("by_code", {})
        sorted_errors = sorted(
            error_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Estimate 2-3 minutes per task
        max_tasks = available_minutes // 3
        
        for error_code, count in sorted_errors[:max_tasks]:
            if error_code in DRILL_TEMPLATES:
                template = DRILL_TEMPLATES[error_code]
                tasks.append({
                    "error_code": error_code,
                    "task_type": template.task_type,
                    "priority": "high" if count > 3 else "medium",
                    "estimated_minutes": 3
                })
        
        return tasks


# Global instance
training_engine = TrainingEngine()
