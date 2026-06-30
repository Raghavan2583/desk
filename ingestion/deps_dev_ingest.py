"""
ingestion/deps_dev_ingest.py
Derives dependency edges and blast radius counts from requires_dist data
already present in raw_pypi_packages. No external API calls required.

Writes:
  raw_deps_edges       — one row per direct dependency within the top-1000 set
  raw_deps_dependents  — one row per package with its blast radius count
                         (count of top-1000 packages that depend on it)

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/deps_dev_ingest.py
"""
import json
import logging
import re
from datetime import datetime, timezone

from ingestion.db import get_connection, insert_rows

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_PKG_NAME_RE = re.compile(r'^([A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)')


def _normalize(name: str) -> str:
    return re.sub(r'[-_.]+', '-', name).lower()


def _parse_dep_name(spec: str) -> str | None:
    m = _PKG_NAME_RE.match(spec.strip())
    return _normalize(m.group(1)) if m else None


def _load_requires_dist(conn) -> dict[str, tuple[str, list[str]]]:
    """Returns {package_name: (latest_version, [requirement_spec, ...])}."""
    rows = conn.execute("""
        SELECT package_name, latest_version, requires_dist FROM (
            SELECT package_name, latest_version, requires_dist,
                   ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC) AS rn
            FROM desk_raw.raw_pypi_packages
        ) WHERE rn = 1
    """).fetchall()

    result: dict[str, tuple[str, list[str]]] = {}
    for row in rows:
        package_name, version, requires_dist_raw = row
        version = version or ""
        specs: list[str] = []
        if requires_dist_raw:
            try:
                specs = json.loads(requires_dist_raw) or []
            except (json.JSONDecodeError, TypeError):
                pass
        result[package_name] = (version, specs)

    logger.info("loaded requires_dist for %d packages", len(result))
    return result


def _build_edges_and_counts(
    packages: dict[str, tuple[str, list[str]]],
    ingested_at: str,
) -> tuple[list[dict], list[dict]]:
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


def main() -> None:
    logger.info("deps_dev_ingest starting")
    conn = get_connection()

    try:
        ingested_at = datetime.now(timezone.utc).isoformat()
        packages    = _load_requires_dist(conn)
        edge_rows, dependent_rows = _build_edges_and_counts(packages, ingested_at)

        if edge_rows:
            insert_rows(conn, "desk_raw.raw_deps_edges", edge_rows)
            logger.info("inserted %d rows into raw_deps_edges", len(edge_rows))
        else:
            logger.warning("no edges found — requires_dist may be empty or unparseable")

        if dependent_rows:
            insert_rows(conn, "desk_raw.raw_deps_dependents", dependent_rows)
            logger.info("inserted %d rows into raw_deps_dependents", len(dependent_rows))

        logger.info(
            "deps_dev_ingest complete — edges=%d dependents=%d",
            len(edge_rows), len(dependent_rows),
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
