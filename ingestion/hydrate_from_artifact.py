"""
ingestion/hydrate_from_artifact.py
Thin CLI over ingestion.utils.artifact_io.import_table — loads one or more
downloaded artifact Parquet files into a fresh DuckDB (D068). Always calls
get_connection() first (idempotent schema setup), so downstream steps
(dbt, ingestion scripts run in fan-out jobs) have every table available
even when some upstream artifacts never arrived — those tables just stay
empty. See daily_refresh.yml.

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/hydrate_from_artifact.py \\
        --dir artifact_in --table desk_prod.scheduler_queue
"""
import argparse
import logging

from ingestion.db import get_connection
from ingestion.utils.artifact_io import import_table

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True, help="Input directory containing downloaded Parquet artifacts")
    parser.add_argument("--table", action="append", required=True, dest="tables",
                         help="Schema-qualified table name, e.g. desk_raw.raw_osv_cves. Repeatable.")
    args = parser.parse_args()

    conn = get_connection()
    try:
        for table in args.tables:
            import_table(conn, table, args.dir)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
