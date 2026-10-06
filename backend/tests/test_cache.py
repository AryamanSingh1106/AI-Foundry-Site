"""Run with:  python -m unittest discover tests   (no extra packages needed)"""
import threading
import time
import unittest

from app.cache import RETRY_AFTER, SWRCache


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def wait_until(cond, timeout=2.0):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.01)
    return False


class SWRCacheTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.cache = SWRCache(ttl=30, clock=self.clock)
        self.calls = 0

    def build(self):
        self.calls += 1
        return {"v": self.calls}

    def test_builds_once_while_fresh(self):
        for _ in range(5):
            self.assertEqual(self.cache.get(self.build), {"v": 1})
        self.assertEqual(self.calls, 1)

    def test_stale_is_served_instantly_then_refreshed_in_background(self):
        self.cache.get(self.build)
        self.clock.t += 31
        self.assertEqual(self.cache.get(self.build), {"v": 1})        # old answer, no waiting
        self.assertTrue(wait_until(lambda: self.cache.get(self.build) == {"v": 2}))  # new one arrives
        self.assertEqual(self.calls, 2)

    def test_stale_refresh_does_not_block_the_visitor(self):
        self.cache.get(self.build)
        self.clock.t += 31
        release = threading.Event()

        def slow():
            release.wait(2)
            return {"v": "slow"}

        t0 = time.time()
        self.assertEqual(self.cache.get(slow), {"v": 1})
        self.assertLess(time.time() - t0, 0.5)
        release.set()

    def test_failed_refresh_keeps_last_good_value_and_retries_later(self):
        self.cache.get(self.build)
        self.clock.t += 31

        def boom():
            raise RuntimeError("supabase down")

        self.assertEqual(self.cache.get(boom), {"v": 1})
        time.sleep(0.1)
        self.assertEqual(self.cache.get(boom), {"v": 1})              # still serving the old value
        self.clock.t += RETRY_AFTER + 1
        self.assertTrue(wait_until(lambda: self.cache.get(self.build) == {"v": 2}))  # recovers

    def test_first_build_failure_is_raised(self):
        def boom():
            raise RuntimeError("nothing cached yet")

        with self.assertRaises(RuntimeError):
            self.cache.get(boom)

    def test_simultaneous_first_visitors_trigger_a_single_build(self):
        results = []

        def slow_build():
            self.calls += 1
            time.sleep(0.2)
            return {"v": self.calls}

        threads = [threading.Thread(target=lambda: results.append(self.cache.get(slow_build))) for _ in range(8)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.assertEqual(self.calls, 1)
        self.assertEqual(results, [{"v": 1}] * 8)


if __name__ == "__main__":
    unittest.main()
