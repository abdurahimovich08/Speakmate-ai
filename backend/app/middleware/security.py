"""
SpeakMate AI - Security Middleware (Production)

Security features:
- Rate limiting (IP + user)
- Request validation
- PII detection and masking
- Audit logging
"""
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import re
import hashlib
import time

from app.db.supabase import db_service

logger = logging.getLogger(__name__)


# Rate limit configurations
RATE_LIMITS = {
    "default": {"requests": 100, "window_seconds": 60},
    "auth": {"requests": 5, "window_seconds": 60},
    "api": {"requests": 60, "window_seconds": 60},
    "websocket": {"requests": 10, "window_seconds": 60},
    "analysis": {"requests": 10, "window_seconds": 300},
}

# PII patterns
PII_PATTERNS = {
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "phone": r'\b(?:\+?[0-9]{1,3}[-.]?)?\(?[0-9]{2,4}\)?[-.]?[0-9]{2,4}[-.]?[0-9]{2,4}\b',
    "credit_card": r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
    "ssn": r'\b\d{3}[-]?\d{2}[-]?\d{4}\b',
    "passport": r'\b[A-Z]{1,2}[0-9]{6,9}\b',
}


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter.
    
    Production: Replace with Redis-based limiter.
    """
    
    def __init__(self):
        self._store: Dict[str, Dict] = {}
        self._cleanup_interval = 300  # 5 minutes
        self._last_cleanup = time.time()
    
    def _cleanup(self):
        """Remove expired entries."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        
        expired_keys = []
        for key, data in self._store.items():
            if data["window_end"] < now:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._store[key]
        
        self._last_cleanup = now
    
    def is_rate_limited(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> tuple[bool, Dict]:
        """
        Check if request should be rate limited.
        
        Returns:
            (is_limited, info_dict)
        """
        self._cleanup()
        
        now = time.time()
        
        if key not in self._store:
            self._store[key] = {
                "count": 1,
                "window_start": now,
                "window_end": now + window_seconds
            }
            return False, {
                "remaining": limit - 1,
                "reset": window_seconds
            }
        
        data = self._store[key]
        
        # Check if window expired
        if data["window_end"] < now:
            self._store[key] = {
                "count": 1,
                "window_start": now,
                "window_end": now + window_seconds
            }
            return False, {
                "remaining": limit - 1,
                "reset": window_seconds
            }
        
        # Increment counter
        data["count"] += 1
        
        if data["count"] > limit:
            return True, {
                "remaining": 0,
                "reset": int(data["window_end"] - now)
            }
        
        return False, {
            "remaining": limit - data["count"],
            "reset": int(data["window_end"] - now)
        }


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    async def dispatch(self, request: Request, call_next):
        # Always allow CORS preflight requests.
        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        # Get client identifier
        client_ip = self._get_client_ip(request)
        user_id = self._get_user_id(request)
        
        # Determine limit type
        path = request.url.path
        limit_type = self._get_limit_type(path)
        
        # Create rate limit key
        key = f"{limit_type}:{client_ip}"
        if user_id:
            key = f"{limit_type}:{user_id}"
        
        # Check rate limit
        config = RATE_LIMITS.get(limit_type, RATE_LIMITS["default"])
        is_limited, info = rate_limiter.is_rate_limited(
            key=key,
            limit=config["requests"],
            window_seconds=config["window_seconds"]
        )
        
        if is_limited:
            logger.warning(f"Rate limit exceeded: {key}")
            
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Too many requests. Please try again later.",
                    "retry_after": info["reset"]
                },
                headers={
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(info["reset"]),
                    "Retry-After": str(info["reset"])
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset"])
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _get_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from auth header."""
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        
        # Simplified - in production, decode JWT
        # Hash the token as user identifier
        return hashlib.md5(auth_header.encode()).hexdigest()[:16]
    
    def _get_limit_type(self, path: str) -> str:
        """Determine rate limit type from path."""
        if "/auth" in path:
            return "auth"
        if "/ws" in path:
            return "websocket"
        if "/analysis" in path:
            return "analysis"
        if "/api" in path:
            return "api"
        return "default"


class PIIProtectionMiddleware(BaseHTTPMiddleware):
    """PII detection and protection middleware."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        return response


def mask_pii(text: str) -> str:
    """
    Mask PII in text.
    
    Args:
        text: Input text
    
    Returns:
        Text with PII masked
    """
    masked = text
    
    for pii_type, pattern in PII_PATTERNS.items():
        def replacer(match):
            value = match.group()
            if pii_type == "email":
                parts = value.split("@")
                return f"{parts[0][:2]}***@{parts[1]}"
            elif pii_type == "phone":
                return "***-***-" + value[-4:]
            elif pii_type == "credit_card":
                return "****-****-****-" + value[-4:]
            else:
                return "[REDACTED]"
        
        masked = re.sub(pattern, replacer, masked, flags=re.IGNORECASE)
    
    return masked


def detect_pii(text: str) -> Dict[str, list]:
    """
    Detect PII in text.
    
    Returns:
        Dict of PII type -> list of matches
    """
    found = {}
    
    for pii_type, pattern in PII_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            found[pii_type] = matches
    
    return found


class AuditLogger:
    """
    Audit logging for compliance.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("audit")
    
    async def log_action(
        self,
        action: str,
        user_id: Optional[str],
        resource_type: str,
        resource_id: Optional[str],
        details: Dict = None,
        ip_address: Optional[str] = None
    ):
        """
        Log an auditable action.
        
        Args:
            action: Action type (e.g., "session.start", "data.delete")
            user_id: User performing action
            resource_type: Type of resource affected
            resource_id: ID of resource
            details: Additional details
            ip_address: Client IP
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "user_id": user_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address
        }
        
        self.logger.info(f"AUDIT: {log_entry}")
        
        # Save to database
        await self._save_to_db(log_entry)
    
    async def _save_to_db(self, entry: Dict):
        """Save audit log to database."""
        try:
            client = db_service.client
            
            client.table("audit_log").insert({
                "action": entry["action"],
                "user_id": entry["user_id"],
                "resource_type": entry["resource_type"],
                "resource_id": entry["resource_id"],
                "details": entry["details"],
                "ip_address": entry["ip_address"]
            }).execute()
            
        except Exception as e:
            logger.error(f"Failed to save audit log: {e}")


# Global audit logger
audit_logger = AuditLogger()


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Request validation and sanitization."""
    
    # Blocked patterns (SQL injection, XSS, etc.)
    BLOCKED_PATTERNS = [
        r"<script[\s\S]*?>[\s\S]*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"UNION\s+SELECT",
        r"INSERT\s+INTO",
        r"DROP\s+TABLE",
        r"--",
        r";.*?SELECT",
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Check query parameters
        query_string = str(request.url.query)
        if self._contains_blocked_pattern(query_string):
            logger.warning(f"Blocked suspicious query: {query_string}")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "invalid_request", "message": "Invalid request parameters"}
            )
        
        response = await call_next(request)
        return response
    
    def _contains_blocked_pattern(self, text: str) -> bool:
        """Check if text contains blocked patterns."""
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response
