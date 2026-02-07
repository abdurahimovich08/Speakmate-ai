"""
SpeakMate AI - Queue Configuration (Production)

Redis-based job queue for background processing.
"""
import os
from redis import Redis
from rq import Queue
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class QueueManager:
    """
    Manages Redis queues for background job processing.
    
    Queues:
    - high: Fast summary, urgent notifications
    - default: Standard analysis, report generation
    - low: Batch processing, cleanup jobs
    """
    
    _instance: Optional['QueueManager'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._redis: Optional[Redis] = None
        self._queues: dict = {}
        
        self._connect()
    
    def _connect(self):
        """Connect to Redis."""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self._redis = Redis.from_url(redis_url)
            
            # Test connection
            self._redis.ping()
            
            # Initialize queues
            self._queues = {
                "high": Queue("high", connection=self._redis),
                "default": Queue("default", connection=self._redis),
                "low": Queue("low", connection=self._redis),
            }
            
            logger.info("Connected to Redis successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._redis = None
            self._queues = {}
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if not self._redis:
            return False
        try:
            self._redis.ping()
            return True
        except:
            return False
    
    def get_queue(self, name: str = "default") -> Optional[Queue]:
        """Get a queue by name."""
        return self._queues.get(name)
    
    def enqueue(
        self,
        func,
        *args,
        queue_name: str = "default",
        job_timeout: int = 600,
        result_ttl: int = 86400,
        retry: int = 3,
        **kwargs
    ):
        """
        Enqueue a job.
        
        Args:
            func: Function to execute
            queue_name: Queue to use (high, default, low)
            job_timeout: Max execution time in seconds
            result_ttl: How long to keep result
            retry: Number of retries on failure
        """
        queue = self.get_queue(queue_name)
        
        if not queue:
            logger.warning(f"Queue '{queue_name}' not available, executing synchronously")
            # Fallback to synchronous execution
            return func(*args, **kwargs)
        
        try:
            job = queue.enqueue(
                func,
                *args,
                job_timeout=job_timeout,
                result_ttl=result_ttl,
                retry=retry,
                **kwargs
            )
            logger.info(f"Job {job.id} enqueued to {queue_name}")
            return job
        except Exception as e:
            logger.error(f"Failed to enqueue job: {e}")
            # Fallback to synchronous execution
            return func(*args, **kwargs)
    
    def enqueue_analysis(self, session_id: str, analysis_type: str = "deep"):
        """Enqueue session analysis job."""
        from app.workers.analysis_worker import analyze_session
        
        queue_name = "high" if analysis_type == "fast" else "default"
        timeout = 120 if analysis_type == "fast" else 600
        
        return self.enqueue(
            analyze_session,
            session_id,
            analysis_type,
            queue_name=queue_name,
            job_timeout=timeout
        )
    
    def enqueue_pdf_generation(self, session_id: str, user_id: str):
        """Enqueue PDF report generation job."""
        from app.workers.pdf_worker import generate_pdf_report
        
        return self.enqueue(
            generate_pdf_report,
            session_id,
            user_id,
            queue_name="default",
            job_timeout=300
        )
    
    def enqueue_training_generation(self, user_id: str, error_codes: list):
        """Enqueue training task generation."""
        from app.workers.training_worker import generate_training_tasks
        
        return self.enqueue(
            generate_training_tasks,
            user_id,
            error_codes,
            queue_name="low",
            job_timeout=300
        )

    def enqueue_daily_reminders(self, limit: int = 200, force: bool = False):
        """Enqueue daily mission reminder notifications."""
        from app.workers.notification_worker import run_daily_reminders

        return self.enqueue(
            run_daily_reminders,
            limit,
            force,
            queue_name="high",
            job_timeout=300,
        )

    def enqueue_streak_notifications(self, limit: int = 200, force: bool = False):
        """Enqueue streak milestone notifications."""
        from app.workers.notification_worker import run_streak_notifications

        return self.enqueue(
            run_streak_notifications,
            limit,
            force,
            queue_name="high",
            job_timeout=300,
        )
    
    def get_job_status(self, job_id: str) -> dict:
        """Get status of a job."""
        if not self._redis:
            return {"status": "unknown"}
        
        from rq.job import Job
        try:
            job = Job.fetch(job_id, connection=self._redis)
            return {
                "id": job.id,
                "status": job.get_status(),
                "result": job.result if job.is_finished else None,
                "error": str(job.exc_info) if job.is_failed else None,
                "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "ended_at": job.ended_at.isoformat() if job.ended_at else None,
            }
        except Exception as e:
            return {"status": "not_found", "error": str(e)}
    
    def get_queue_stats(self) -> dict:
        """Get statistics for all queues."""
        stats = {}
        for name, queue in self._queues.items():
            try:
                stats[name] = {
                    "count": queue.count,
                    "failed": queue.failed_job_registry.count,
                    "scheduled": queue.scheduled_job_registry.count,
                }
            except:
                stats[name] = {"error": "unavailable"}
        return stats


# Global queue manager
queue_manager = QueueManager()
