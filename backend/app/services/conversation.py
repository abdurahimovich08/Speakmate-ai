"""
SpeakMate AI - Gemini Conversation Service
"""
import google.generativeai as genai
from typing import List, Optional
import json
import os

from app.core.config import settings


class ConversationService:
    """Gemini-powered conversation service."""
    
    def __init__(self):
        self.model = None
        self._initialize_model()
        self._load_prompts()
    
    def _initialize_model(self):
        """Initialize Gemini model."""
        try:
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        except Exception as e:
            print(f"Warning: Could not initialize Gemini model: {e}")
            print("Conversation service will use mock responses in development.")
    
    def _load_prompts(self):
        """Load prompt templates."""
        self.prompts = {}
        prompt_files = [
            "conversation",
            "error_analysis",
            "ielts_scoring",
            "feedback_generation"
        ]
        
        for prompt_name in prompt_files:
            try:
                with open(f"prompts/{prompt_name}.txt", "r", encoding="utf-8") as f:
                    self.prompts[prompt_name] = f.read()
            except FileNotFoundError:
                print(f"Warning: Prompt file {prompt_name}.txt not found")
                self.prompts[prompt_name] = ""
    
    async def generate_greeting(self, topic: str = "general") -> str:
        """Generate initial conversation greeting."""
        
        greetings = {
            "general": "Hello! It's great to chat with you today. What would you like to talk about?",
            "work": "Hi there! I'd love to hear about your work. What do you do for a living?",
            "education": "Hello! Let's talk about education. Are you currently studying or have you finished your studies?",
            "travel": "Hi! I love talking about travel. Have you been anywhere interesting recently?",
            "technology": "Hello! Technology is such a fascinating topic. What kind of technology do you use most often?",
            "hobbies": "Hi there! I'm curious about your hobbies. What do you like to do in your free time?",
            "environment": "Hello! Let's discuss the environment. What environmental issues concern you the most?",
        }
        
        # Find matching topic or use general
        for key in greetings:
            if key in topic.lower():
                return greetings[key]
        
        return greetings["general"]
    
    async def generate_response(
        self,
        user_message: str,
        conversation_history: List[dict],
        topic: str = "general",
        user_level: str = "B1"
    ) -> str:
        """
        Generate conversational response to user's message.
        
        Args:
            user_message: The user's latest message
            conversation_history: List of previous conversation turns
            topic: Conversation topic
            user_level: User's estimated English level
        
        Returns:
            AI response text
        """
        if not self.model:
            # Mock responses for development
            mock_responses = [
                "That's really interesting! Can you tell me more about that?",
                "I see. What made you feel that way?",
                "That sounds wonderful! How long have you been doing that?",
                "Interesting perspective! Have you always thought that way?",
                "I understand. What do you think will happen in the future?",
            ]
            import random
            return random.choice(mock_responses)
        
        # Format conversation history
        history_text = "\n".join([
            f"{turn['role'].upper()}: {turn['content']}"
            for turn in conversation_history[-6:]  # Last 6 turns for context
        ])
        
        # Build prompt
        prompt = self.prompts.get("conversation", "")
        if prompt:
            prompt = prompt.format(
                topic=topic,
                level=user_level,
                history=history_text
            )
        else:
            prompt = f"""You are a friendly English conversation partner. 
The user said: "{user_message}"
Topic: {topic}
User level: {user_level}

Respond naturally in 2-3 sentences. Ask a follow-up question to keep the conversation going.
Do NOT correct any grammar mistakes - just have a natural conversation."""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini response error: {e}")
            return "That's interesting! Could you tell me more about your thoughts on this?"
    
    async def generate_ielts_question(
        self,
        part: int,
        topic: str,
        previous_questions: List[str] = None
    ) -> str:
        """
        Generate IELTS-style question.
        
        Args:
            part: IELTS part (1, 2, or 3)
            topic: Question topic
            previous_questions: Questions already asked (to avoid repetition)
        
        Returns:
            IELTS question text
        """
        if not self.model:
            # Mock IELTS questions
            part_questions = {
                1: [
                    "Do you work or are you a student?",
                    "What do you like about your hometown?",
                    "How often do you use the internet?",
                ],
                2: [
                    "Describe a book that you have recently read. You should say: what the book was about, why you decided to read it, how long it took you to read it, and explain whether you would recommend this book to others.",
                ],
                3: [
                    "Do you think reading is still important in the digital age?",
                    "How has technology changed the way people read?",
                    "What are the advantages and disadvantages of e-books?",
                ]
            }
            import random
            questions = part_questions.get(part, part_questions[1])
            return random.choice(questions)
        
        prompt = f"""Generate one IELTS Speaking Part {part} question about {topic}.

Part 1: Simple, personal questions (1-2 sentences)
Part 2: Cue card with 4 bullet points to discuss for 2 minutes
Part 3: Abstract, discussion questions requiring longer answers

Previous questions to avoid: {previous_questions or 'None'}

Return ONLY the question, no explanations."""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"IELTS question generation error: {e}")
            return "Can you tell me about your daily routine?"
    
    async def generate_follow_up(
        self,
        user_response: str,
        topic: str,
        depth: int = 1
    ) -> str:
        """
        Generate follow-up question based on user's response.
        
        Args:
            user_response: What the user said
            topic: Current topic
            depth: How deep into the topic (1-3)
        
        Returns:
            Follow-up question
        """
        if not self.model:
            follow_ups = [
                "Why do you think that is?",
                "Can you give me an example?",
                "How does that make you feel?",
                "What would you do differently?",
                "Do you think this will change in the future?",
            ]
            import random
            return random.choice(follow_ups)
        
        prompt = f"""Based on this response about {topic}:
"{user_response}"

Generate a natural follow-up question that:
1. Shows you're listening
2. Encourages elaboration
3. Depth level: {depth}/3 (1=surface, 3=deep analysis)

Return ONLY the follow-up question."""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Follow-up generation error: {e}")
            return "That's interesting. Can you elaborate on that?"


# Global instance
conversation_service = ConversationService()
