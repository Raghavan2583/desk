"""
ingestion/bootstrap.py
Seeds scheduler_queue with the top-N PyPI packages by download count.

Run once to initialize, then monthly to pick up new entrants.
Idempotent — skips packages already present in scheduler_queue.

Usage:
    GCP_PROJECT_ID=<id> python ingestion/bootstrap.py
"""
import logging
import os

from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")
TOP_N        = int(os.environ.get("PYPI_TOP_N", "1000"))

client = bigquery.Client(project=PROJECT_ID)

_QUEUE_TABLE = f"{PROJECT_ID}.{DATASET_PROD}.scheduler_queue"

_TOP_PACKAGES_SQL = """
SELECT file.project AS package_name, COUNT(*) AS downloads
FROM `bigquery-public-data.pypi.file_downloads`
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND file.project IS NOT NULL
  AND file.project != ''
GROUP BY package_name
ORDER BY downloads DESC
LIMIT @n
"""


def _fetch_top_packages(n: int) -> list[str]:
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("n", "INT64", n)]
    )
    rows = client.query(_TOP_PACKAGES_SQL, job_config=job_config).result()
    packages = [row.package_name for row in rows]
    logger.info("fetched top %d packages from bigquery-public-data", len(packages))
    return packages


def _fetch_existing_packages() -> set[str]:
    query = f"SELECT package_name FROM `{_QUEUE_TABLE}`"
    rows = client.query(query).result()
    existing = {row.package_name for row in rows}
    logger.info("scheduler_queue has %d existing packages", len(existing))
    return existing


def _seed(packages: list[str], existing: set[str]) -> None:
    new_packages = [p for p in packages if p not in existing]
    if not new_packages:
        logger.info("no new packages to add — scheduler_queue already up to date")
        return

    rows = [
        {"package_name": p, "priority": 1, "status": "pending", "retry_count": 0}
        for p in new_packages
    ]
    errors = client.insert_rows_json(_QUEUE_TABLE, rows)
    if errors:
        raise RuntimeError("scheduler_queue seed failed: %s" % errors)

    logger.info("added %d new packages to scheduler_queue", len(new_packages))


def main() -> None:
    logger.info("bootstrap starting — top_n=%d project=%s", TOP_N, PROJECT_ID)
    packages = _fetch_top_packages(TOP_N)
    existing = _fetch_existing_packages()
    _seed(packages, existing)
    logger.info("bootstrap complete")


if __name__ == "__main__":
    main()
