"""
ingestion/github_ingest.py
Fetches maintainer activity data from GitHub GraphQL API.
Uses alias-based batching (50 repos per query) to minimise API calls.
Writes to raw_github_maintainers.

Packages with no github_repo_url are skipped — no row written (ARCH.md Section 2).

Usage:
    GCP_PROJECT_ID=<id> GITHUB_TOKENS='["token"]' python ingestion/github_ingest.py
"""
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone

import requests
from google.cloud import bigquery

from ingestion.utils.backoff import retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running
from ingestion.utils.token_pool import load_from_env as load_token_pool
from ingestion.utils.validation import validate_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_RAW  = os.environ.get("GCP_DATASET_RAW",  "desk_raw")
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")

client     = bigquery.Client(project=PROJECT_ID)
token_pool = load_token_pool()

_RAW_TABLE      = f"{PROJECT_ID}.{DATASET_RAW}.raw_github_maintainers"
_QUEUE_TABLE    = f"{PROJECT_ID}.{DATASET_PROD}.scheduler_queue"
_DIM_TABLE      = f"{PROJECT_ID}.{DATASET_PROD}.dim_packages"
_RAW_PYPI_TABLE = f"{PROJECT_ID}.{DATASET_RAW}.raw_pypi_packages"

BATCH_SIZE        = 50    # repos per GraphQL query
RATE_LIMIT_BUFFER = 100   # sleep when X-RateLimit-Remaining drops below this
DAYS_HISTORY      = 90    # commit history window

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

GITHUB_REPO_SCHEMA = {
    "type": "object",
    "required": ["pushedAt", "stargazerCount", "forkCount", "isArchived", "isFork",
                 "issues", "mentionableUsers"],
    "properties": {
        "pushedAt":         {"type": ["string", "null"]},
        "stargazerCount":   {"type": "integer"},
        "forkCount":        {"type": "integer"},
        "isArchived":       {"type": "boolean"},
        "isFork":           {"type": "boolean"},
        "defaultBranchRef": {"type": ["object", "null"]},
        "issues":           {"type": "object", "required": ["totalCount"]},
        "mentionableUsers": {"type": "object", "required": ["totalCount"]},
    },
}

# ── Data loading ─────────────────────────────────────────────────────────── #

def _load_packages_with_github_url() -> dict[str, str]:
    """
    Returns {package_name: github_repo_url}.
    Tries dim_packages first (populated after first dbt run).
    Falls back to raw_pypi_packages on the initial run (before dbt has executed).
    """
    try:
        query = f"""
            SELECT package_name, github_repo_url FROM `{_DIM_TABLE}`
            WHERE github_repo_url IS NOT NULL
        """
        result = {row.package_name: row.github_repo_url
                  for row in client.query(query).result()}
        if result:
            logger.info("loaded %d github URLs from dim_packages", len(result))
            return result
    except Exception as exc:
        logger.warning("dim_packages not available: %s", exc)

    logger.info("falling back to raw_pypi_packages for github URLs (initial run)")
    query = f"""
        SELECT package_name, github_repo_url FROM (
            SELECT package_name, github_repo_url,
                   ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC) AS rn
            FROM `{_RAW_PYPI_TABLE}`
            WHERE github_repo_url IS NOT NULL
        ) WHERE rn = 1
    """
    result = {row.package_name: row.github_repo_url
              for row in client.query(query).result()}
    logger.info("loaded %d github URLs from raw_pypi_packages", len(result))
    return result

# ── GraphQL query builder ─────────────────────────────────────────────────── #

def _parse_owner_repo(github_url: str) -> tuple[str, str] | None:
    match = re.search(r"github\.com/([^/\s]+)/([^/\s#?]+)", github_url)
    if not match:
        return None
    return match.group(1), match.group(2).rstrip("/").removesuffix(".git")


def _build_query(batch: list[tuple[str, str, str]], since_90d: str) -> str:
    """
    batch: [(alias, owner, repo_name), ...]
    Returns a complete GraphQL query string with one alias per repo.
    """
    fragments = []
    for alias, owner, repo_name in batch:
        # Escape quotes in owner/repo names (defensive — should never appear)
        safe_owner = owner.replace('"', "")
        safe_repo  = repo_name.replace('"', "")
        fragments.append(f"""
  {alias}: repository(owner: "{safe_owner}", name: "{safe_repo}") {{
    pushedAt
    defaultBranchRef {{
      target {{
        ... on Commit {{
          committedDate
          history(since: "{since_90d}") {{ totalCount }}
        }}
      }}
    }}
    issues(states: OPEN) {{ totalCount }}
    stargazerCount
    forkCount
    isArchived
    isFork
    primaryLanguage {{ name }}
    licenseInfo {{ spdxId }}
    createdAt
    mentionableUsers {{ totalCount }}
  }}""")
    return "query {" + "".join(fragments) + "\n}"

# ── Rate limiting ─────────────────────────────────────────────────────────── #

def _check_rate_limit(headers: requests.structures.CaseInsensitiveDict) -> None:
    remaining = int(headers.get("X-RateLimit-Remaining", 9999))
    if remaining < RATE_LIMIT_BUFFER:
        reset_at   = int(headers.get("X-RateLimit-Reset", 0))
        sleep_secs = max(0, reset_at - int(time.time())) + 5
        logger.warning(
            "rate limit low (%d remaining) — sleeping %ds until reset",
            remaining, sleep_secs,
        )
        time.sleep(sleep_secs)

# ── Row builder ──────────────────────────────────────────────────────────── #

def _build_row(
    package_name: str,
    owner: str,
    repo_name: str,
    repo: dict,
    ingested_at: str,
) -> dict:
    default_branch = repo.get("defaultBranchRef") or {}
    target         = default_branch.get("target") or {}
    last_commit_at = target.get("committedDate")
    commit_count   = (target.get("history") or {}).get("totalCount", 0)
    primary_lang   = (repo.get("primaryLanguage") or {}).get("name")
    license_spdx   = (repo.get("licenseInfo") or {}).get("spdxId")

    return {
        "ingested_at":        ingested_at,
        "package_name":       package_name,
        "github_repo_url":    f"https://github.com/{owner}/{repo_name}",
        "repo_owner":         owner,
        "repo_name":          repo_name,
        "last_commit_at":     last_commit_at,
        "commit_count_90d":   commit_count,
        "open_issues_count":  repo["issues"]["totalCount"],
        "stars_count":        repo["stargazerCount"],
        "forks_count":        repo["forkCount"],
        "contributors_count": repo["mentionableUsers"]["totalCount"],
        "is_archived":        repo["isArchived"],
        "is_fork":            repo["isFork"],
        "primary_language":   primary_lang,
        "license_spdx":       license_spdx,
        "created_at":         repo.get("createdAt"),
        "raw_payload":        json.dumps(repo),
    }

# ── Batch execution ────────────────────────────────────────────────────────��� #

def _execute_batch(
    batch_items: list[tuple[str, str, str, str]],
    session: requests.Session,
    token: str,
    since_90d: str,
    ingested_at: str,
) -> tuple[list[dict], list[str]]:
    """
    batch_items: [(package_name, alias, owner, repo_name), ...]
    Returns (rows_written, completed_packages).
    Repos not found in GitHub (null response) are logged and skipped — not treated as errors.
    """
    query_batch = [(alias, owner, repo) for _, alias, owner, repo in batch_items]
    graphql_query = _build_query(query_batch, since_90d)

    response = retry_with_backoff(
        session.post,
        GITHUB_GRAPHQL_URL,
        json={"query": graphql_query},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    response.raise_for_status()
    _check_rate_limit(response.headers)

    payload = response.json()

    if "errors" in payload:
        for err in payload["errors"]:
            logger.warning("GraphQL partial error: %s", err.get("message"))

    data = payload.get("data") or {}
    rows: list[dict]     = []
    completed: list[str] = []

    for package_name, alias, owner, repo_name in batch_items:
        repo_data = data.get(alias)
        if repo_data is None:
            logger.warning("repo not found on GitHub: %s/%s (package: %s)",
                           owner, repo_name, package_name)
            completed.append(package_name)  # processed — no row written
            continue
        validate_response(repo_data, GITHUB_REPO_SCHEMA, source="github")
        rows.append(_build_row(package_name, owner, repo_name, repo_data, ingested_at))
        completed.append(package_name)

    return rows, completed

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("github_ingest starting — project=%s", PROJECT_ID)

    packages_with_urls = _load_packages_with_github_url()
    token              = token_pool.get()
    since_90d          = (
        datetime.now(timezone.utc) - timedelta(days=DAYS_HISTORY)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    ingested_at        = datetime.now(timezone.utc).isoformat()

    # Build batch items — skip packages where URL cannot be parsed
    batch_items: list[tuple[str, str, str, str]] = []
    for i, (package_name, github_url) in enumerate(packages_with_urls.items()):
        parsed = _parse_owner_repo(github_url)
        if not parsed:
            logger.warning("unparseable github URL for %s: %s", package_name, github_url)
            continue
        owner, repo_name = parsed
        batch_items.append((package_name, f"repo_{i}", owner, repo_name))

    logger.info("packages with github URL: %d  batches: %d",
                len(batch_items), -(-len(batch_items) // BATCH_SIZE))

    all_packages = [item[0] for item in batch_items]
    mark_running(client, _QUEUE_TABLE, all_packages)

    rows: list[dict]     = []
    completed: list[str] = []

    with requests.Session() as session:
        for start in range(0, len(batch_items), BATCH_SIZE):
            batch = batch_items[start:start + BATCH_SIZE]
            try:
                batch_rows, batch_completed = _execute_batch(
                    batch, session, token, since_90d, ingested_at
                )
                rows.extend(batch_rows)
                completed.extend(batch_completed)
                logger.info(
                    "batch %d–%d done — %d rows",
                    start, start + len(batch) - 1, len(batch_rows),
                )
            except Exception as exc:
                logger.error("batch %d–%d failed: %s", start, start + len(batch) - 1, exc)
                for package_name, _, _, _ in batch:
                    mark_error(client, _QUEUE_TABLE, package_name,
                                str(exc), "last_github_ingest_at")

    if rows:
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
        logger.info("inserted %d rows into raw_github_maintainers", len(rows))

    mark_complete(client, _QUEUE_TABLE, completed, "last_github_ingest_at")

    logger.info(
        "github_ingest complete — written=%d errors=%d",
        len(rows), len(all_packages) - len(completed),
    )


if __name__ == "__main__":
    main()
