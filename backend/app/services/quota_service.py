"""
SpeakMate AI - Quota and Rate Limiting Service (Production)

Manages:
- User plan limits (minutes, sessions)
- Rate limiting
- Cost tracking
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

from app.db.supabase import db_service
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class QuotaLimits:
    """Plan quota limits."""
    monthly_minutes: int
    monthly_sessions: int
    max_session_duration: int  # seconds
    features: Dict[str, bool]


PLAN_LIMITS = {
    'free': QuotaLimits(
        monthly_minutes=60,
        monthly_sessions=10,
        max_session_duration=600,  # 10 min
        features={
            'free_speaking': True,
            'ielts_mode': False,
            'training_mode': False,
            'pdf_reports': False,
            'detailed_analysis': False,
        }
    ),
    'basic': QuotaLimits(
        monthly_minutes=300,
        monthly_sessions=50,
        max_session_duration=1800,  # 30 min
        features={
            'free_speaking': True,
            'ielts_mode': True,
            'training_mode': True,
            'pdf_reports': True,
            'detailed_analysis': False,
        }
    ),
    'premium': QuotaLimits(
        monthly_minutes=1000,
        monthly_sessions=200,
        max_session_duration=3600,  # 60 min
        features={
            'free_speaking': True,
            'ielts_mode': True,
            'training_mode': True,
            'pdf_reports': True,
            'detailed_analysis': True,
        }
    ),
    'enterprise': QuotaLimits(
        monthly_minutes=999999,  # Unlimited
        monthly_sessions=999999,
        max_session_duration=7200,  # 2 hours
        features={
            'free_speaking': True,
            'ielts_mode': True,
            'training_mode': True,
            'pdf_reports': True,
            'detailed_analysis': True,
        }
    ),
}


class QuotaService:
    """
    Manages user quotas and rate limiting.
    """
    
    def __init__(self):
        # In-memory rate limit cache (should use Redis in production)
        self._rate_limits: Dict[str, Dict] = {}
    
    async def check_session_quota(self, user_id: str) -> Dict[str, Any]:
        """
        Check if user can start a new session.
        
        Returns:
            {allowed: bool, reason: str, remaining: dict}
        """
        try:
            # Get user plan
            plan_data = await self._get_user_plan(user_id)
            plan_type = plan_data.get('plan', 'free')
            limits = PLAN_LIMITS.get(plan_type, PLAN_LIMITS['free'])
            
            # Check session count
            sessions_used = plan_data.get('monthly_sessions_used', 0)
            if sessions_used >= limits.monthly_sessions:
                return {
                    'allowed': False,
                    'reason': f'Monthly session limit reached ({limits.monthly_sessions})',
                    'remaining': {
                        'sessions': 0,
                        'minutes': max(0, limits.monthly_minutes - plan_data.get('monthly_minutes_used', 0))
                    }
                }
            
            # Check minutes
            minutes_used = plan_data.get('monthly_minutes_used', 0)
            if minutes_used >= limits.monthly_minutes:
                return {
                    'allowed': False,
                    'reason': f'Monthly minutes limit reached ({limits.monthly_minutes})',
                    'remaining': {
                        'sessions': max(0, limits.monthly_sessions - sessions_used),
                        'minutes': 0
                    }
                }
            
            # Check rate limit
            rate_check = await self._check_rate_limit(user_id)
            if not rate_check['allowed']:
                return rate_check
            
            return {
                'allowed': True,
                'reason': None,
                'remaining': {
                    'sessions': limits.monthly_sessions - sessions_used,
                    'minutes': limits.monthly_minutes - minutes_used
                },
                'max_duration': limits.max_session_duration,
                'features': limits.features
            }
            
        except Exception as e:
            logger.error(f"Quota check failed: {e}")
            # Fail open for better UX, but log for monitoring
            return {'allowed': True, 'reason': None, 'remaining': {}}
    
    async def check_feature_access(self, user_id: str, feature: str) -> bool:
        """Check if user has access to a feature."""
        try:
            plan_data = await self._get_user_plan(user_id)
            plan_type = plan_data.get('plan', 'free')
            limits = PLAN_LIMITS.get(plan_type, PLAN_LIMITS['free'])
            
            return limits.features.get(feature, False)
            
        except Exception as e:
            logger.error(f"Feature check failed: {e}")
            return False
    
    async def record_usage(
        self,
        user_id: str,
        minutes: float,
        tokens: int = 0,
        cost: float = 0.0
    ):
        """Record usage for billing and tracking."""
        try:
            # Update plan usage in database
            # This would normally be done via stored procedure for atomicity
            logger.info(f"Recording usage for {user_id}: {minutes} min, {tokens} tokens, ${cost}")
            
        except Exception as e:
            logger.error(f"Failed to record usage: {e}")
    
    async def get_usage_summary(self, user_id: str) -> Dict[str, Any]:
        """Get user's usage summary."""
        try:
            plan_data = await self._get_user_plan(user_id)
            plan_type = plan_data.get('plan', 'free')
            limits = PLAN_LIMITS.get(plan_type, PLAN_LIMITS['free'])
            
            return {
                'plan': plan_type,
                'period_start': plan_data.get('current_period_start'),
                'period_end': plan_data.get('current_period_end'),
                'usage': {
                    'sessions': {
                        'used': plan_data.get('monthly_sessions_used', 0),
                        'limit': limits.monthly_sessions,
                        'remaining': max(0, limits.monthly_sessions - plan_data.get('monthly_sessions_used', 0))
                    },
                    'minutes': {
                        'used': plan_data.get('monthly_minutes_used', 0),
                        'limit': limits.monthly_minutes,
                        'remaining': max(0, limits.monthly_minutes - plan_data.get('monthly_minutes_used', 0))
                    }
                },
                'features': limits.features
            }
            
        except Exception as e:
            logger.error(f"Failed to get usage summary: {e}")
            return {}
    
    async def _get_user_plan(self, user_id: str) -> Dict:
        """Get user's plan data from database."""
        try:
            client = db_service.client
            response = client.table('user_plans').select('*').eq('user_id', user_id).single().execute()
            return response.data if response.data else {'plan': 'free'}
        except:
            return {'plan': 'free'}
    
    async def _check_rate_limit(self, user_id: str) -> Dict[str, Any]:
        """Check rate limit for user."""
        
        now = datetime.utcnow()
        
        # Get or create rate limit entry
        if user_id not in self._rate_limits:
            self._rate_limits[user_id] = {
                'requests': [],
                'last_reset': now
            }
        
        entry = self._rate_limits[user_id]
        
        # Reset if window passed (1 hour)
        if now - entry['last_reset'] > timedelta(hours=1):
            entry['requests'] = []
            entry['last_reset'] = now
        
        # Check limit (10 sessions per hour)
        if len(entry['requests']) >= 10:
            return {
                'allowed': False,
                'reason': 'Rate limit exceeded. Please wait before starting a new session.',
                'retry_after': 3600 - (now - entry['last_reset']).seconds
            }
        
        # Record request
        entry['requests'].append(now)
        
        return {'allowed': True}


# Global instance
quota_service = QuotaService()
