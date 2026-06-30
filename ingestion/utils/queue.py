"""
ingestion/utils/queue.py
Shared scheduler_queue status management for all DESK ingestion scripts.
State machine: pending → running → complete / error
"""
import logging

import duckdb

logger = logging.getLogger(__name__)

_QUEUE_TABLE = "desk_prod.scheduler_queue"


def mark_running(conn: duckdb.DuckDBPyConnection, packages: list[str]) -> None:
    if not packages:
        return
    placeholders = ", ".join(["?" for _ in packages])
    conn.execute(
        f"UPDATE {_QUEUE_TABLE} SET status = 'running' WHERE package_name IN ({placeholders})",
        packages,
    )
    logger.info("marked %d packages as running", len(packages))


def mark_complete(
    conn: duckdb.DuckDBPyConnection,
    packages: list[str],
    timestamp_field: str,
) -> None:
    if not packages:
        return
    placeholders = ", ".join(["?" for _ in packages])
    conn.execute(
        f"""UPDATE {_QUEUE_TABLE}
            SET status = 'complete',
                {timestamp_field} = CURRENT_TIMESTAMP,
                last_error = NULL
            WHERE package_name IN ({placeholders})""",
        packages,
    )
    logger.info("marked %d packages as complete (%s)", len(packages), timestamp_field)


def mark_error(
    conn: duckdb.DuckDBPyConnection,
    package: str,
    error: str,
    timestamp_field: str,
) -> None:
    conn.execute(
        f"""UPDATE {_QUEUE_TABLE}
            SET status = 'error',
                {timestamp_field} = CURRENT_TIMESTAMP,
                last_error = ?,
                retry_count = retry_count + 1
            WHERE package_name = ?""",
        [error[:500], package],
    )
    logger.warning("marked %s as error: %s", package, error[:120])
