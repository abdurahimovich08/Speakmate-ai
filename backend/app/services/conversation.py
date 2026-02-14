"""
SpeakMate AI - Super Coach Conversation Service (Production)

Three conversation modes:
1. free_coaching  — Natural conversation + gentle corrections every 3-4 turns
2. ielts_examiner — Formal IELTS test simulation (no corrections)
3. training       — Focused drilling on specific error patterns
"""
import google.generativeai as genai
from typing import List, Optional, Dict, Any
import json
import os
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class ConversationService:
    """Gemini-powered IELTS Super Coach."""

    def __init__(self):
        self.model = None
        self._prompts: Dict[str, str] = {}
        self._initialize_model()
        self._load_prompts()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------
    def _initialize_model(self):
        try:
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        except Exception as e:
            logger.warning(f"Could not initialize Gemini: {e}")

    def _load_prompts(self):
        base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "prompts")
        prompt_files = {
            "free_coach": "coaching/free_coach_v1.txt",
            "ielts_examiner": "coaching/ielts_examiner_v2.txt",
            "training_drill": "coaching/training_drill_v1.txt",
            "conversation": "conversation.txt",
        }
        for key, rel_path in prompt_files.items():
            full_path = os.path.join(base_dir, rel_path)
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    self._prompts[key] = f.read()
            except FileNotFoundError:
                logger.warning(f"Prompt file not found: {full_path}")

    # ------------------------------------------------------------------
    # Greeting
    # ------------------------------------------------------------------
    async def generate_greeting(
        self,
        topic: str = "general",
        mode: str = "free_speaking",
        user_name: str = "",
    ) -> str:
        """Generate a coaching-appropriate greeting."""

        if mode == "ielts_test":
            return (
                "Good morning. My name is your IELTS examiner. "
                "This is the speaking component of the IELTS test. "
                "Can you tell me your full name, please?"
            )
        if mode == "training":
            return (
                f"Hi{' ' + user_name if user_name else ''}! "
                "Let's work on improving a specific area today. "
                "I'll give you some practice exercises. Ready to start?"
            )

        # free_speaking / free_coaching
        topic_lower = (topic or "general").lower()
        greetings = {
            "general": "Hello! Great to chat with you. What would you like to talk about today?",
            "work": "Hi there! I'd love to hear about your work. What do you do for a living?",
            "education": "Hello! Let's talk about education. Are you currently studying or working?",
            "travel": "Hi! Travel is such a great topic. Have you been anywhere interesting recently?",
            "technology": "Hello! Technology changes so fast. What tech do you find most useful?",
            "hobbies": "Hi! I'm curious about your hobbies. What do you enjoy doing in your free time?",
            "environment": "Hello! Let's discuss the environment. What issues concern you most?",
            "food": "Hi there! I love talking about food. What's your favourite dish?",
            "sports": "Hello! Are you into sports? What do you like to watch or play?",
            "music": "Hi! Music is a wonderful topic. What kind of music do you enjoy?",
        }
        for key, greeting in greetings.items():
            if key in topic_lower:
                return greeting
        return greetings["general"]

    # ------------------------------------------------------------------
    # Main response generation
    # ------------------------------------------------------------------
    async def generate_response(
        self,
        user_message: str,
        conversation_history: List[dict],
        topic: str = "general",
        mode: str = "free_speaking",
        user_level: str = "B1",
        target_band: float = 7.0,
        error_profile: str = "",
        recent_errors: str = "",
        turn_number: int = 1,
        focus_error: str = "",
        error_category: str = "",
        error_examples: str = "",
    ) -> str:
        """
        Generate a context-aware coaching response.

        Args:
            user_message: The user's latest speech (transcription).
            conversation_history: Previous turns.
            topic: Current topic.
            mode: 'free_speaking' | 'ielts_test' | 'training'
            user_level: CEFR level derived from IELTS band.
            target_band: User's target IELTS band.
            error_profile: Summary of user's common errors.
            recent_errors: Errors detected in the current session so far.
            turn_number: Current turn number (for coaching frequency).
            focus_error / error_category / error_examples: For training mode.
        """
        if not self.model:
            return self._mock_response(mode)

        # Build the history string (last 10 turns for richer context)
        history_text = "\n".join(
            f"{t['role'].upper()}: {t['content']}"
            for t in conversation_history[-10:]
        )

        # Select prompt template based on mode
        if mode == "ielts_test":
            prompt = self._build_ielts_prompt(
                user_message, history_text, topic, user_level, turn_number
            )
        elif mode == "training":
            prompt = self._build_training_prompt(
                user_message, history_text, user_level,
                focus_error, error_category, error_examples,
            )
        else:
            # free_speaking → coaching mode
            prompt = self._build_coaching_prompt(
                user_message, history_text, topic, user_level,
                target_band, error_profile, recent_errors,
            )

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            # Ensure response isn't too long
            if len(text) > 500:
                sentences = text.split(".")
                text = ".".join(sentences[:4]).strip() + "."
            return text
        except Exception as e:
            logger.error(f"Gemini response error: {e}")
            return self._mock_response(mode)

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------
    def _build_coaching_prompt(
        self, user_message, history, topic, level, target_band, error_profile, recent_errors
    ) -> str:
        template = self._prompts.get("free_coach", "")
        if template:
            return template.format(
                level=level,
                target_band=target_band,
                topic=topic,
                error_profile=error_profile or "No data yet",
                recent_errors=recent_errors or "None so far",
                history=history,
                user_message=user_message,
            )
        # Fallback
        return (
            f"You are an IELTS speaking coach. The student (level {level}, target {target_band}) said:\n"
            f'"{user_message}"\n\n'
            f"Topic: {topic}\nHistory:\n{history}\n\n"
            "Respond naturally in 2-3 sentences. If you notice a major error, "
            "gently correct it using a recast. Ask a follow-up question."
        )

    def _build_ielts_prompt(self, user_message, history, topic, level, turn_number) -> str:
        template = self._prompts.get("ielts_examiner", "")
        # Determine part based on turn number
        if turn_number <= 6:
            part = "Part 1 (Introduction)"
        elif turn_number <= 10:
            part = "Part 2 (Long Turn)"
        else:
            part = "Part 3 (Discussion)"

        if template:
            return template.format(
                part=part,
                question=topic,
                level=level,
                turn_number=turn_number,
                history=history,
                user_message=user_message,
            )
        return (
            f"You are an IELTS examiner. {part}. Topic: {topic}.\n"
            f"Candidate said: \"{user_message}\"\n"
            f"History:\n{history}\n\n"
            "Ask the next appropriate question. Do NOT correct or help."
        )

    def _build_training_prompt(
        self, user_message, history, level, focus_error, error_category, error_examples
    ) -> str:
        template = self._prompts.get("training_drill", "")
        if template:
            return template.format(
                level=level,
                focus_error=focus_error or "General practice",
                error_category=error_category or "grammar",
                error_examples=error_examples or "N/A",
                history=history,
                user_message=user_message,
            )
        return (
            f"You are an English training coach. Student level: {level}.\n"
            f"Focus: {focus_error or 'general practice'}\n"
            f'Student said: "{user_message}"\n'
            f"History:\n{history}\n\n"
            "Give targeted practice. Explain the rule briefly, give exercises, provide feedback."
        )

    # ------------------------------------------------------------------
    # IELTS question generation
    # ------------------------------------------------------------------
    async def generate_ielts_question(
        self, part: int, topic: str, previous_questions: List[str] = None
    ) -> str:
        if not self.model:
            defaults = {
                1: "Do you work or are you a student?",
                2: "Describe a place you have visited that impressed you.",
                3: "Why do you think travel is important for personal development?",
            }
            return defaults.get(part, defaults[1])

        prompt = (
            f"Generate one IELTS Speaking Part {part} question about '{topic}'.\n"
            f"Previous questions to avoid: {previous_questions or 'None'}\n"
            "Return ONLY the question text."
        )
        try:
            resp = self.model.generate_content(prompt)
            return resp.text.strip()
        except Exception:
            return "Can you tell me about your daily routine?"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def band_to_cefr(band: float) -> str:
        """Convert IELTS band to approximate CEFR level."""
        if band >= 8.0:
            return "C2"
        if band >= 7.0:
            return "C1"
        if band >= 6.0:
            return "B2"
        if band >= 5.0:
            return "B1"
        if band >= 4.0:
            return "A2"
        return "A1"

    @staticmethod
    def _mock_response(mode: str) -> str:
        import random
        if mode == "ielts_test":
            return random.choice([
                "Thank you. Can you tell me a bit more about that?",
                "Interesting. Why do you think that is?",
                "I see. Can you give me an example?",
            ])
        if mode == "training":
            return random.choice([
                "Good try! Let's look at this more carefully. Can you rephrase that sentence?",
                "Almost! Remember the rule we discussed. Try again.",
            ])
        return random.choice([
            "That's really interesting! Can you tell me more about that?",
            "I see what you mean. What made you feel that way?",
            "Great point! How long have you been interested in this?",
        ])


# Global instance
conversation_service = ConversationService()
