"""
TTL cache with single-flight and serve-stale-on-error.

Why all three matter here: every phone polls the same few keys every 10-15 s, so
without this the backend would multiply traffic to TDX by the number of users.
Single-flight collapses a burst of concurrent misses into one upstream call, and
serving stale data when TDX blips keeps a live demo talking instead of erroring.
"""
import asyncio
import time
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


class TtlCache:
    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, object]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get(self, key: str, ttl: float, loader: Callable[[], Awaitable[T]]) -> T:
        fresh = self._fresh(key, ttl)
        if fresh is not None:
            return fresh  # type: ignore[return-value]

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # Another waiter may have filled it while we queued on the lock.
            fresh = self._fresh(key, ttl)
            if fresh is not None:
                return fresh  # type: ignore[return-value]
            try:
                value = await loader()
            except Exception:
                stale = self._entries.get(key)
                if stale is not None:
                    return stale[1]  # type: ignore[return-value]
                raise
            self._entries[key] = (time.monotonic(), value)
            return value

    def _fresh(self, key: str, ttl: float) -> object | None:
        hit = self._entries.get(key)
        if hit is None:
            return None
        stored_at, value = hit
        return value if (time.monotonic() - stored_at) < ttl else None

    def clear(self) -> None:
        self._entries.clear()


cache = TtlCache()
