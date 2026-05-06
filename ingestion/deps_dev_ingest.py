"""
ingestion/deps_dev_ingest.py
Derives dependency edges and blast radius counts from requires_dist data
already present in raw_pypi_packages. No external API calls required.

Previous approach used deps.dev v3alpha, which removed dependentCount from
its package endpoint and returns 404 for all PyPI dependency lookups. Replaced
with in-process parsing of PyPI requires_dist — more reliable, no API quota,
no future schema drift risk.

Writes:
  raw_deps_edges       — one row per direct dependency within the top-1000 set
  raw_deps_dependents  — one row per package with its blast radius count
                         (count of top-1000 packages that depend on it)

Usage:
    GCP_PROJECT_ID=<id> python ingestion/deps_dev_ingest.py
"""
import json
import logging
import os
import re
from datetime import datetime, timezone

from google.cloud import bigquery
from google.cloud.bigquery import LoadJobConfig, WriteDisposition

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID   = os.environ["GCP_PROJECT_ID"]
DATASET_RAW  = os.environ.get("GCP_DATASET_RAW",  "desk_raw")
DATASET_PROD = os.environ.get("GCP_DATASET_PROD", "desk_prod")

client = bigquery.Client(project=PROJECT_ID)

_EDGES_TABLE      = f"{PROJECT_ID}.{DATASET_RAW}.raw_deps_edges"
_DEPENDENTS_TABLE = f"{PROJECT_ID}.{DATASET_RAW}.raw_deps_dependents"
_RAW_PYPI_TABLE   = f"{PROJECT_ID}.{DATASET_RAW}.raw_pypi_packages"

# PEP 508 package name pattern — stops at extras bracket, version spec, or env marker
_PKG_NAME_RE = re.compile(r'^([A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)')


def _normalize(name: str) -> str:
    """PEP 503 canonical name: lowercase, collapse [-_.] runs to a hyphen."""
    return re.sub(r'[-_.]+', '-', name).lower()


def _parse_dep_name(spec: str) -> str | None:
    m = _PKG_NAME_RE.match(spec.strip())
    return _normalize(m.group(1)) if m else None


def _load_requires_dist() -> dict[str, tuple[str, list[str]]]:
    """Returns {package_name: (latest_version, [requirement_spec, ...])}."""
    query = f"""
        SELECT package_name, latest_version, requires_dist
        FROM (
            SELECT package_name, latest_version, requires_dist,
                   ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC) AS rn
            FROM `{_RAW_PYPI_TABLE}`
        )
        WHERE rn = 1
    """
    result: dict[str, tuple[str, list[str]]] = {}
    for row in client.query(query).result():
        version = row.latest_version or ""
        specs: list[str] = []
        if row.requires_dist:
            try:
                specs = json.loads(row.requires_dist) or []
            except (json.JSONDecodeError, TypeError):
                pass
        result[row.package_name] = (version, specs)
    logger.info("loaded requires_dist for %d packages", len(result))
    return result


def _build_edges_and_counts(
    packages: dict[str, tuple[str, list[str]]],
    ingested_at: str,
) -> tuple[list[dict], list[dict]]:
    """
    Returns (edge_rows, dependent_rows).
    Only edges where both source and target are in the top-1000 set are written.
    """
    watched = set(packages.keys())
    edge_rows: list[dict] = []
    dep_counts: dict[str, int] = {}

    for pkg_name, (version, specs) in packages.items():
        seen: set[str] = set()

        for spec in specs:
            dep_name = _parse_dep_name(spec)
            if not dep_name or dep_name == pkg_name or dep_name not in watched:
                continue
            if dep_name in seen:
                continue
            seen.add(dep_name)

            # Extract version constraint (between name+extras and env marker)
            constraint = re.sub(r'^[A-Za-z0-9._-]+\s*(?:\[.*?\])?\s*', '', spec)
            constraint = constraint.split(';')[0].strip()

            is_optional = bool(re.search(r';\s*extra\s*==', spec))

            edge_rows.append({
                "ingested_at":                   ingested_at,
                "package_name":                  pkg_name,
                "version":                       version,
                "dependency_name":               dep_name,
                "dependency_version_constraint": constraint,
                "depth_level":                   1,
                "raw_payload":                   json.dumps({"spec": spec}),
            })
            if not is_optional:
                dep_counts[dep_name] = dep_counts.get(dep_name, 0) + 1

    dependent_rows = [
        {
            "ingested_at":     ingested_at,
            "package_name":    pkg,
            "dependent_count": count,
            "raw_payload":     json.dumps({"source": "requires_dist", "count": count}),
        }
        for pkg, count in dep_counts.items()
    ]

    logger.info(
        "edges: %d  packages_with_dependents: %d",
        len(edge_rows), len(dependent_rows),
    )
    return edge_rows, dependent_rows


def _load_bq(rows: list[dict], table_ref: str, label: str) -> None:
    table = client.get_table(table_ref)
    job = client.load_table_from_json(
        rows,
        table_ref,
        job_config=LoadJobConfig(
            write_disposition=WriteDisposition.WRITE_APPEND,
            schema=table.schema,
        ),
    )
    job.result()
    if job.errors:
        raise RuntimeError("BigQuery load failed (%s): %s" % (label, job.errors))
    logger.info("inserted %d rows into %s", len(rows), label)


def main() -> None:
    logger.info("deps_dev_ingest starting — project=%s", PROJECT_ID)
    ingested_at = datetime.now(timezone.utc).isoformat()

    packages = _load_requires_dist()
    edge_rows, dependent_rows = _build_edges_and_counts(packages, ingested_at)

    if edge_rows:
        _load_bq(edge_rows, _EDGES_TABLE, "raw_deps_edges")
    else:
        logger.warning("no edges found — requires_dist may be empty or unparseable")

    if dependent_rows:
        _load_bq(dependent_rows, _DEPENDENTS_TABLE, "raw_deps_dependents")

    logger.info(
        "deps_dev_ingest complete — edges=%d dependents=%d",
        len(edge_rows), len(dependent_rows),
    )


if __name__ == "__main__":
    main()
