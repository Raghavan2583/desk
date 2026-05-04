"""
ingestion/deps_dev_ingest.py
Fetches dependency edges and dependent counts from deps.dev.
Two API calls per package — sequential (no batching available for this API).

  API 1: GET /v3alpha/systems/PYPI/packages/{name}/versions/{version}/dependencies
         → raw_deps_edges (one row per dependency node)

  API 2: GET /v3alpha/systems/PYPI/packages/{name}
         → raw_deps_dependents (one row per package — global dependent count)

404 responses mean the package is not yet indexed by deps.dev.
These are treated as "no data" (marked complete, no rows written) rather than errors,
since 404 never resolves and would trap the package in error state permanently.

Usage:
    GCP_PROJECT_ID=<id> python ingestion/deps_dev_ingest.py
"""
import json
import logging
import os
import urllib.parse
from datetime import datetime, timezone

import requests
from google.cloud import bigquery

from ingestion.utils.backoff import retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running
from ingestion.utils.validation import validate_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_RAW  = os.environ.get("GCP_DATASET_RAW",  "desk_raw")
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")

client = bigquery.Client(project=PROJECT_ID)

_EDGES_TABLE      = f"{PROJECT_ID}.{DATASET_RAW}.raw_deps_edges"
_DEPENDENTS_TABLE = f"{PROJECT_ID}.{DATASET_RAW}.raw_deps_dependents"
_QUEUE_TABLE      = f"{PROJECT_ID}.{DATASET_PROD}.scheduler_queue"
_DIM_TABLE        = f"{PROJECT_ID}.{DATASET_PROD}.dim_packages"
_RAW_PYPI_TABLE   = f"{PROJECT_ID}.{DATASET_RAW}.raw_pypi_packages"

DEPS_DEV_BASE = "https://api.deps.dev/v3alpha/systems/PYPI/packages"

DEPS_DEV_DEPS_SCHEMA = {
    "type": "object",
    "required": ["nodes"],
    "properties": {"nodes": {"type": "array"}},
}

DEPS_DEV_PACKAGE_SCHEMA = {
    "type": "object",
    "required": ["defaultVersion"],
    "properties": {
        "defaultVersion": {
            "type": "object",
            "required": ["dependentCount"],
            "properties": {"dependentCount": {"type": "integer"}},
        }
    },
}

# ── Data loading ─────────────────────────────────────────────────────────── #

def _load_packages_with_versions() -> dict[str, str]:
    """
    Returns {package_name: latest_version}.
    Tries dim_packages first, falls back to raw_pypi_packages on initial run.
    """
    try:
        query = f"""
            SELECT package_name, latest_version FROM `{_DIM_TABLE}`
            WHERE latest_version IS NOT NULL
        """
        result = {row.package_name: row.latest_version
                  for row in client.query(query).result()}
        if result:
            logger.info("loaded %d package versions from dim_packages", len(result))
            return result
    except Exception as exc:
        logger.warning("dim_packages not available: %s", exc)

    logger.info("falling back to raw_pypi_packages for package versions")
    query = f"""
        SELECT package_name, latest_version FROM (
            SELECT package_name, latest_version,
                   ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC) AS rn
            FROM `{_RAW_PYPI_TABLE}`
            WHERE latest_version IS NOT NULL
        ) WHERE rn = 1
    """
    result = {row.package_name: row.latest_version
              for row in client.query(query).result()}
    logger.info("loaded %d package versions from raw_pypi_packages", len(result))
    return result

# ── API helpers ──────────────────────────────────────────────────────────── #

def _get(url: str, session: requests.Session) -> dict | None:
    """
    GET url with backoff. Returns parsed JSON or None if 404.
    All other errors propagate to the caller.
    """
    try:
        response = retry_with_backoff(session.get, url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 404:
            return None
        raise


def _fetch_dependencies(
    package: str, version: str, session: requests.Session
) -> dict | None:
    encoded_version = urllib.parse.quote(version, safe="")
    url = f"{DEPS_DEV_BASE}/{package}/versions/{encoded_version}/dependencies"
    data = _get(url, session)
    if data is not None:
        validate_response(data, DEPS_DEV_DEPS_SCHEMA, source="deps.dev.deps")
    return data


def _fetch_package(package: str, session: requests.Session) -> dict | None:
    url = f"{DEPS_DEV_BASE}/{package}"
    data = _get(url, session)
    if data is not None:
        validate_response(data, DEPS_DEV_PACKAGE_SCHEMA, source="deps.dev.package")
    return data

# ── Row builders ─────────────────────────────────────────────────────────── #

def _build_edge_rows(
    package_name: str,
    version: str,
    deps_data: dict,
    ingested_at: str,
) -> list[dict]:
    rows = []
    for node in deps_data.get("nodes") or []:
        relation = node.get("relation", "")
        if relation == "SELF":
            continue

        version_key = node.get("versionKey") or {}
        dep_name    = (version_key.get("name") or "").lower()
        dep_version = version_key.get("version") or ""

        if not dep_name:
            continue

        rows.append({
            "ingested_at":                   ingested_at,
            "package_name":                  package_name,
            "version":                       version,
            "dependency_name":               dep_name,
            "dependency_version_constraint": dep_version,  # resolved version
            "depth_level":                   1 if relation == "DIRECT" else 2,
            "raw_payload":                   json.dumps(node),
        })
    return rows


def _build_dependent_row(
    package_name: str,
    package_data: dict,
    ingested_at: str,
) -> dict:
    default_version  = package_data.get("defaultVersion") or {}
    dependent_count  = default_version.get("dependentCount", 0)
    return {
        "ingested_at":    ingested_at,
        "package_name":   package_name,
        "dependent_count": dependent_count,
        "raw_payload":    json.dumps(package_data),
    }

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("deps_dev_ingest starting — project=%s", PROJECT_ID)

    packages_with_versions = _load_packages_with_versions()
    ingested_at            = datetime.now(timezone.utc).isoformat()
    all_packages           = list(packages_with_versions.keys())

    mark_running(client, _QUEUE_TABLE, all_packages)

    edge_rows: list[dict]      = []
    dependent_rows: list[dict] = []
    completed: list[str]       = []
    not_indexed                = 0

    with requests.Session() as session:
        for package_name, version in packages_with_versions.items():
            try:
                deps_data    = _fetch_dependencies(package_name, version, session)
                package_data = _fetch_package(package_name, session)

                if deps_data is None and package_data is None:
                    logger.info("not indexed in deps.dev: %s", package_name)
                    not_indexed += 1
                    completed.append(package_name)
                    continue

                if deps_data is not None:
                    rows = _build_edge_rows(package_name, version, deps_data, ingested_at)
                    edge_rows.extend(rows)
                    logger.info("%-40s %d dep(s)", package_name, len(rows))

                if package_data is not None:
                    dependent_rows.append(
                        _build_dependent_row(package_name, package_data, ingested_at)
                    )

                completed.append(package_name)

            except Exception as exc:
                logger.error("failed: %s — %s", package_name, exc)
                mark_error(client, _QUEUE_TABLE, package_name,
                            str(exc), "last_deps_ingest_at")

    def _load(rows: list[dict], table_ref: str, label: str) -> None:
        job = client.load_table_from_json(
            rows,
            table_ref,
            job_config=bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
                schema=client.get_table(table_ref).schema,
            ),
        )
        job.result()
        if job.errors:
            raise RuntimeError("BigQuery load failed (%s): %s" % (label, job.errors))
        logger.info("inserted %d rows into %s", len(rows), label)

    if edge_rows:
        _load(edge_rows, _EDGES_TABLE, "raw_deps_edges")

    if dependent_rows:
        _load(dependent_rows, _DEPENDENTS_TABLE, "raw_deps_dependents")

    mark_complete(client, _QUEUE_TABLE, completed, "last_deps_ingest_at")

    logger.info(
        "deps_dev_ingest complete — edges=%d dependents=%d not_indexed=%d errors=%d",
        len(edge_rows), len(dependent_rows), not_indexed,
        len(all_packages) - len(completed),
    )


if __name__ == "__main__":
    main()
