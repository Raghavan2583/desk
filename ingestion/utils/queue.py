"""
ingestion/utils/queue.py
Shared scheduler_queue status management for all DESK ingestion scripts.
State machine: pending → running → complete / error  (see ARCH.md Section 1)
"""
import logging

from google.cloud import bigquery

logger = logging.getLogger(__name__)


def mark_running(
    client: bigquery.Client,
    queue_table: str,
    packages: list[str],
) -> None:
    if not packages:
        return
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("packages", "STRING", packages)]
    )
    client.query(
        f"UPDATE `{queue_table}` SET status = 'running' WHERE package_name IN UNNEST(@packages)",
        job_config=job_config,
    ).result()
    logger.info("marked %d packages as running", len(packages))


def mark_complete(
    client: bigquery.Client,
    queue_table: str,
    packages: list[str],
    timestamp_field: str,
) -> None:
    """
    timestamp_field: one of last_pypi_ingest_at, last_github_ingest_at,
                     last_osv_ingest_at, last_deps_ingest_at
    """
    if not packages:
        return
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("packages", "STRING", packages)]
    )
    client.query(
        f"""UPDATE `{queue_table}`
            SET status = 'complete',
                {timestamp_field} = CURRENT_TIMESTAMP(),
                last_error = NULL
            WHERE package_name IN UNNEST(@packages)""",
        job_config=job_config,
    ).result()
    logger.info("marked %d packages as complete (%s)", len(packages), timestamp_field)


def mark_error(
    client: bigquery.Client,
    queue_table: str,
    package: str,
    error: str,
    timestamp_field: str,
) -> None:
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("pkg", "STRING", package),
            bigquery.ScalarQueryParameter("err", "STRING", error[:500]),
        ]
    )
    client.query(
        f"""UPDATE `{queue_table}`
            SET status = 'error',
                {timestamp_field} = CURRENT_TIMESTAMP(),
                last_error = @err,
                retry_count = retry_count + 1
            WHERE package_name = @pkg""",
        job_config=job_config,
    ).result()
    logger.warning("marked %s as error: %s", package, error[:120])
