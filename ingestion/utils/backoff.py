"""
ingestion/utils/backoff.py
Exponential backoff with jitter for all DESK ingestion API calls.

Retry policy (D014):
  - Retries: 429 and 5xx HTTP errors, connection errors, timeouts
  - Non-retryable: all other 4xx (client errors — fix the caller)
  - Delay: exponential backoff with jitter — min(base * 2^n + rand(0,1), max)
  - Max retries: 5. On exhaustion, original exception is re-raised.

CircuitBreaker (D068) bounds cost across an entire run rather than per call —
see the 6 July 2026 pypistats.org incident, where every one of ~1,000
packages paid the full retry_with_backoff ladder because the whole host was
down, blowing well past the job's timeout with nothing salvaged.
"""
import logging
import random
import time
from collections.abc import Callable
from typing import Any

import requests

logger = logging.getLogger(__name__)


def retry_with_backoff(
    func: Callable,
    *args: Any,
    max_retries: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    **kwargs: Any,
) -> Any:
    last_exc: Exception = RuntimeError("no attempts made")

    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status is not None and status < 500 and status != 429:
                raise  # 4xx except 429 — do not retry
            last_exc = exc
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            last_exc = exc

        delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
        logger.warning(
            "retry %d/%d in %.1fs — %s", attempt + 1, max_retries, delay, last_exc
        )
        time.sleep(delay)

    raise last_exc


class CircuitBreaker:
    """
    Trips after `threshold` consecutive record_failure() calls; any
    record_success() resets the counter to zero. For a loop hammering one
    flaky host across many items, this detects "the whole host is down"
    early instead of paying retry_with_backoff's full ladder item-by-item
    until an external timeout kills the job with nothing salvaged.
    """

    def __init__(self, threshold: int) -> None:
        self.threshold = threshold
        self._consecutive_failures = 0
        self.tripped = False

    def record_success(self) -> None:
        self._consecutive_failures = 0

    def record_failure(self) -> None:
        self._consecutive_failures += 1
        self.tripped = self._consecutive_failures >= self.threshold
