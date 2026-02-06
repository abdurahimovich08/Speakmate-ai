"""
SpeakMate AI - Main Application Entry Point (Production)

IELTS Speaking Coach with:
- Real-time voice conversation
- Error detection and analysis
- IELTS scoring
- Training system
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import sys

from app.core.config import settings
from app.api.routes import users, sessions, feedback, auth
from app.api.routes import training, analysis
from app.api.websocket.conversation import router as ws_router
from app.telegram.webhook import router as telegram_router
from app.middleware.security import (
    RateLimitMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware
)
from app.middleware.monitoring import (
    RequestTracingMiddleware,
    configure_logging,
    metrics,
    health_checker,
    error_tracker
)

# Configure logging
configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Initialize services
    try:
        # Initialize Redis if enabled
        if settings.REDIS_ENABLED:
            from app.workers.queue_config import QueueManager
            queue = QueueManager()
            if queue.redis:
                logger.info("Redis connection established")
            else:
                logger.warning("Redis not available, using sync processing")
        
        # Initialize Telegram bot if token is set
        if settings.TELEGRAM_BOT_TOKEN:
            from app.telegram.bot import setup_webhook, get_dispatcher
            get_dispatcher()  # register handlers
            await setup_webhook()
            logger.info("Telegram bot initialized")
        
        # Initialize Sentry if configured
        if settings.SENTRY_DSN:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                integrations=[FastApiIntegration()],
                traces_sample_rate=0.1,
                environment=settings.ENVIRONMENT
            )
            logger.info("Sentry initialized")
            
    except Exception as e:
        logger.error(f"Startup error: {e}")
    
    yield
    
    # Shutdown
    if settings.TELEGRAM_BOT_TOKEN:
        from app.telegram.bot import shutdown_bot
        await shutdown_bot()
    logger.info("Shutting down application")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered IELTS Speaking Coach",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestValidationMiddleware)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Add monitoring middleware
app.add_middleware(RequestTracingMiddleware)


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    error_tracker.capture_exception(exc, {
        "path": request.url.path,
        "method": request.method
    })
    
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": str(exc),
                "type": type(exc).__name__
            }
        )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred"
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Service health check."""
    return await health_checker.run_checks()


# Readiness check endpoint  
@app.get("/ready")
async def readiness_check():
    """Readiness check for kubernetes."""
    health = await health_checker.run_checks()
    if health["status"] == "healthy":
        return {"status": "ready"}
    return JSONResponse(
        status_code=503,
        content={"status": "not_ready", "details": health}
    )


# Metrics endpoint
@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint."""
    return metrics.get_metrics()


# API info endpoint
@app.get("/")
async def root():
    """API information."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "running"
    }


# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])
app.include_router(feedback.router, prefix="/api/v1", tags=["feedback"])
app.include_router(training.router, prefix="/api/v1", tags=["training"])
app.include_router(analysis.router, prefix="/api/v1", tags=["analysis"])
app.include_router(ws_router, tags=["websocket"])
app.include_router(telegram_router, tags=["telegram"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
