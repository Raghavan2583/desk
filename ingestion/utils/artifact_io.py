"""
ingestion/utils/artifact_io.py
Parquet-based handoff for tables between independent GitHub Actions jobs
(D068). DuckDB is a single embedded file — parallel jobs run on separate
runners with no way to share a live file — so each ingestion job exports
just the table(s) it owns to Parquet, and downstream jobs import them into
their own fresh DB. ingestion.db.get_connection() already creates every
table with CREATE TABLE IF NOT EXISTS, so "import nothing for this table"
just leaves it correctly empty — no diff/merge logic needed anywhere.
"""
import logging
from pathlib import Path

import duckdb

logger = logging.getLogger(__name__)


def _artifact_path(a_dir: Path, table: str) -> Path:
    return Path(a_dir) / f"{table}.parquet"


def export_table(conn: duckdb.DuckDBPyConnection, table: str, out_dir: Path) -> None:
    """
    Writes <out_dir>/<table>.parquet — always, even for zero rows, so "this
    job ran but found nothing" is distinguishable from "this job never ran"
    (missing file, handled by import_table below).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = _artifact_path(out_dir, table)
    conn.execute(f"COPY (SELECT * FROM {table}) TO ? (FORMAT PARQUET)", [str(path)])
    logger.info("exported %s to %s", table, path)


def import_table(conn: duckdb.DuckDBPyConnection, table: str, in_dir: Path) -> bool:
    """
    Loads <in_dir>/<table>.parquet into `table` if present. Returns False
    (table stays empty, no error) if the file doesn't exist — this is
    exactly the "that source failed, timed out, or was skipped today" case
    downstream jobs must tolerate rather than crash on.
    """
    path = _artifact_path(Path(in_dir), table)
    if not path.exists():
        logger.warning("no artifact for %s at %s — leaving table empty", table, path)
        return False
    conn.execute(f"INSERT INTO {table} SELECT * FROM read_parquet(?)", [str(path)])
    logger.info("imported %s from %s", table, path)
    return True
