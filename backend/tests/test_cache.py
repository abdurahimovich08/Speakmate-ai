"""Tests for CacheService — in-memory TTL cache (Redis not required)."""

import pytest
import time
from app.core.cache import CacheService, _InMemoryTTLStore


# ------ In-memory store ------

def test_memory_store_get_set():
    store = _InMemoryTTLStore()
    store.set("key1", "value1", ttl=10)
    assert store.get("key1") == "value1"


def test_memory_store_expired():
    store = _InMemoryTTLStore()
    store.set("key1", "value1", ttl=0)
    time.sleep(0.05)
    assert store.get("key1") is None


def test_memory_store_delete():
    store = _InMemoryTTLStore()
    store.set("key1", "value1", ttl=60)
    store.delete("key1")
    assert store.get("key1") is None


def test_memory_store_flush_expired():
    store = _InMemoryTTLStore()
    store.set("a", 1, ttl=0)
    store.set("b", 2, ttl=60)
    time.sleep(0.05)
    flushed = store.flush_expired()
    assert flushed == 1
    assert store.get("b") == 2


# ------ CacheService (no Redis) ------

@pytest.mark.asyncio
async def test_cache_set_and_get():
    cache = CacheService()
    await cache.set("test_key", {"hello": "world"}, ttl=10)
    result = await cache.get("test_key")
    assert result == {"hello": "world"}


@pytest.mark.asyncio
async def test_cache_miss_returns_default():
    cache = CacheService()
    result = await cache.get("nonexistent", default="fallback")
    assert result == "fallback"


@pytest.mark.asyncio
async def test_cache_delete():
    cache = CacheService()
    await cache.set("del_key", 42, ttl=60)
    await cache.delete("del_key")
    result = await cache.get("del_key")
    assert result is None


@pytest.mark.asyncio
async def test_cache_invalidate_pattern_noop():
    cache = CacheService()
    # Without Redis, this should safely return 0
    deleted = await cache.invalidate_pattern("user:*")
    assert deleted == 0
