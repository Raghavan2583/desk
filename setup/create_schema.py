"""
setup/create_schema.py
Initializes all BigQuery datasets and tables for DESK.
Idempotent — safe to re-run. Existing tables are not modified.

Usage:
    GCP_PROJECT_ID=<id> python setup/create_schema.py

Auth: uses Application Default Credentials.
Local dev: set GOOGLE_APPLICATION_CREDENTIALS to your service account key path.
"""
import logging
import os

from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_RAW  = os.environ.get("GCP_DATASET_RAW",  "desk_raw")
DATASET_DEV  = os.environ.get("GCP_DATASET_DEV",  "desk_dev")
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")
LOCATION     = "US"

client = bigquery.Client(project=PROJECT_ID)

# --------------------------------------------------------------------------- #
#  Schema definitions — mirrors ARCH.md Section 1 exactly.                    #
#  JSON columns stored as STRING (JSON-encoded). Noted inline.                #
# --------------------------------------------------------------------------- #

F = bigquery.SchemaField  # local alias for brevity

RAW_PYPI_PACKAGES = [
    F("ingested_at",       "TIMESTAMP", mode="REQUIRED"),
    F("package_name",      "STRING",    mode="REQUIRED"),
    F("latest_version",    "STRING"),
    F("summary",           "STRING"),
    F("author",            "STRING"),
    F("author_email",      "STRING"),
    F("requires_python",   "STRING"),
    F("requires_dist",     "STRING"),   # JSON-encoded array
    F("project_urls",      "STRING"),   # JSON-encoded dict
    F("monthly_downloads", "INT64"),
    F("github_repo_url",   "STRING"),
    F("raw_payload",       "STRING"),
]

RAW_GITHUB_MAINTAINERS = [
    F("ingested_at",        "TIMESTAMP", mode="REQUIRED"),
    F("package_name",       "STRING",    mode="REQUIRED"),
    F("github_repo_url",    "STRING"),
    F("repo_owner",         "STRING"),
    F("repo_name",          "STRING"),
    F("last_commit_at",     "TIMESTAMP"),
    F("commit_count_90d",   "INT64"),
    F("open_issues_count",  "INT64"),
    F("stars_count",        "INT64"),
    F("forks_count",        "INT64"),
    F("contributors_count", "INT64"),
    F("is_archived",        "BOOL"),
    F("is_fork",            "BOOL"),
    F("primary_language",   "STRING"),
    F("license_spdx",       "STRING"),
    F("created_at",         "TIMESTAMP"),
    F("raw_payload",        "STRING"),
]

RAW_OSV_CVES = [
    F("ingested_at",       "TIMESTAMP", mode="REQUIRED"),
    F("package_name",      "STRING",    mode="REQUIRED"),
    F("osv_id",            "STRING",    mode="REQUIRED"),
    F("severity",          "STRING"),
    F("cvss_score",        "FLOAT64"),
    F("published_at",      "TIMESTAMP"),
    F("modified_at",       "TIMESTAMP"),
    F("is_withdrawn",      "BOOL"),
    F("aliases",           "STRING"),   # JSON-encoded array
    F("affected_versions", "STRING"),   # JSON-encoded array
    F("fixed_in_version",  "STRING"),
    F("raw_payload",       "STRING"),
]

RAW_DEPS_EDGES = [
    F("ingested_at",                   "TIMESTAMP", mode="REQUIRED"),
    F("package_name",                  "STRING",    mode="REQUIRED"),
    F("version",                       "STRING"),
    F("dependency_name",               "STRING"),
    F("dependency_version_constraint", "STRING"),
    F("depth_level",                   "INT64"),
    F("raw_payload",                   "STRING"),
]

RAW_DEPS_DEPENDENTS = [
    F("ingested_at",    "TIMESTAMP", mode="REQUIRED"),
    F("package_name",   "STRING",    mode="REQUIRED"),
    F("dependent_count","INT64"),
    F("raw_payload",    "STRING"),
]

SCHEDULER_QUEUE = [
    F("package_name",          "STRING",    mode="REQUIRED"),
    F("priority",              "INT64",     mode="REQUIRED"),
    F("last_pypi_ingest_at",   "TIMESTAMP"),
    F("last_github_ingest_at", "TIMESTAMP"),
    F("last_osv_ingest_at",    "TIMESTAMP"),
    F("last_deps_ingest_at",   "TIMESTAMP"),
    F("next_github_check_at",  "TIMESTAMP"),
    F("status",                "STRING"),
    F("retry_count",           "INT64"),
    F("last_error",            "STRING"),
]

DIM_PACKAGES = [
    F("package_name",      "STRING", mode="REQUIRED"),
    F("latest_version",    "STRING"),
    F("summary",           "STRING"),
    F("requires_python",   "STRING"),
    F("monthly_downloads", "INT64"),
    F("github_repo_url",   "STRING"),
    F("author",            "STRING"),
    F("author_email",      "STRING"),
    F("has_github_link",   "BOOL"),
    F("is_top_1000",       "BOOL"),
    F("first_seen_at",     "TIMESTAMP"),
    F("last_updated_at",   "TIMESTAMP"),
]

DIM_MAINTAINERS = [
    F("github_repo_url",        "STRING", mode="REQUIRED"),
    F("repo_owner",             "STRING"),
    F("repo_name",              "STRING"),
    F("last_commit_at",         "TIMESTAMP"),
    F("days_since_last_commit", "INT64"),
    F("commit_count_90d",       "INT64"),
    F("open_issues_count",      "INT64"),
    F("stars_count",            "INT64"),
    F("contributors_count",     "INT64"),
    F("is_archived",            "BOOL"),
    F("is_fork",                "BOOL"),
    F("activity_label",         "STRING"),
    F("last_updated_at",        "TIMESTAMP"),
]

FACT_DEPENDENCIES = [
    F("package_name",                  "STRING", mode="REQUIRED"),
    F("dependency_name",               "STRING", mode="REQUIRED"),
    F("dependency_version_constraint", "STRING"),
    F("depth_level",                   "INT64"),
    F("is_direct",                     "BOOL"),
    F("ingested_at",                   "TIMESTAMP"),
]

# fact_risk_scores and fact_risk_score_history share the same schema.
# fact_risk_scores is overwritten each run; fact_risk_score_history is append-only.
_RISK_SCORE_FIELDS = [
    F("package_name",         "STRING", mode="REQUIRED"),
    F("risk_score",           "FLOAT64"),
    F("risk_label",           "STRING"),
    F("trend_direction",      "STRING"),
    F("component_maintainer", "FLOAT64"),
    F("component_cve",        "FLOAT64"),
    F("component_depth",      "FLOAT64"),
    F("component_downloads",  "FLOAT64"),
    F("blast_radius_count",   "INT64"),
    F("score_version",        "INT64"),
    F("computed_at",          "TIMESTAMP"),
]

FACT_RISK_SCORES        = _RISK_SCORE_FIELDS
FACT_RISK_SCORE_HISTORY = _RISK_SCORE_FIELDS

# --------------------------------------------------------------------------- #
#  Helpers                                                                     #
# --------------------------------------------------------------------------- #

def _create_dataset(dataset_id: str) -> None:
    dataset = bigquery.Dataset(f"{PROJECT_ID}.{dataset_id}")
    dataset.location = LOCATION
    client.create_dataset(dataset, exists_ok=True)
    logger.info("dataset ready: %s", dataset_id)


def _create_raw_table(dataset_id: str, table_id: str, schema: list) -> None:
    """Raw tables are partitioned by ingested_at (DAY) and clustered by package_name."""
    ref = f"{PROJECT_ID}.{dataset_id}.{table_id}"
    table = bigquery.Table(ref, schema=schema)
    table.time_partitioning = bigquery.TimePartitioning(
        type_=bigquery.TimePartitioningType.DAY,
        field="ingested_at",
    )
    table.clustering_fields = ["package_name"]
    client.create_table(table, exists_ok=True)
    logger.info("table ready: %s.%s", dataset_id, table_id)


def _create_table(dataset_id: str, table_id: str, schema: list) -> None:
    ref = f"{PROJECT_ID}.{dataset_id}.{table_id}"
    table = bigquery.Table(ref, schema=schema)
    client.create_table(table, exists_ok=True)
    logger.info("table ready: %s.%s", dataset_id, table_id)

# --------------------------------------------------------------------------- #
#  Main                                                                        #
# --------------------------------------------------------------------------- #

def main() -> None:
    logger.info("initializing DESK schema — project: %s", PROJECT_ID)

    for ds in (DATASET_RAW, DATASET_DEV, DATASET_PROD):
        _create_dataset(ds)

    raw_tables = {
        "raw_pypi_packages":      RAW_PYPI_PACKAGES,
        "raw_github_maintainers": RAW_GITHUB_MAINTAINERS,
        "raw_osv_cves":           RAW_OSV_CVES,
        "raw_deps_edges":         RAW_DEPS_EDGES,
        "raw_deps_dependents":    RAW_DEPS_DEPENDENTS,
    }
    for table_id, schema in raw_tables.items():
        _create_raw_table(DATASET_RAW, table_id, schema)

    prod_tables = {
        "scheduler_queue":         SCHEDULER_QUEUE,
        "dim_packages":            DIM_PACKAGES,
        "dim_maintainers":         DIM_MAINTAINERS,
        "fact_dependencies":       FACT_DEPENDENCIES,
        "fact_risk_scores":        FACT_RISK_SCORES,
        "fact_risk_score_history": FACT_RISK_SCORE_HISTORY,
    }
    for table_id, schema in prod_tables.items():
        _create_table(DATASET_PROD, table_id, schema)

    # desk_dev mirrors desk_prod — Striker tests here, never touches desk_prod
    for table_id, schema in prod_tables.items():
        _create_table(DATASET_DEV, table_id, schema)

    logger.info("schema initialization complete")


if __name__ == "__main__":
    main()
