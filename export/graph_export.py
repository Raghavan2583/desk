"""
export/graph_export.py
Reads scored data from DuckDB and writes static JSON files consumed by the frontend.

Outputs (all under OUTPUT_DIR = frontend/public/data/):
  graph.json              — full node/edge graph for React Flow (loaded on first search)
  index.json              — lightweight package list for search autocomplete (loaded on page load)
  package/{name}.json     — per-package detail panel (loaded on node click)

Usage:
    DESK_DB_PATH=data/desk.duckdb RISK_SCORE_VERSION=1 python export/graph_export.py
"""
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pandas as pd

from ingestion.db import DB_PATH, get_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SCORE_VERSION = int(os.environ.get("RISK_SCORE_VERSION", "1"))
OUTPUT_DIR    = Path(os.environ.get("GRAPH_OUTPUT_DIR", "frontend/public/data"))
_HISTORY_DIR  = Path(os.environ.get("DESK_HISTORY_DIR", "data/history"))

HISTORY_PARQUET = _HISTORY_DIR / "fact_risk_score_history.parquet"

# ── Helpers ──────────────────────────────────────────────────────────────── #

def _ts(value) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _df_rows(conn, query: str) -> list[dict]:
    """Execute query and return list of dicts with NaN replaced by None."""
    df = conn.execute(query).df()
    df = df.where(pd.notnull(df), None)
    return df.to_dict(orient="records")

# ── Data loaders ─────────────────────────────────────────────────────────── #

def _load_packages(conn) -> dict[str, dict]:
    rows = _df_rows(conn, """
        SELECT
            p.package_name,
            p.latest_version,
            p.summary,
            p.requires_python,
            p.monthly_downloads,
            p.github_repo_url,
            p.has_github_link,
            r.risk_score,
            r.risk_label,
            r.trend_direction,
            r.component_maintainer,
            r.component_cve,
            r.component_depth,
            r.component_downloads,
            r.blast_radius_count,
            r.score_version,
            m.last_commit_at,
            m.days_since_last_commit,
            m.commit_count_90d,
            m.contributors_count,
            m.is_archived,
            m.activity_label
        FROM desk_prod.fact_risk_scores r
        JOIN desk_prod.dim_packages p ON r.package_name = p.package_name
        LEFT JOIN desk_prod.dim_maintainers m ON p.github_repo_url = m.github_repo_url
    """)
    packages = {row["package_name"]: row for row in rows}
    logger.info("loaded %d scored packages", len(packages))
    return packages


def _load_direct_edges(top_1000: set[str], conn) -> list[dict]:
    rows = _df_rows(conn, """
        SELECT
            package_name AS source,
            dependency_name AS target,
            dependency_version_constraint AS version_constraint
        FROM desk_prod.fact_dependencies
        WHERE is_direct = TRUE
          AND NOT COALESCE(is_optional, FALSE)
    """)
    edges = [r for r in rows if r["source"] in top_1000 and r["target"] in top_1000]
    logger.info("loaded %d direct edges within top-1,000", len(edges))
    return edges


def _load_cves(conn) -> dict[str, list[dict]]:
    rows = _df_rows(conn, """
        SELECT
            package_name,
            osv_id,
            severity,
            cvss_score,
            published_at,
            fixed_in_version
        FROM desk_prod.stg_osv_cves
        ORDER BY package_name, cvss_score DESC NULLS LAST
    """)
    cves: dict[str, list] = {}
    for row in rows:
        cves.setdefault(row["package_name"], []).append({
            "osv_id":           row["osv_id"],
            "severity":         row["severity"],
            "cvss_score":       row["cvss_score"],
            "published_at":     _ts(row["published_at"]),
            "fixed_in_version": row["fixed_in_version"],
        })
    logger.info("loaded CVEs for %d packages", len(cves))
    return cves


def _load_trend_history() -> dict[str, list[dict]]:
    if not HISTORY_PARQUET.exists():
        logger.info("no history parquet yet — trend history empty")
        return {}
    conn_mem = duckdb.connect(":memory:")
    try:
        rows = conn_mem.execute("""
            SELECT package_name, month, risk_score
            FROM (
                SELECT
                    package_name,
                    STRFTIME('%Y-%m', computed_at::TIMESTAMP) AS month,
                    risk_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY package_name,
                                     STRFTIME('%Y-%m', computed_at::TIMESTAMP)
                        ORDER BY computed_at DESC
                    ) AS rn
                FROM read_parquet(?)
                WHERE score_version = ?
                  AND computed_at::DATE >= CURRENT_DATE - INTERVAL '12 months'
            )
            WHERE rn = 1
            ORDER BY package_name, month
        """, [str(HISTORY_PARQUET), SCORE_VERSION]).fetchall()
    finally:
        conn_mem.close()

    history: dict[str, list] = {}
    for row in rows:
        history.setdefault(row[0], []).append({
            "date":       row[1],
            "risk_score": row[2],
        })
    logger.info("loaded trend history for %d packages", len(history))
    return history


def _load_dependency_graph(top_1000: set[str], conn) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    rows = _df_rows(conn, """
        SELECT
            f.package_name,
            f.dependency_name,
            COALESCE(r.blast_radius_count, 0) AS dep_blast_radius
        FROM desk_prod.fact_dependencies f
        LEFT JOIN desk_prod.fact_risk_scores r ON f.package_name = r.package_name
        WHERE f.is_direct = TRUE
          AND NOT COALESCE(f.is_optional, FALSE)
    """)
    direct_deps: dict[str, list[str]]                = {}
    dependents_raw: dict[str, list[tuple[str, int]]] = {}

    for row in rows:
        src = row["package_name"]
        tgt = row["dependency_name"]
        if src in top_1000 and tgt in top_1000:
            direct_deps.setdefault(src, []).append(tgt)
            dependents_raw.setdefault(tgt, []).append((src, row["dep_blast_radius"] or 0))

    direct_dependents = {
        pkg: [dep for dep, _ in sorted(pairs, key=lambda x: x[1], reverse=True)[:10]]
        for pkg, pairs in dependents_raw.items()
    }
    return direct_deps, direct_dependents

# ── JSON builders ─────────────────────────────────────────────────────────── #

def _build_graph_json(
    packages: dict[str, dict],
    edges: list[dict],
    generated_at: str,
    cves: dict[str, list] | None = None,
) -> dict:
    nodes = [
        {
            "id":   pkg["package_name"],
            "type": "package",
            "data": {
                "package_name":       pkg["package_name"],
                "risk_score":         pkg["risk_score"],
                "risk_label":         pkg["risk_label"],
                "trend_direction":    pkg["trend_direction"],
                "blast_radius_count": pkg["blast_radius_count"],
                "monthly_downloads":  pkg["monthly_downloads"],
                "cve_count":          len((cves or {}).get(pkg["package_name"], [])),
            },
            "position": {"x": 0, "y": 0},
        }
        for pkg in packages.values()
    ]
    graph_edges = [
        {
            "id":     f"{e['source']}->{e['target']}",
            "source": e["source"],
            "target": e["target"],
            "data": {
                "depth_level":        1,
                "version_constraint": e["version_constraint"],
            },
        }
        for e in edges
    ]
    return {
        "metadata": {
            "generated_at":  generated_at,
            "package_count": len(nodes),
            "score_version": SCORE_VERSION,
        },
        "nodes": nodes,
        "edges": graph_edges,
    }


def _build_index_json(packages: dict[str, dict], generated_at: str) -> dict:
    entries = sorted(
        [
            {
                "name":               pkg["package_name"],
                "risk_label":         pkg["risk_label"],
                "risk_score":         pkg["risk_score"],
                "blast_radius_count": pkg["blast_radius_count"],
                "trend_direction":    pkg["trend_direction"],
                "monthly_downloads":  pkg["monthly_downloads"],
            }
            for pkg in packages.values()
        ],
        key=lambda x: x["blast_radius_count"],
        reverse=True,
    )
    return {"generated_at": generated_at, "packages": entries}


def _build_package_json(
    pkg: dict,
    cves: list[dict],
    trend_history: list[dict],
    direct_deps: list[str],
    direct_dependents: list[str],
) -> dict:
    maintainer = None
    if pkg["has_github_link"]:
        maintainer = {
            "last_commit_at":         _ts(pkg["last_commit_at"]),
            "days_since_last_commit":  pkg["days_since_last_commit"],
            "commit_count_90d":        pkg["commit_count_90d"],
            "contributors_count":      pkg["contributors_count"],
            "is_archived":             pkg["is_archived"],
            "activity_label":          pkg["activity_label"],
        }
    return {
        "package_name":         pkg["package_name"],
        "latest_version":       pkg["latest_version"],
        "summary":              pkg["summary"],
        "requires_python":      pkg["requires_python"],
        "monthly_downloads":    pkg["monthly_downloads"],
        "github_repo_url":      pkg["github_repo_url"],
        "risk_score":           pkg["risk_score"],
        "risk_label":           pkg["risk_label"],
        "trend_direction":      pkg["trend_direction"],
        "score_version":        pkg["score_version"],
        "components": {
            "maintainer": pkg["component_maintainer"],
            "cve":        pkg["component_cve"],
            "depth":      pkg["component_depth"],
            "downloads":  pkg["component_downloads"],
        },
        "maintainer":           maintainer,
        "cves":                 cves,
        "trend_history":        trend_history,
        "blast_radius_count":   pkg["blast_radius_count"],
        "direct_dependents":    direct_dependents,
        "direct_dependencies":  direct_deps,
    }

# ── File writers ─────────────────────────────────────────────────────────── #

def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, default=str), encoding="utf-8")

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("graph_export starting — version=%d", SCORE_VERSION)
    generated_at = datetime.now(timezone.utc).isoformat()
    conn = get_connection()

    try:
        packages    = _load_packages(conn)
        top_1000    = set(packages.keys())
        edges       = _load_direct_edges(top_1000, conn)
        cves        = _load_cves(conn)
        trend_history  = _load_trend_history()
        direct_deps, direct_dependents = _load_dependency_graph(top_1000, conn)
    finally:
        conn.close()

    # graph.json
    graph_data = _build_graph_json(packages, edges, generated_at, cves=cves)
    _write_json(OUTPUT_DIR / "graph.json", graph_data)
    logger.info("written graph.json — %d nodes %d edges",
                len(graph_data["nodes"]), len(graph_data["edges"]))

    # index.json
    index_data = _build_index_json(packages, generated_at)
    _write_json(OUTPUT_DIR / "index.json", index_data)
    logger.info("written index.json — %d entries", len(index_data["packages"]))

    # package/{name}.json — one file per package
    pkg_dir = OUTPUT_DIR / "package"
    for pkg_name, pkg in packages.items():
        pkg_json = _build_package_json(
            pkg,
            cves=cves.get(pkg_name, []),
            trend_history=trend_history.get(pkg_name, []),
            direct_deps=direct_deps.get(pkg_name, []),
            direct_dependents=direct_dependents.get(pkg_name, []),
        )
        _write_json(pkg_dir / f"{pkg_name}.json", pkg_json)

    logger.info("written %d package JSON files", len(packages))
    logger.info("graph_export complete — output: %s", OUTPUT_DIR)


if __name__ == "__main__":
    main()
