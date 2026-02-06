"""
SpeakMate AI - Training Task Worker

Background worker for generating training tasks.
"""
import asyncio
from datetime import datetime
from typing import List, Dict
import logging

from app.services.training_engine import training_engine
from app.db.supabase import db_service

logger = logging.getLogger(__name__)


def generate_training_tasks(user_id: str, error_codes: List[str]) -> Dict:
    """
    Generate training tasks for user based on errors.
    
    Args:
        user_id: User to create tasks for
        error_codes: List of error codes to address
    
    Returns:
        Summary of generated tasks
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_generate_tasks(user_id, error_codes))
        return result
    finally:
        loop.close()


async def _generate_tasks(user_id: str, error_codes: List[str]) -> Dict:
    """Async task generation."""
    logger.info(f"Generating training tasks for user {user_id}: {error_codes}")
    
    # Get recent errors from database
    # For now, simulate with error code list
    errors = [{"error_code": code, "category": "grammar", "original_text": "", "corrected_text": ""} 
              for code in error_codes]
    
    # Generate tasks
    tasks = await training_engine.generate_tasks_for_errors(user_id, errors)
    
    # Save to database
    saved_count = 0
    for task in tasks:
        try:
            await _save_training_task(task)
            saved_count += 1
        except Exception as e:
            logger.error(f"Failed to save task: {e}")
    
    logger.info(f"Generated {saved_count} training tasks for user {user_id}")
    
    return {
        "user_id": user_id,
        "tasks_generated": saved_count,
        "error_codes_addressed": error_codes
    }


async def _save_training_task(task: Dict):
    """Save training task to database."""
    from supabase import create_client
    from app.core.config import settings
    
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    client.table("training_tasks").insert({
        "user_id": task["user_id"],
        "task_type": task["task_type"],
        "error_code": task["error_code"],
        "content": task["content"],
        "difficulty": task["difficulty"],
        "interval_days": task["interval_days"],
        "ease_factor": task["ease_factor"],
        "next_due_at": task["next_due_at"],
        "status": task["status"]
    }).execute()
