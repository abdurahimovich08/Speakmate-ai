"""
SpeakMate AI - Cache Service

Provides async-friendly caching with Redis when available,
falling back to an in-memory TTL dict for single-instance deployments.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class _InMemoryTTLStore:
    """Simple dict-based TTL cache for local / no-Redis environments."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any:
        entry = self._data.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._data[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        self._data[key] = (value, time.time() + ttl)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)

    def flush_expired(self) -> int:
        now = time.time()
        expired = [k for k, (_, exp) in self._data.items() if now > exp]
        for k in expired:
            del self._data[k]
        return len(expired)


class CacheService:
    """
    Unified cache interface.

    Uses Redis when REDIS_ENABLED=True and the connection succeeds,
    otherwise silently degrades to an in-memory TTL dict.
    """

    def __init__(self) -> None:
        self._redis = None
        self._memory = _InMemoryTTLStore()
        self._use_redis = False
        self._init_attempted = False

    # ------------------------------------------------------------------ #
    # lazy init so import-time never crashes
    # ------------------------------------------------------------------ #
    def _ensure_init(self) -> None:
        if self._init_attempted:
            return
        self._init_attempted = True

        if not settings.REDIS_ENABLED:
            logger.info("Cache: Redis disabled, using in-memory TTL store")
            return

        try:
            import redis
            self._redis = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=3,
            )
            self._redis.ping()
            self._use_redis = True
            logger.info("Cache: Redis connected")
        except Exception as exc:
            logger.warning(f"Cache: Redis unavailable ({exc}), falling back to memory")
            self._redis = None

    # ------------------------------------------------------------------ #
    # public API
    # ------------------------------------------------------------------ #
    async def get(self, key: str, default: Any = None) -> Any:
        """Retrieve a cached value. Returns *default* on miss."""
        self._ensure_init()

        if self._use_redis:
            try:
                raw = self._redis.get(f"sm:{key}")
                if raw is None:
                    return default
                return json.loads(raw)
            except Exception:
                pass

        val = self._memory.get(key)
        return val if val is not None else default

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Store a value with a TTL (seconds)."""
        self._ensure_init()

        if self._use_redis:
            try:
                self._redis.setex(f"sm:{key}", ttl, json.dumps(value, default=str))
                return
            except Exception:
                pass

        self._memory.set(key, value, ttl)

    async def delete(self, key: str) -> None:
        """Invalidate a single key."""
        self._ensure_init()

        if self._use_redis:
            try:
                self._redis.delete(f"sm:{key}")
            except Exception:
                pass

        self._memory.delete(key)

    async def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern (Redis only, noop for memory)."""
        self._ensure_init()
        deleted = 0

        if self._use_redis:
            try:
                cursor = 0
                while True:
                    cursor, keys = self._redis.scan(cursor, match=f"sm:{pattern}", count=100)
                    if keys:
                        deleted += self._redis.delete(*keys)
                    if cursor == 0:
                        break
            except Exception:
                pass

        return deleted


# Global singleton
cache = CacheService()
