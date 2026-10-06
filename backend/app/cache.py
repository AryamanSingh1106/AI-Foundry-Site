"""
Tiny in-memory "stale-while-revalidate" cache (no extra packages).

Why: GET /api/site used to run 6 database queries for EVERY visitor.
Now:
  - fresh (younger than ttl)  -> answer instantly from memory
  - stale (older than ttl)    -> STILL answer instantly from memory, and refresh in the background
  - empty (first ever request after the server boots) -> build once; simultaneous visitors wait for that one build
So after the first request, visitors never wait for the database.
If a background refresh fails (Supabase hiccup), the last good answer keeps being served and it retries shortly.
"""
import threading
import time

RETRY_AFTER = 10.0  # seconds to wait before retrying a failed background refresh


class SWRCache:
    def __init__(self, ttl: float = 30.0, clock=time.time):
        self.ttl = ttl
        self._clock = clock
        self._value = None
        self._at = 0.0
        self._has = False
        self._refreshing = False
        self._lock = threading.Lock()        # protects the fields above
        self._build_lock = threading.Lock()  # only one first-time build at a time

    def get(self, build):
        with self._lock:
            if self._has:
                if self._clock() - self._at < self.ttl:
                    return self._value
                if not self._refreshing:  # stale: serve it now, rebuild in the background
                    self._refreshing = True
                    threading.Thread(target=self._refresh, args=(build,), daemon=True).start()
                return self._value

        with self._build_lock:  # cold start: build once, others wait for it
            with self._lock:
                if self._has:
                    return self._value
            value = build()  # if this raises, the caller sees the error (nothing to fall back on yet)
            self._store(value)
            return value

    def _store(self, value):
        with self._lock:
            self._value, self._at, self._has = value, self._clock(), True

    def _refresh(self, build):
        try:
            self._store(build())
        except Exception:
            with self._lock:  # keep the old value; try again in RETRY_AFTER seconds
                self._at = self._clock() - self.ttl + RETRY_AFTER
        finally:
            with self._lock:
                self._refreshing = False
