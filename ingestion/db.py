"""
ingestion/db.py
Shared DuckDB connection and schema setup for all DESK ingestion scripts.
Creates desk_raw and desk_prod schemas and all raw/queue tables on first call.
"""
import logging
import os

import duckdb

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("DESK_DB_PATH", "data/desk.duckdb")


def get_connection() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(DB_PATH)
    _setup(conn)
    return conn


def insert_rows(conn: duckdb.DuckDBPyConnection, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())
    placeholders = ", ".join(["?" for _ in columns])
    col_names = ", ".join(columns)
    conn.executemany(
        f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})",
        [list(row.values()) for row in rows],
    )


def _setup(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("CREATE SCHEMA IF NOT EXISTS desk_raw")
    conn.execute("CREATE SCHEMA IF NOT EXISTS desk_prod")
    _create_raw_tables(conn)
    _create_queue_table(conn)
    _create_fact_table(conn)


def _create_raw_tables(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_pypi_packages (
            ingested_at       TIMESTAMPTZ NOT NULL,
            package_name      VARCHAR     NOT NULL,
            latest_version    VARCHAR,
            summary           VARCHAR,
            author            VARCHAR,
            author_email      VARCHAR,
            requires_python   VARCHAR,
            requires_dist     VARCHAR,
            project_urls      VARCHAR,
            github_repo_url   VARCHAR,
            raw_payload       VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_pypi_downloads (
            ingested_at       TIMESTAMPTZ NOT NULL,
            package_name      VARCHAR     NOT NULL,
            monthly_downloads BIGINT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_github_maintainers (
            ingested_at        TIMESTAMPTZ NOT NULL,
            package_name       VARCHAR     NOT NULL,
            github_repo_url    VARCHAR,
            repo_owner         VARCHAR,
            repo_name          VARCHAR,
            last_commit_at     TIMESTAMPTZ,
            commit_count_90d   BIGINT,
            open_issues_count  BIGINT,
            stars_count        BIGINT,
            forks_count        BIGINT,
            contributors_count BIGINT,
            is_archived        BOOLEAN,
            is_fork            BOOLEAN,
            primary_language   VARCHAR,
            license_spdx       VARCHAR,
            created_at         TIMESTAMPTZ,
            raw_payload        VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_osv_cves (
            ingested_at       TIMESTAMPTZ NOT NULL,
            package_name      VARCHAR     NOT NULL,
            osv_id            VARCHAR     NOT NULL,
            severity          VARCHAR,
            cvss_score        DOUBLE,
            published_at      TIMESTAMPTZ,
            modified_at       TIMESTAMPTZ,
            is_withdrawn      BOOLEAN,
            aliases           VARCHAR,
            affected_versions VARCHAR,
            fixed_in_version  VARCHAR,
            raw_payload       VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_deps_edges (
            ingested_at                   TIMESTAMPTZ NOT NULL,
            package_name                  VARCHAR     NOT NULL,
            version                       VARCHAR,
            dependency_name               VARCHAR,
            dependency_version_constraint VARCHAR,
            depth_level                   BIGINT,
            raw_payload                   VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_raw.raw_deps_dependents (
            ingested_at     TIMESTAMPTZ NOT NULL,
            package_name    VARCHAR     NOT NULL,
            dependent_count BIGINT,
            raw_payload     VARCHAR
        )
    """)


def _create_queue_table(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_prod.scheduler_queue (
            package_name          VARCHAR NOT NULL,
            priority              BIGINT  NOT NULL DEFAULT 1,
            last_pypi_ingest_at      TIMESTAMPTZ,
            last_downloads_ingest_at TIMESTAMPTZ,
            last_github_ingest_at    TIMESTAMPTZ,
            last_osv_ingest_at       TIMESTAMPTZ,
            last_deps_ingest_at      TIMESTAMPTZ,
            next_github_check_at     TIMESTAMPTZ,
            status                VARCHAR DEFAULT 'pending',
            retry_count           BIGINT  DEFAULT 0,
            last_error            VARCHAR
        )
    """)


def _create_fact_table(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS desk_prod.fact_risk_scores (
            package_name         VARCHAR,
            risk_score           DOUBLE,
            risk_label           VARCHAR,
            trend_direction      VARCHAR,
            component_maintainer DOUBLE,
            component_cve        DOUBLE,
            component_depth      DOUBLE,
            component_downloads  DOUBLE,
            blast_radius_count   BIGINT,
            score_version        BIGINT,
            computed_at          TIMESTAMPTZ,
            -- Resolved maintainer snapshot actually used to compute the score
            -- above — may be carried forward from a prior run when this run's
            -- GitHub fetch failed. maintainer_status distinguishes
            -- LIVE / CARRIED_FORWARD / NEVER_VERIFIED / NO_GITHUB_LINK so
            -- consumers never mistake stale data for a fresh read.
            maintainer_status                 VARCHAR,
            maintainer_last_verified_at       TIMESTAMPTZ,
            maintainer_last_commit_at         TIMESTAMPTZ,
            maintainer_days_since_last_commit BIGINT,
            maintainer_commit_count_90d       BIGINT,
            maintainer_is_archived            BOOLEAN,
            maintainer_activity_label         VARCHAR,
            -- Same idea for download counts — all 1,000 packages are
            -- checked every run (D064), but an individual package's
            -- pypistats.org fetch can still fail, or the whole run can trip
            -- pypi_downloads_ingest.py's circuit breaker (D068). downloads_status
            -- distinguishes LIVE / CARRIED_FORWARD / NEVER_VERIFIED the same way.
            downloads_status               VARCHAR,
            downloads_last_verified_at     TIMESTAMPTZ,
            downloads_resolved_monthly     BIGINT
        )
    """)
