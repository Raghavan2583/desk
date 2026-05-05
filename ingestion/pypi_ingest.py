"""
ingestion/pypi_ingest.py
Fetches package metadata from PyPI JSON API and pypistats.org.
Writes new or changed packages to raw_pypi_packages.

Skips packages whose version matches the current record in dim_packages.
On first run (dim_packages empty), all packages are written.

Usage:
    GCP_PROJECT_ID=<id> python ingestion/pypi_ingest.py
"""
import json
import logging
import os
import re
import time
from datetime import datetime, timezone

import requests
from google.cloud import bigquery

from ingestion.utils.backoff import retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running
from ingestion.utils.validation import validate_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_RAW  = os.environ.get("GCP_DATASET_RAW",  "desk_raw")
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")

client = bigquery.Client(project=PROJECT_ID)

_RAW_TABLE   = f"{PROJECT_ID}.{DATASET_RAW}.raw_pypi_packages"
_QUEUE_TABLE = f"{PROJECT_ID}.{DATASET_PROD}.scheduler_queue"
_DIM_TABLE   = f"{PROJECT_ID}.{DATASET_PROD}.dim_packages"

# ── GitHub Search fallback ────────────────────────────────────────────────── #
# Used when no GitHub URL is found in PyPI metadata (project_urls / home_page).
# Requires GITHUB_TOKENS env var. Gracefully skips if unavailable.
# Rate-limited at 2.1s/req (~28 req/min) — below the 30 req/min authenticated limit.

_GH_SEARCH_URL   = "https://api.github.com/search/repositories"
_GH_SEARCH_DELAY = 2.1
_GH_SEARCH_TOKEN: str | None = None
_gh_search_rate_limited = False  # abort remaining searches after a 429/403

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

def _load_queue() -> list[str]:
    query = f"SELECT package_name FROM `{_QUEUE_TABLE}` ORDER BY package_name"
    return [row.package_name for row in client.query(query).result()]


def _load_known_versions() -> dict[str, str]:
    """Returns {package_name: latest_version} from dim_packages. Empty on first run."""
    try:
        query = f"SELECT package_name, latest_version FROM `{_DIM_TABLE}`"
        return {row.package_name: row.latest_version for row in client.query(query).result()}
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
    Result stored permanently in raw_pypi_packages on this run.
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


_pypistats_rate_limited = False  # abort remaining calls once we hit a 429


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
    logger.info("pypi_ingest starting — project=%s", PROJECT_ID)

    packages       = _load_queue()
    known_versions = _load_known_versions()
    logger.info("packages in queue: %d  known in dim_packages: %d",
                len(packages), len(known_versions))

    mark_running(client, _QUEUE_TABLE, packages)

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

                downloads = _fetch_monthly_downloads(package, session)

                # GitHub URL: try PyPI metadata first, fall back to Search API.
                # The discovered URL is stored in this row — once written to
                # raw_pypi_packages it persists on future runs without re-searching.
                gh_url = _extract_github_url(data["info"])
                if not gh_url:
                    gh_url = _search_github_url(package, session)

                rows.append(_build_row(data, downloads, github_url=gh_url))
                completed.append(package)

            except Exception as exc:
                logger.error("failed: %s — %s", package, exc)
                mark_error(client, _QUEUE_TABLE, package, str(exc), "last_pypi_ingest_at")

    if rows:
        # Load job — handles large raw_payload rows that exceed streaming insert limits.
        job = client.load_table_from_json(
            rows,
            _RAW_TABLE,
            job_config=bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
                schema=client.get_table(_RAW_TABLE).schema,
            ),
        )
        job.result()
        if job.errors:
            raise RuntimeError("BigQuery load failed: %s" % job.errors)
        logger.info("inserted %d rows into raw_pypi_packages", len(rows))

    mark_complete(client, _QUEUE_TABLE, completed, "last_pypi_ingest_at")

    logger.info(
        "pypi_ingest complete — written=%d skipped=%d errors=%d",
        len(rows), skipped, len(packages) - len(completed),
    )


if __name__ == "__main__":
    main()
