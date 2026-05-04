"""
ingestion/utils/token_pool.py
GitHub API token rotation pool.

MVP contract: get() always returns token at index 0.
rotate() is implemented as a skeleton for post-MVP multi-token support.
GitHub ingest calls get() only — never rotate() in MVP.
"""
import json
import logging
import os

logger = logging.getLogger(__name__)


class TokenPool:
    def __init__(self, tokens: list[str]) -> None:
        if not tokens:
            raise ValueError("token pool cannot be empty")
        self._tokens = tokens
        self._current = 0
        logger.info("token pool loaded: %d token(s)", len(tokens))

    def get(self) -> str:
        return self._tokens[self._current]

    def rotate(self) -> str:
        # skeleton — MVP never calls this
        self._current = (self._current + 1) % len(self._tokens)
        logger.info("token rotated to index %d", self._current)
        return self._tokens[self._current]

    def __len__(self) -> int:
        return len(self._tokens)


def load_from_env() -> TokenPool:
    raw = os.environ["GITHUB_TOKENS"]
    tokens: list[str] = json.loads(raw)
    return TokenPool(tokens)
