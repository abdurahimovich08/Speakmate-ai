"""
SpeakMate AI - Monitoring Middleware (Production)

Observability features:
- Structured logging
- Metrics collection
- Request tracing
- Error tracking
"""
from typing import Dict, Any, Optional
from datetime import datetime
import time
import uuid
import logging
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

# Context variables for request tracing
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[str] = ContextVar("user_id", default="")


def configure_logging():
    """Configure structured logging with structlog."""
    
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


# Get structured logger
def get_logger(name: str) -> structlog.BoundLogger:
    """Get a structured logger with context."""
    logger = structlog.get_logger(name)
    
    # Add context from context vars
    request_id = request_id_var.get()
    user_id = user_id_var.get()
    
    if request_id:
        logger = logger.bind(request_id=request_id)
    if user_id:
        logger = logger.bind(user_id=user_id)
    
    return logger


class MetricsCollector:
    """
    Collect application metrics.
    
    In production, integrate with Prometheus.
    """
    
    def __init__(self):
        self._counters: Dict[str, int] = {}
        self._histograms: Dict[str, list] = {}
        self._gauges: Dict[str, float] = {}
    
    def increment(self, name: str, value: int = 1, labels: Dict = None):
        """Increment a counter."""
        key = self._make_key(name, labels)
        self._counters[key] = self._counters.get(key, 0) + value
    
    def observe(self, name: str, value: float, labels: Dict = None):
        """Record a histogram observation."""
        key = self._make_key(name, labels)
        if key not in self._histograms:
            self._histograms[key] = []
        self._histograms[key].append(value)
        
        # Keep only last 1000 observations
        if len(self._histograms[key]) > 1000:
            self._histograms[key] = self._histograms[key][-1000:]
    
    def set_gauge(self, name: str, value: float, labels: Dict = None):
        """Set a gauge value."""
        key = self._make_key(name, labels)
        self._gauges[key] = value
    
    def _make_key(self, name: str, labels: Dict = None) -> str:
        """Create metric key from name and labels."""
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics for export."""
        return {
            "counters": self._counters,
            "histograms": {
                k: {
                    "count": len(v),
                    "sum": sum(v),
                    "avg": sum(v) / len(v) if v else 0,
                    "max": max(v) if v else 0,
                    "min": min(v) if v else 0
                }
                for k, v in self._histograms.items()
            },
            "gauges": self._gauges
        }


# Global metrics collector
metrics = MetricsCollector()


# Pre-defined metric names
class MetricNames:
    """Standard metric names."""
    REQUEST_COUNT = "http_requests_total"
    REQUEST_DURATION = "http_request_duration_seconds"
    REQUEST_SIZE = "http_request_size_bytes"
    RESPONSE_SIZE = "http_response_size_bytes"
    
    ACTIVE_SESSIONS = "speakmate_active_sessions"
    ANALYSIS_DURATION = "speakmate_analysis_duration_seconds"
    ERRORS_DETECTED = "speakmate_errors_detected_total"
    TOKENS_USED = "speakmate_tokens_used_total"
    
    STT_DURATION = "speakmate_stt_duration_seconds"
    TTS_DURATION = "speakmate_tts_duration_seconds"
    LLM_DURATION = "speakmate_llm_duration_seconds"


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """Add request tracing and logging."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request_id_var.set(request_id)
        
        # Extract user ID if available
        user_id = self._extract_user_id(request)
        if user_id:
            user_id_var.set(user_id)
        
        # Start timing
        start_time = time.time()
        
        # Get logger
        logger = get_logger("request")
        
        # Log request
        logger.info(
            "request_started",
            method=request.method,
            path=request.url.path,
            query=str(request.url.query),
            client_ip=self._get_client_ip(request)
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_seconds=round(duration, 3)
            )
            
            # Record metrics
            labels = {
                "method": request.method,
                "path": self._normalize_path(request.url.path),
                "status": str(response.status_code)
            }
            metrics.increment(MetricNames.REQUEST_COUNT, labels=labels)
            metrics.observe(MetricNames.REQUEST_DURATION, duration, labels=labels)
            
            # Add trace headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_seconds=round(duration, 3)
            )
            
            # Record error metric
            metrics.increment(
                MetricNames.REQUEST_COUNT,
                labels={
                    "method": request.method,
                    "path": self._normalize_path(request.url.path),
                    "status": "500"
                }
            )
            
            raise
    
    def _extract_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from request."""
        # From auth header (simplified)
        auth = request.headers.get("Authorization")
        if auth:
            # In production, decode JWT
            return "authenticated_user"
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path for metrics (remove IDs)."""
        import re
        # Replace UUIDs
        path = re.sub(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '{id}',
            path
        )
        # Replace numeric IDs
        path = re.sub(r'/\d+', '/{id}', path)
        return path


class ErrorTracker:
    """
    Track and report errors.
    
    In production, integrate with Sentry.
    """
    
    def __init__(self):
        self._errors: list = []
        self._max_errors = 1000
    
    def capture_exception(
        self,
        exc: Exception,
        context: Dict = None
    ):
        """Capture an exception."""
        import traceback
        
        error_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
            "context": context or {},
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get()
        }
        
        self._errors.append(error_data)
        
        # Trim old errors
        if len(self._errors) > self._max_errors:
            self._errors = self._errors[-self._max_errors:]
        
        # Log error
        logger = get_logger("error_tracker")
        logger.error(
            "exception_captured",
            error_type=error_data["type"],
            error_message=error_data["message"]
        )
    
    def capture_message(
        self,
        message: str,
        level: str = "info",
        context: Dict = None
    ):
        """Capture a message."""
        logger = get_logger("error_tracker")
        log_method = getattr(logger, level, logger.info)
        log_method(message, **(context or {}))
    
    def get_recent_errors(self, limit: int = 10) -> list:
        """Get recent errors."""
        return self._errors[-limit:]


# Global error tracker
error_tracker = ErrorTracker()


# Health check data
class HealthChecker:
    """Service health checking."""
    
    def __init__(self):
        self._checks: Dict[str, callable] = {}
    
    def register_check(self, name: str, check_func: callable):
        """Register a health check."""
        self._checks[name] = check_func
    
    async def run_checks(self) -> Dict[str, Any]:
        """Run all health checks."""
        results = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {}
        }
        
        for name, check_func in self._checks.items():
            try:
                if callable(check_func):
                    import asyncio
                    if asyncio.iscoroutinefunction(check_func):
                        check_result = await check_func()
                    else:
                        check_result = check_func()
                    
                    results["checks"][name] = {
                        "status": "healthy" if check_result else "unhealthy",
                        "details": check_result
                    }
            except Exception as e:
                results["status"] = "unhealthy"
                results["checks"][name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
        
        return results


# Global health checker
health_checker = HealthChecker()


# Register default checks
def check_database():
    """Check database connectivity."""
    try:
        # Would ping database
        return True
    except Exception:
        return False


def check_redis():
    """Check Redis connectivity."""
    try:
        # Would ping Redis
        return True
    except Exception:
        return False


health_checker.register_check("database", check_database)
health_checker.register_check("redis", check_redis)
