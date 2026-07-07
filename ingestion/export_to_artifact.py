"""
ingestion/export_to_artifact.py
Thin CLI over ingestion.utils.artifact_io.export_table — writes one or more
tables to Parquet files for a GitHub Actions job to upload as an artifact
(D068). See daily_refresh.yml.

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/export_to_artifact.py \\
        --dir artifact_out --table desk_raw.raw_github_maintainers
"""
import argparse
import logging

from ingestion.db import get_connection
from ingestion.utils.artifact_io import export_table

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True, help="Output directory for Parquet files")
    parser.add_argument("--table", action="append", required=True, dest="tables",
                         help="Schema-qualified table name, e.g. desk_raw.raw_osv_cves. Repeatable.")
    args = parser.parse_args()

    conn = get_connection()
    try:
        for table in args.tables:
            export_table(conn, table, args.dir)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
