"""
ingestion/pypi_downloads_ingest.py
Fetches monthly download counts from pypistats.org for every package in
scheduler_queue. Split out of pypi_ingest.py (D068) so a pypistats.org
outage can no longer block PyPI metadata, GitHub, OSV, or deps.dev
ingestion — each now runs as an independent GitHub Actions job (see
daily_refresh.yml). Requires scheduler_queue to already be seeded, i.e.
this job runs after the metadata job.

Every package is still checked every run (D064 unchanged) — this script
only controls how fast it gives up when pypistats.org itself is
systemically down. After CIRCUIT_BREAKER_THRESHOLD consecutive failures
across the whole run, remaining packages are skipped without further
requests, so main() returns normally well inside this job's own GitHub
Actions timeout — and this job's export/upload steps still run — instead
of being hard-killed mid-run with nothing salvaged (see the 6 July 2026
pypistats.org incident, where every request 429'd for 2 hours straight
until the job's timeout cancelled it with zero output).

Any individual package whose fetch still fails (or is skipped by the
circuit breaker) falls back in scoring/risk_score.py to carrying forward
the last known real count (with its real date) from
data/history/download_history.parquet.

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/pypi_downloads_ingest.py
"""
import logging
import os
import time
from datetime import datetime, timezone

import requests

from ingestion.db import get_connection, insert_rows
from ingestion.utils.backoff import CircuitBreaker, retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# pypistats.org allows 30 req/min site-wide — 1,000 requests spaced 3s
# apart is ~20/min, safely under that with margin for jitter/retries,
# sustained across the whole run (~50 min for all 1,000 packages).
DOWNLOADS_REQ_DELAY = 3.0

# Trips after this many *consecutive* failures across the whole run —
# distinct from retry_with_backoff's per-package retry count. At ~33s
# worst case per package (5 retries, base_delay=1, exponential+jitter),
# 20 consecutive failures trips in ~11 minutes, well inside this job's
# timeout, while a genuine full-success run is unaffected and ordinary
# scattered (non-systemic) failures are very unlikely to run 20 in a row.
CIRCUIT_BREAKER_THRESHOLD = int(os.environ.get("DOWNLOADS_CIRCUIT_BREAKER_THRESHOLD", "20"))


def _load_queue(conn) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "SELECT package_name FROM desk_prod.scheduler_queue ORDER BY package_name"
        ).fetchall()
    ]


def _get_monthly_downloads(package: str, session: requests.Session) -> int:
    url = f"https://pypistats.org/api/packages/{package}/recent"
    response = session.get(url, timeout=10)
    response.raise_for_status()
    return response.json()["data"]["last_month"]


def _fetch_monthly_downloads(package: str, session: requests.Session) -> int | None:
    try:
        return retry_with_backoff(_get_monthly_downloads, package, session)
    except Exception as exc:
        logger.warning("pypistats unavailable for %s: %s", package, exc)
        return None


def main() -> None:
    logger.info("pypi_downloads_ingest starting")
    conn = get_connection()

    try:
        packages = _load_queue(conn)
        logger.info("packages in queue: %d", len(packages))
        mark_running(conn, packages)

        rows: list[dict]     = []
        completed: list[str] = []
        breaker = CircuitBreaker(threshold=CIRCUIT_BREAKER_THRESHOLD)

        with requests.Session() as session:
            for i, package in enumerate(packages):
                if i % 100 == 0:
                    logger.info("progress: %d/%d packages", i, len(packages))

                if breaker.tripped:
                    mark_error(
                        conn, package,
                        f"skipped — circuit breaker open after "
                        f"{CIRCUIT_BREAKER_THRESHOLD} consecutive pypistats "
                        "failures (systemic outage)",
                        "last_downloads_ingest_at",
                    )
                    continue

                downloads = _fetch_monthly_downloads(package, session)
                time.sleep(DOWNLOADS_REQ_DELAY)

                if downloads is None:
                    breaker.record_failure()
                    mark_error(conn, package, "pypistats fetch failed", "last_downloads_ingest_at")
                    continue

                breaker.record_success()
                rows.append({
                    "ingested_at":       datetime.now(timezone.utc).isoformat(),
                    "package_name":      package,
                    "monthly_downloads": downloads,
                })
                completed.append(package)

        if rows:
            insert_rows(conn, "desk_raw.raw_pypi_downloads", rows)
            logger.info("inserted %d rows into raw_pypi_downloads", len(rows))

        mark_complete(conn, completed, "last_downloads_ingest_at")

        logger.info(
            "pypi_downloads_ingest complete — written=%d errors=%d circuit_breaker_tripped=%s",
            len(rows), len(packages) - len(completed), breaker.tripped,
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
