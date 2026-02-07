"""
SpeakMate AI - Supabase Database Client
"""
from supabase import create_client, Client
from typing import Optional
from uuid import UUID
from uuid import uuid4
from datetime import datetime
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """Get or create Supabase client instance (lazy singleton)."""
    global _supabase_client
    if _supabase_client is None:
        if not settings.SUPABASE_URL or (not settings.SUPABASE_SERVICE_ROLE_KEY and not settings.SUPABASE_KEY):
            raise RuntimeError("SUPABASE_URL and at least one Supabase key must be set")
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        if settings.SUPABASE_SERVICE_ROLE_KEY:
            logger.info("Using SUPABASE_SERVICE_ROLE_KEY for server-side database operations")
        else:
            logger.warning("SUPABASE_SERVICE_ROLE_KEY not set; falling back to SUPABASE_KEY")
        _supabase_client = create_client(settings.SUPABASE_URL, key)
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

    # Super coach operations
    async def get_coach_daily_mission(self, user_id: str, mission_date: str) -> Optional[dict]:
        """Get stored daily mission by date."""
        try:
            response = (
                self.client.table("coach_daily_missions")
                .select("*")
                .eq("user_id", user_id)
                .eq("mission_date", mission_date)
                .limit(1)
                .execute()
            )
            rows = response.data or []
            return rows[0] if rows else None
        except Exception:
            return None

    async def upsert_coach_daily_mission(
        self,
        user_id: str,
        mission_date: str,
        mission_payload: dict,
        difficulty: Optional[str] = None,
        best_hour: Optional[int] = None,
    ) -> Optional[dict]:
        """Create or update daily mission snapshot."""
        try:
            payload = {
                "user_id": user_id,
                "mission_date": mission_date,
                "mission_payload": mission_payload,
                "difficulty": difficulty,
                "best_hour": best_hour,
                "updated_at": datetime.utcnow().isoformat(),
            }
            response = (
                self.client.table("coach_daily_missions")
                .upsert(payload, on_conflict="user_id,mission_date")
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            return None

    async def complete_coach_daily_mission(
        self,
        user_id: str,
        mission_date: str,
        mission_id: str,
        tasks_completed: int,
        total_tasks: int,
        rating: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Optional[dict]:
        """Mark mission as completed and store performance."""
        success_rate = tasks_completed / max(total_tasks, 1)
        try:
            response = (
                self.client.table("coach_daily_missions")
                .update(
                    {
                        "status": "completed",
                        "tasks_completed": tasks_completed,
                        "total_tasks": total_tasks,
                        "success_rate": round(success_rate, 3),
                        "rating": rating,
                        "completion_notes": notes,
                        "completed_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                )
                .eq("user_id", user_id)
                .eq("mission_date", mission_date)
                .execute()
            )
            if response.data:
                return response.data[0]
        except Exception:
            pass

        # Fallback when mission row doesn't exist yet.
        try:
            payload = {
                "user_id": user_id,
                "mission_date": mission_date,
                "mission_payload": {"mission_id": mission_id},
                "status": "completed",
                "tasks_completed": tasks_completed,
                "total_tasks": total_tasks,
                "success_rate": round(success_rate, 3),
                "rating": rating,
                "completion_notes": notes,
                "completed_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            inserted = self.client.table("coach_daily_missions").insert(payload).execute()
            return inserted.data[0] if inserted.data else None
        except Exception:
            return None

    async def get_coach_mission_history(self, user_id: str, limit: int = 60) -> list:
        """Get mission history for coaching adaptation."""
        try:
            response = (
                self.client.table("coach_daily_missions")
                .select("mission_payload,success_rate,rating,completed_at,mission_date")
                .eq("user_id", user_id)
                .order("mission_date", desc=False)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception:
            return []

    async def save_mnemonic_feedback(
        self,
        user_id: str,
        error_code: str,
        style: str,
        helpfulness: int,
        comment: Optional[str] = None,
    ) -> Optional[dict]:
        """Persist user feedback for mnemonic quality tuning."""
        try:
            response = (
                self.client.table("coach_mnemonic_feedback")
                .insert(
                    {
                        "user_id": user_id,
                        "error_code": error_code,
                        "style": style,
                        "helpfulness": helpfulness,
                        "comment": comment,
                    }
                )
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            return None

    async def get_mnemonic_feedback_stats(
        self,
        user_id: str,
        error_code: str,
        style: str,
    ) -> dict:
        """Get average helpfulness for a mnemonic type."""
        try:
            rows = (
                self.client.table("coach_mnemonic_feedback")
                .select("helpfulness")
                .eq("user_id", user_id)
                .eq("error_code", error_code)
                .eq("style", style)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            ).data or []
            if not rows:
                return {"average_helpfulness": None, "samples": 0}
            values = [float(r.get("helpfulness", 0)) for r in rows if r.get("helpfulness") is not None]
            if not values:
                return {"average_helpfulness": None, "samples": 0}
            return {
                "average_helpfulness": round(sum(values) / len(values), 2),
                "samples": len(values),
            }
        except Exception:
            return {"average_helpfulness": None, "samples": 0}

    async def save_behavior_event(
        self,
        user_id: str,
        event_type: str,
        payload: Optional[dict] = None,
    ) -> Optional[dict]:
        """Store coach behavior event."""
        try:
            response = (
                self.client.table("coach_behavior_events")
                .insert(
                    {
                        "user_id": user_id,
                        "event_type": event_type,
                        "payload": payload or {},
                    }
                )
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            return None

    async def list_behavior_events(self, user_id: str, limit: int = 100) -> list:
        """List recent behavior events."""
        try:
            response = (
                self.client.table("coach_behavior_events")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception:
            return []

    async def list_telegram_users(self, limit: int = 200) -> list:
        """List users connected with Telegram for notification jobs."""
        try:
            response = (
                self.client.table("users")
                .select("id,telegram_id,full_name,target_band,last_practice_at,current_streak_days,longest_streak_days,preferences")
                .not_.is_("telegram_id", "null")
                .order("updated_at", desc=False)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception:
            return []

    async def upsert_notification_event(
        self,
        user_id: str,
        telegram_id: Optional[int],
        event_type: str,
        event_date: str,
        payload: Optional[dict] = None,
    ) -> Optional[dict]:
        """Save notification event with daily dedupe."""
        try:
            response = (
                self.client.table("coach_notification_events")
                .upsert(
                    {
                        "user_id": user_id,
                        "telegram_id": telegram_id,
                        "event_type": event_type,
                        "event_date": event_date,
                        "payload": payload or {},
                    },
                    on_conflict="user_id,event_type,event_date",
                )
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception:
            return None

    async def get_notification_event(
        self,
        user_id: str,
        event_type: str,
        event_date: str,
    ) -> Optional[dict]:
        """Get a notification event by user/type/date."""
        try:
            response = (
                self.client.table("coach_notification_events")
                .select("*")
                .eq("user_id", user_id)
                .eq("event_type", event_type)
                .eq("event_date", event_date)
                .limit(1)
                .execute()
            )
            rows = response.data or []
            return rows[0] if rows else None
        except Exception:
            return None

    async def get_latest_notification_event(
        self,
        user_id: str,
        event_type: str,
    ) -> Optional[dict]:
        """Get latest notification event by type."""
        try:
            response = (
                self.client.table("coach_notification_events")
                .select("*")
                .eq("user_id", user_id)
                .eq("event_type", event_type)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = response.data or []
            return rows[0] if rows else None
        except Exception:
            return None

    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[dict]:
        """Get user profile by Telegram ID."""
        response = (
            self.client.table("users")
            .select("*")
            .eq("telegram_id", telegram_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None

    async def ensure_telegram_user(
        self,
        telegram_id: int,
        full_name: str,
        username: Optional[str] = None,
    ) -> dict:
        """
        Ensure Telegram user exists in both auth.users and public.users.

        This keeps compatibility with schemas where public.users.id references auth.users.id.
        """
        existing = await self.get_user_by_telegram_id(telegram_id)
        if existing:
            return existing

        if not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for Telegram auth user provisioning")

        email = f"telegram_{telegram_id}@telegram.speakmate.local"
        auth_user_id = self._find_auth_user_id_by_email(email)
        if not auth_user_id:
            auth_user_id = self._create_auth_user(email=email, full_name=full_name, telegram_id=telegram_id)

        upsert_payload = {
            "id": auth_user_id,
            "email": email,
            "full_name": full_name,
            "native_language": "uz",
            "target_band": 7.0,
            "telegram_id": telegram_id,
            "telegram_username": username,
            "auth_provider": "telegram",
        }
        self.client.table("users").upsert(upsert_payload, on_conflict="id").execute()

        profile = await self.get_user_profile(auth_user_id)
        if not profile:
            raise RuntimeError("Failed to provision Telegram user profile")
        return profile

    def _find_auth_user_id_by_email(self, email: str) -> Optional[str]:
        """Find auth.users user ID by email via Supabase Admin API."""
        page = 1
        per_page = 200
        while True:
            result = self.client.auth.admin.list_users(page=page, per_page=per_page)
            users = getattr(result, "users", None) or getattr(result, "data", None) or []
            if not users:
                return None

            for user in users:
                user_email = getattr(user, "email", None) or (user.get("email") if isinstance(user, dict) else None)
                if user_email and user_email.lower() == email.lower():
                    user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else None)
                    return str(user_id) if user_id else None

            if len(users) < per_page:
                return None
            page += 1

    def _create_auth_user(self, email: str, full_name: str, telegram_id: int) -> str:
        """Create a new auth user via Supabase Admin API and return its ID."""
        result = self.client.auth.admin.create_user({
            "email": email,
            "password": str(uuid4()),
            "email_confirm": True,
            "user_metadata": {
                "full_name": full_name,
                "telegram_id": telegram_id,
            },
            "app_metadata": {
                "provider": "telegram",
                "providers": ["telegram"],
            },
        })

        user = getattr(result, "user", None) or getattr(result, "data", None)
        user_id = getattr(user, "id", None) if user is not None else None
        if user_id is None and isinstance(user, dict):
            user_id = user.get("id")
        if not user_id and isinstance(result, dict):
            user_id = result.get("id")
        if not user_id:
            raise RuntimeError("Failed to create auth user for Telegram account")
        return str(user_id)
    
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
