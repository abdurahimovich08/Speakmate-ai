"""
SpeakMate AI - Supabase Database Client
"""
from supabase import create_client, Client
from typing import Optional
from uuid import UUID
from datetime import datetime
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """Get or create Supabase client instance (lazy singleton)."""
    global _supabase_client
    if _supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized")
    return _supabase_client


class DatabaseService:
    """Database operations service."""
    
    def __init__(self, client: Client = None):
        self._client = client

    @property
    def client(self) -> Client:
        """Lazy access to Supabase client."""
        if self._client is None:
            self._client = get_supabase_client()
        return self._client
    
    # User operations
    async def get_user_profile(self, user_id: str) -> Optional[dict]:
        """Get user profile by ID."""
        response = self.client.table("users").select("*").eq("id", user_id).single().execute()
        return response.data if response.data else None
    
    async def update_user_profile(self, user_id: str, data: dict) -> dict:
        """Update user profile."""
        response = self.client.table("users").update(data).eq("id", user_id).execute()
        return response.data[0] if response.data else None
    
    async def create_user_profile(self, user_id: str, data: dict) -> dict:
        """Create new user profile."""
        data["id"] = user_id
        response = self.client.table("users").insert(data).execute()
        return response.data[0] if response.data else None
    
    # Session operations
    async def create_session(self, user_id: str, mode: str, topic: str = None) -> dict:
        """Create new speaking session."""
        data = {
            "user_id": user_id,
            "mode": mode,
            "topic": topic,
            "duration_seconds": 0,
            "created_at": datetime.utcnow().isoformat()
        }
        response = self.client.table("sessions").insert(data).execute()
        return response.data[0] if response.data else None
    
    async def update_session(self, session_id: str, data: dict) -> dict:
        """Update session data."""
        response = self.client.table("sessions").update(data).eq("id", session_id).execute()
        return response.data[0] if response.data else None
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session by ID."""
        response = self.client.table("sessions").select("*").eq("id", session_id).single().execute()
        return response.data if response.data else None
    
    async def get_user_sessions(self, user_id: str, limit: int = 20) -> list:
        """Get user's recent sessions."""
        response = (
            self.client.table("sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    
    # Conversation turns
    async def save_conversation_turn(self, session_id: str, turn: dict) -> dict:
        """Save a conversation turn."""
        turn["session_id"] = session_id
        response = self.client.table("conversation_turns").insert(turn).execute()
        return response.data[0] if response.data else None
    
    async def get_conversation_turns(self, session_id: str) -> list:
        """Get all turns for a session."""
        response = (
            self.client.table("conversation_turns")
            .select("*")
            .eq("session_id", session_id)
            .order("sequence_order")
            .execute()
        )
        return response.data or []
    
    # Error operations
    async def save_detected_error(self, session_id: str, error: dict) -> dict:
        """Save a detected error."""
        error["session_id"] = session_id
        response = self.client.table("detected_errors").insert(error).execute()
        return response.data[0] if response.data else None
    
    async def save_detected_errors(self, session_id: str, errors: list) -> list:
        """Save multiple detected errors."""
        for error in errors:
            error["session_id"] = session_id
        response = self.client.table("detected_errors").insert(errors).execute()
        return response.data or []
    
    async def get_session_errors(self, session_id: str) -> list:
        """Get all errors for a session."""
        response = (
            self.client.table("detected_errors")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data or []
    
    # Error profile operations
    async def get_user_error_profile(self, user_id: str) -> list:
        """Get user's error profile."""
        response = (
            self.client.table("error_profiles")
            .select("*")
            .eq("user_id", user_id)
            .order("occurrence_count", desc=True)
            .execute()
        )
        return response.data or []
    
    async def update_error_profile(self, user_id: str, category: str, subcategory: str) -> dict:
        """Update or create error profile entry."""
        # Check if exists
        existing = (
            self.client.table("error_profiles")
            .select("*")
            .eq("user_id", user_id)
            .eq("category", category)
            .eq("subcategory", subcategory)
            .execute()
        )
        
        if existing.data:
            # Update existing
            new_count = existing.data[0]["occurrence_count"] + 1
            response = (
                self.client.table("error_profiles")
                .update({
                    "occurrence_count": new_count,
                    "last_occurred": datetime.utcnow().isoformat()
                })
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            # Create new
            response = (
                self.client.table("error_profiles")
                .insert({
                    "user_id": user_id,
                    "category": category,
                    "subcategory": subcategory,
                    "occurrence_count": 1,
                    "improvement_rate": 0.0,
                    "last_occurred": datetime.utcnow().isoformat()
                })
                .execute()
            )
        
        return response.data[0] if response.data else None


# Global instance
db_service = DatabaseService()
