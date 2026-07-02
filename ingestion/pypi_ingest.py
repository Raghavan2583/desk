"""
ingestion/pypi_ingest.py
Fetches package metadata from PyPI JSON API and pypistats.org.
Seeds the scheduler_queue from hugovk top-1000 list on every run (DuckDB is
ephemeral — queue must be seeded fresh each pipeline execution).
Writes new or changed packages to raw_pypi_packages.

Skips packages whose version matches the current record in dim_packages.
On first run (dim_packages empty), all packages are written.

Download counts (pypistats.org) are rotated, not checked for all 1,000
packages every run: pypistats.org's real limit is 30 requests/minute
site-wide (see D058), which can't cover 1,000 packages daily. Each run
checks whichever DOWNLOADS_BATCH_SIZE packages have gone longest without a
successful check (from the committed download_history.parquet), so every
package is refreshed roughly every ~3-4 weeks. scoring/risk_score.py carries
forward the last known real count (with its real date) for packages not
checked this run — see D058.

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/pypi_ingest.py
"""
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import requests

from ingestion.db import get_connection, insert_rows
from ingestion.utils.backoff import retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running
from ingestion.utils.validation import validate_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_PACKAGES_URL = "https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json"
TOP_N = int(os.environ.get("PYPI_TOP_N", "1000"))

# pypistats.org allows 30 req/min site-wide — 40 requests spaced 2.5s apart
# is ~24/min, safely under that with margin for jitter/retries.
DOWNLOADS_BATCH_SIZE  = 40
DOWNLOADS_REQ_DELAY   = 2.5
DOWNLOAD_HISTORY_PARQUET = Path(os.environ.get("DESK_HISTORY_DIR", "data/history")) / "download_history.parquet"

# ── GitHub Search fallback ────────────────────────────────────────────────── #

_GH_SEARCH_URL   = "https://api.github.com/search/repositories"
_GH_SEARCH_DELAY = 2.1
_GH_SEARCH_TOKEN: str | None = None
_gh_search_rate_limited = False

try:
    from ingestion.utils.token_pool import load_from_env as _load_gh_pool
    _GH_SEARCH_TOKEN = _load_gh_pool().get()
    logger.info("GitHub Search fallback enabled (token loaded)")
except Exception:
    logger.info("GitHub Search fallback disabled (GITHUB_TOKENS not set)")

PYPI_SCHEMA = {
    "type": "object",
    "required": ["info"],
    "properties": {
        "info": {
            "type": "object",
            "required": ["name", "version"],
            "properties": {
                "name":          {"type": "string"},
                "version":       {"type": "string"},
                "requires_dist": {"type": ["array", "null"]},
                "project_urls":  {"type": ["object", "null"]},
                "home_page":     {"type": ["string", "null"]},
            },
        }
    },
}

# ── Data helpers ─────────────────────────────────────────────────────────── #

def _seed_queue(conn) -> list[str]:
    """Fetches top-N packages from hugovk and seeds scheduler_queue for this run."""
    response = requests.get(_PACKAGES_URL, timeout=30)
    response.raise_for_status()
    rows = response.json().get("rows", [])
    packages = [row["project"].lower() for row in rows[:TOP_N] if row.get("project")]
    logger.info("fetched %d packages from hugovk", len(packages))

    conn.execute("DELETE FROM desk_prod.scheduler_queue")
    conn.executemany(
        "INSERT INTO desk_prod.scheduler_queue (package_name, priority, status, retry_count) VALUES (?, 1, 'pending', 0)",
        [[p] for p in packages],
    )
    logger.info("seeded scheduler_queue with %d packages", len(packages))
    return packages


def _load_queue(conn) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "SELECT package_name FROM desk_prod.scheduler_queue ORDER BY package_name"
        ).fetchall()
    ]


def _load_known_versions(conn) -> dict[str, str]:
    """Returns {package_name: latest_version} from dim_packages. Empty on first run."""
    try:
        rows = conn.execute(
            "SELECT package_name, latest_version FROM desk_prod.dim_packages"
        ).fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception as exc:
        logger.warning("could not load dim_packages — treating all as new: %s", exc)
        return {}


def _fetch_pypi(package: str, session: requests.Session) -> dict:
    url = f"https://pypi.org/pypi/{package}/json"
    response = retry_with_backoff(session.get, url, timeout=30)
    response.raise_for_status()
    data = response.json()
    validate_response(data, PYPI_SCHEMA, source="pypi")
    return data


def _search_github_url(package: str, session: requests.Session) -> str | None:
    """
    Fallback: search GitHub for a repo matching the package name.
    Only called when PyPI metadata contains no GitHub URL.
    """
    global _gh_search_rate_limited
    if _gh_search_rate_limited or not _GH_SEARCH_TOKEN:
        return None
    try:
        headers = {"Authorization": f"Bearer {_GH_SEARCH_TOKEN}"}
        resp    = session.get(
            _GH_SEARCH_URL,
            params={"q": f'"{package}" language:Python mirror:false', "sort": "stars", "per_page": 1},
            headers=headers,
            timeout=10,
        )
        if resp.status_code in (403, 429):
            _gh_search_rate_limited = True
            logger.warning("GitHub Search rate-limited — URL fallback disabled for remaining packages")
            return None
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if items:
            return _normalize_github_url(items[0].get("html_url", "") or "")
    except Exception as exc:
        logger.debug("GitHub Search failed for %s: %s", package, exc)
    finally:
        time.sleep(_GH_SEARCH_DELAY)
    return None


def _select_download_batch(packages: list[str]) -> set[str]:
    """
    Pick which packages get a pypistats.org check this run: whichever have
    gone longest without a successful one (never-checked packages first),
    from the committed history file — not an in-memory guess, since DuckDB
    itself doesn't persist between runs.
    """
    last_checked: dict[str, str] = {}
    if DOWNLOAD_HISTORY_PARQUET.exists():
        conn_mem = duckdb.connect(":memory:")
        try:
            rows = conn_mem.execute("""
                SELECT package_name, MAX(recorded_at) AS last_checked
                FROM read_parquet(?)
                GROUP BY package_name
            """, [str(DOWNLOAD_HISTORY_PARQUET)]).fetchall()
        finally:
            conn_mem.close()
        last_checked = {row[0]: str(row[1]) for row in rows}

    # Packages never successfully checked sort first (empty string sorts
    # before any real date), then oldest-checked first.
    ordered = sorted(packages, key=lambda p: last_checked.get(p, ""))
    batch = set(ordered[:DOWNLOADS_BATCH_SIZE])
    logger.info(
        "downloads rotation: checking %d/%d packages this run (pypistats.org "
        "can't support checking all packages daily — see D058)",
        len(batch), len(packages),
    )
    return batch


_pypistats_rate_limited = False


def _fetch_monthly_downloads(package: str, session: requests.Session) -> int | None:
    global _pypistats_rate_limited
    if _pypistats_rate_limited:
        return None
    url = f"https://pypistats.org/api/packages/{package}/recent"
    try:
        response = session.get(url, timeout=10)
        if response.status_code == 429:
            _pypistats_rate_limited = True
            logger.warning("pypistats rate-limited — skipping downloads for remaining packages")
            return None
        response.raise_for_status()
        return response.json()["data"]["last_month"]
    except Exception as exc:
        logger.warning("pypistats unavailable for %s: %s", package, exc)
        return None


def _normalize_github_url(url: str) -> str | None:
    match = re.search(r"github\.com/([^/\s#?]+/[^/\s#?.]+)", url)
    if not match:
        return None
    path = match.group(1).removesuffix(".git").rstrip("/")
    return f"https://github.com/{path}"


def _extract_github_url(info: dict) -> str | None:
    priority_keys = ["Source", "Repository", "Code", "GitHub", "Homepage"]
    project_urls: dict = info.get("project_urls") or {}

    for key in priority_keys:
        if url := project_urls.get(key):
            if "github.com/" in url:
                return _normalize_github_url(url)

    for url in project_urls.values():
        if "github.com/" in url:
            return _normalize_github_url(url)

    home_page: str = info.get("home_page") or ""
    if "github.com/" in home_page:
        return _normalize_github_url(home_page)

    return None


def _build_row(
    data: dict,
    monthly_downloads: int | None,
    github_url: str | None = None,
) -> dict:
    info = data["info"]
    return {
        "ingested_at":       datetime.now(timezone.utc).isoformat(),
        "package_name":      info["name"].lower(),
        "latest_version":    info.get("version"),
        "summary":           info.get("summary"),
        "author":            info.get("author"),
        "author_email":      info.get("author_email"),
        "requires_python":   info.get("requires_python"),
        "requires_dist":     json.dumps(info.get("requires_dist")),
        "project_urls":      json.dumps(info.get("project_urls")),
        "monthly_downloads": monthly_downloads,
        "github_repo_url":   github_url if github_url is not None else _extract_github_url(info),
        "raw_payload":       json.dumps(data),
    }

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("pypi_ingest starting")
    conn = get_connection()

    try:
        _seed_queue(conn)
        packages       = _load_queue(conn)
        known_versions = _load_known_versions(conn)
        download_batch = _select_download_batch(packages)
        logger.info("packages in queue: %d  known in dim_packages: %d",
                    len(packages), len(known_versions))

        mark_running(conn, packages)

        rows: list[dict]      = []
        completed: list[str]  = []
        skipped = 0

        with requests.Session() as session:
            for i, package in enumerate(packages):
                if i % 100 == 0:
                    logger.info("progress: %d/%d packages", i, len(packages))
                try:
                    data    = _fetch_pypi(package, session)
                    version = data["info"].get("version")
                    known   = known_versions.get(package)

                    if known and known == version:
                        skipped += 1
                        completed.append(package)
                        continue

                    if package in download_batch:
                        downloads = _fetch_monthly_downloads(package, session)
                        time.sleep(DOWNLOADS_REQ_DELAY)
                    else:
                        downloads = None
                    gh_url    = _extract_github_url(data["info"])
                    if not gh_url:
                        gh_url = _search_github_url(package, session)

                    rows.append(_build_row(data, downloads, github_url=gh_url))
                    completed.append(package)

                except Exception as exc:
                    logger.error("failed: %s — %s", package, exc)
                    mark_error(conn, package, str(exc), "last_pypi_ingest_at")

        if rows:
            insert_rows(conn, "desk_raw.raw_pypi_packages", rows)
            logger.info("inserted %d rows into raw_pypi_packages", len(rows))

        mark_complete(conn, completed, "last_pypi_ingest_at")

        logger.info(
            "pypi_ingest complete — written=%d skipped=%d errors=%d",
            len(rows), skipped, len(packages) - len(completed),
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
