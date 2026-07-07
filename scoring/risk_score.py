"""
scoring/risk_score.py
Computes risk scores for all packages using the weighted formula (SPEC.md Section 4).

Writes to DuckDB:
  desk_prod.fact_risk_scores — current scores, truncated and replaced each run

Appends to Parquet (committed to repo):
  data/history/fact_risk_score_history.parquet — append-only score history
  data/history/download_history.parquet        — append-only download history
  data/history/maintainer_history.parquet      — append-only, one row per package
                                                  per run where GitHub data was
                                                  actually fetched successfully.
                                                  Used to carry forward the last
                                                  known-real maintainer snapshot
                                                  when a run's GitHub fetch fails,
                                                  instead of guessing.

Usage:
    DESK_DB_PATH=data/desk.duckdb RISK_SCORE_VERSION=1 python scoring/risk_score.py
"""
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from ingestion.db import DB_PATH, get_connection, insert_rows

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SCORE_VERSION = int(os.environ.get("RISK_SCORE_VERSION", "1"))
_HISTORY_DIR  = Path(os.environ.get("DESK_HISTORY_DIR", "data/history"))

HISTORY_PARQUET            = _HISTORY_DIR / "fact_risk_score_history.parquet"
DOWNLOAD_HISTORY_PARQUET   = _HISTORY_DIR / "download_history.parquet"
MAINTAINER_HISTORY_PARQUET = _HISTORY_DIR / "maintainer_history.parquet"

# ── Data loading ─────────────────────────────────────────────────────────── #

_MAIN_QUERY = """
SELECT
    p.package_name,
    p.monthly_downloads,
    p.has_github_link,
    p.github_repo_url,
    m.last_commit_at,
    m.days_since_last_commit,
    m.commit_count_90d,
    m.is_archived,
    m.activity_label,
    COALESCE(c.critical_count, 0) AS critical_count,
    COALESCE(c.high_count,     0) AS high_count,
    COALESCE(c.medium_count,   0) AS medium_count,
    COALESCE(c.low_count,      0) AS low_count,
    COALESCE(d.blast_radius_count, 0) AS blast_radius_count
FROM desk_prod.dim_packages p
LEFT JOIN desk_prod.dim_maintainers              m ON p.github_repo_url = m.github_repo_url
LEFT JOIN desk_prod.int_cve_summary_per_package  c ON p.package_name    = c.package_name
LEFT JOIN desk_prod.int_dependency_metrics       d ON p.package_name    = d.package_name
"""


def _load_packages(conn) -> list[dict]:
    import pandas as pd
    df = conn.execute(_MAIN_QUERY).df()
    df = df.where(pd.notnull(df), None)
    rows = df.to_dict(orient="records")
    logger.info("loaded %d packages for scoring", len(rows))
    return rows


def _load_prev_scores() -> dict[str, float]:
    if not HISTORY_PARQUET.exists():
        return {}
    conn_mem = duckdb.connect(":memory:")
    try:
        rows = conn_mem.execute("""
            SELECT package_name, risk_score AS prev_risk_score
            FROM (
                SELECT
                    package_name,
                    risk_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY package_name
                        ORDER BY ABS(DATEDIFF('day', computed_at::DATE,
                                              CURRENT_DATE - INTERVAL '30 days'))
                    ) AS rn
                FROM read_parquet(?)
                WHERE score_version = ?
                  AND computed_at::DATE
                      BETWEEN CURRENT_DATE - INTERVAL '35 days'
                          AND CURRENT_DATE - INTERVAL '25 days'
            )
            WHERE rn = 1
        """, [str(HISTORY_PARQUET), SCORE_VERSION]).fetchall()
    finally:
        conn_mem.close()
    return {row[0]: row[1] for row in rows}


def _load_prev_downloads() -> dict[str, int]:
    if not DOWNLOAD_HISTORY_PARQUET.exists():
        return {}
    conn_mem = duckdb.connect(":memory:")
    try:
        rows = conn_mem.execute("""
            SELECT package_name, monthly_downloads AS prev_monthly_downloads
            FROM (
                SELECT
                    package_name,
                    monthly_downloads,
                    ROW_NUMBER() OVER (
                        PARTITION BY package_name
                        ORDER BY ABS(DATEDIFF('day', recorded_at::DATE,
                                              CURRENT_DATE - INTERVAL '180 days'))
                    ) AS rn
                FROM read_parquet(?)
                WHERE monthly_downloads IS NOT NULL
                  AND recorded_at::DATE
                      BETWEEN CURRENT_DATE - INTERVAL '185 days'
                          AND CURRENT_DATE - INTERVAL '175 days'
            )
            WHERE rn = 1
        """, [str(DOWNLOAD_HISTORY_PARQUET)]).fetchall()
    finally:
        conn_mem.close()
    return {row[0]: row[1] for row in rows}


def _load_latest_downloads() -> dict[str, dict]:
    """Most recent recorded download count per package, regardless of age —
    used to carry forward a real count when this run's fetch for the
    package failed (pypistats.org error, or the downloads job's circuit
    breaker tripped — see ingestion/pypi_downloads_ingest.py, D068),
    instead of guessing a neutral value."""
    if not DOWNLOAD_HISTORY_PARQUET.exists():
        return {}
    conn_mem = duckdb.connect(":memory:")
    try:
        rows = conn_mem.execute("""
            SELECT package_name, monthly_downloads, recorded_at
            FROM (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY package_name ORDER BY recorded_at DESC
                    ) AS rn
                FROM read_parquet(?)
                WHERE monthly_downloads IS NOT NULL
            )
            WHERE rn = 1
        """, [str(DOWNLOAD_HISTORY_PARQUET)]).fetchall()
    finally:
        conn_mem.close()
    return {
        row[0]: {"monthly_downloads": row[1], "recorded_at": row[2]}
        for row in rows
    }


def _load_prev_maintainer() -> dict[str, dict]:
    """Most recent successfully-fetched maintainer snapshot per package,
    regardless of how old — used to carry forward real data when this run's
    GitHub fetch fails, instead of guessing a neutral value."""
    if not MAINTAINER_HISTORY_PARQUET.exists():
        return {}
    conn_mem = duckdb.connect(":memory:")
    try:
        rows = conn_mem.execute("""
            SELECT package_name, last_commit_at, days_since_last_commit,
                   commit_count_90d, is_archived, activity_label, fetched_at
            FROM (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY package_name ORDER BY fetched_at DESC
                    ) AS rn
                FROM read_parquet(?)
            )
            WHERE rn = 1
        """, [str(MAINTAINER_HISTORY_PARQUET)]).fetchall()
    finally:
        conn_mem.close()
    return {
        row[0]: {
            "last_commit_at":         row[1],
            "days_since_last_commit": row[2],
            "commit_count_90d":       row[3],
            "is_archived":            row[4],
            "activity_label":         row[5],
            "fetched_at":             row[6],
        }
        for row in rows
    }


def _version_changed() -> bool:
    if not HISTORY_PARQUET.exists():
        return False
    conn_mem = duckdb.connect(":memory:")
    try:
        result = conn_mem.execute(
            "SELECT MAX(score_version) AS last_version FROM read_parquet(?)",
            [str(HISTORY_PARQUET)],
        ).fetchone()
    finally:
        conn_mem.close()
    if not result or result[0] is None:
        return False
    return int(result[0]) != SCORE_VERSION

# ── Formula components (SPEC.md Section 4) ───────────────────────────────── #

def _maintainer_raw(
    days: int | None,
    is_archived: bool | None,
    commit_count_90d: int | None,
    has_github_link: bool,
) -> float:
    if not has_github_link:
        return 5.0

    if days is None:
        # By the time this is called, _resolve_maintainer() has already
        # substituted a carried-forward snapshot when one exists — so
        # reaching here with days=None means this package has *never* had a
        # successful GitHub fetch. Score neutral rather than worst-case;
        # _score_package() overrides risk_label to DATA_INCOMPLETE for this
        # case so it's never displayed as a confident LOW/MEDIUM/HIGH score.
        return 5.0

    archived = bool(is_archived)
    commits  = commit_count_90d or 0

    if days <= 30:     base = 0.0
    elif days <= 90:   base = 2.0
    elif days <= 180:  base = 4.0
    elif days <= 365:  base = 6.0
    elif days <= 730:  base = 8.0
    else:              base = 10.0

    penalty = 0.0
    if archived:
        penalty += 2.0
    elif commits == 0:
        penalty += 1.0

    return min(10.0, base + penalty)


def _cve_raw(critical: int, high: int, medium: int, low: int) -> float:
    return min(10.0, critical * 3.0 + high * 2.0 + medium * 1.0 + low * 0.5)


def _depth_raw(blast_radius: int) -> float:
    if blast_radius == 0:     return 0.0
    elif blast_radius <= 10:  return 2.0
    elif blast_radius <= 50:  return 4.0
    elif blast_radius <= 100: return 6.0
    elif blast_radius <= 200: return 8.0
    else:                     return 10.0


def _download_raw(current: int | None, prev: int | None) -> float:
    if current is None or prev is None or prev == 0:
        return 5.0
    pct = (current - prev) / prev
    if pct > 0.20:    return 0.0
    elif pct > 0.0:   return 2.0
    elif pct > -0.10: return 4.0
    elif pct > -0.30: return 6.0
    elif pct > -0.50: return 8.0
    else:             return 10.0


def _risk_label(score: float) -> str:
    if score <= 2.9:    return "LOW"
    elif score <= 4.9:  return "MEDIUM"
    elif score <= 7.4:  return "HIGH"
    else:               return "CRITICAL"


def _trend(current: float, prev: float | None, version_changed: bool) -> str:
    if version_changed or prev is None:
        return "STABLE"
    diff = current - prev
    if abs(diff) < 0.5:  return "STABLE"
    return "RISING" if diff >= 0.5 else "FALLING"


def _iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v

# ── Maintainer data resolution ───────────────────────────────────────────── #

def _resolve_maintainer(pkg: dict, prev_maintainer: dict[str, dict], computed_at: str) -> dict:
    """
    Decide which maintainer snapshot to score against, and record honestly
    where it came from. Never silently substitutes a value without recording
    when it was actually last verified true:
      - NO_GITHUB_LINK   — package has no GitHub repo at all (unchanged case).
      - LIVE              — this run's GitHub fetch succeeded.
      - CARRIED_FORWARD  — this run's fetch failed, but we have a real
                            successful fetch from a previous run — use it,
                            tagged with *its* real timestamp, not today's.
      - NEVER_VERIFIED   — this run's fetch failed and we have never once
                            successfully fetched this package. No real data
                            exists to score or carry forward.
    """
    if not pkg["has_github_link"]:
        return {
            "status": "NO_GITHUB_LINK",
            "last_commit_at": None, "days_since_last_commit": None,
            "commit_count_90d": None, "is_archived": None,
            "activity_label": None, "last_verified_at": None,
        }

    if pkg["days_since_last_commit"] is not None:
        return {
            "status": "LIVE",
            "last_commit_at":         _iso(pkg.get("last_commit_at")),
            "days_since_last_commit": pkg["days_since_last_commit"],
            "commit_count_90d":       pkg["commit_count_90d"],
            "is_archived":            pkg["is_archived"],
            "activity_label":         pkg.get("activity_label"),
            "last_verified_at":       computed_at,
        }

    prev = prev_maintainer.get(pkg["package_name"])
    if prev is not None:
        return {
            "status": "CARRIED_FORWARD",
            "last_commit_at":         _iso(prev["last_commit_at"]),
            "days_since_last_commit": prev["days_since_last_commit"],
            "commit_count_90d":       prev["commit_count_90d"],
            "is_archived":            prev["is_archived"],
            "activity_label":         prev["activity_label"],
            "last_verified_at":       _iso(prev["fetched_at"]),
        }

    return {
        "status": "NEVER_VERIFIED",
        "last_commit_at": None, "days_since_last_commit": None,
        "commit_count_90d": None, "is_archived": None,
        "activity_label": None, "last_verified_at": None,
    }


def _resolve_downloads(pkg: dict, latest_downloads: dict[str, dict], computed_at: str) -> dict:
    """
    Same idea as _resolve_maintainer, for monthly download counts: all 1,000
    tracked packages are attempted every run (D064), but an individual
    package's pypistats.org fetch can still fail, or the whole run can trip
    the downloads job's circuit breaker (D068) — either way, that package
    needs to carry forward its last real count rather than being scored on
    a blank.
      - LIVE             — this run's fetch for the package succeeded.
      - CARRIED_FORWARD — this run's fetch failed, but a real prior count
                           exists — use it, tagged with its real date.
      - NEVER_VERIFIED  — no download count has ever been recorded.
    """
    if pkg["monthly_downloads"] is not None:
        return {"status": "LIVE", "monthly_downloads": pkg["monthly_downloads"], "last_verified_at": computed_at}

    latest = latest_downloads.get(pkg["package_name"])
    if latest is not None:
        return {
            "status": "CARRIED_FORWARD",
            "monthly_downloads": latest["monthly_downloads"],
            "last_verified_at":  _iso(latest["recorded_at"]),
        }

    return {"status": "NEVER_VERIFIED", "monthly_downloads": None, "last_verified_at": None}

# ── Score computation ─────────────────────────────────────────────────────── #

def _score_package(
    pkg: dict,
    prev_scores: dict[str, float],
    prev_downloads: dict[str, int],
    prev_maintainer: dict[str, dict],
    latest_downloads: dict[str, dict],
    version_changed: bool,
    computed_at: str,
) -> dict:
    maintainer = _resolve_maintainer(pkg, prev_maintainer, computed_at)
    downloads  = _resolve_downloads(pkg, latest_downloads, computed_at)

    m_raw  = _maintainer_raw(
        maintainer["days_since_last_commit"],
        maintainer["is_archived"],
        maintainer["commit_count_90d"],
        pkg["has_github_link"],
    )
    c_raw  = _cve_raw(
        pkg["critical_count"], pkg["high_count"],
        pkg["medium_count"],   pkg["low_count"],
    )
    d_raw  = _depth_raw(pkg["blast_radius_count"])
    dl_raw = _download_raw(
        downloads["monthly_downloads"],
        prev_downloads.get(pkg["package_name"]),
    )

    m_comp  = round(m_raw  * 0.4, 4)
    c_comp  = round(c_raw  * 0.3, 4)
    d_comp  = round(d_raw  * 0.2, 4)
    dl_comp = round(dl_raw * 0.1, 4)
    score   = round(m_comp + c_comp + d_comp + dl_comp, 1)

    # Never present a package we've genuinely never verified as a confident
    # LOW/MEDIUM/HIGH/CRITICAL — that would look like a real assessment when
    # it's actually a data gap.
    label = "DATA_INCOMPLETE" if maintainer["status"] == "NEVER_VERIFIED" else _risk_label(score)

    return {
        "package_name":         pkg["package_name"],
        "risk_score":           score,
        "risk_label":           label,
        "trend_direction":      _trend(score, prev_scores.get(pkg["package_name"]), version_changed),
        "component_maintainer": m_comp,
        "component_cve":        c_comp,
        "component_depth":      d_comp,
        "component_downloads":  dl_comp,
        "blast_radius_count":   pkg["blast_radius_count"],
        "score_version":        SCORE_VERSION,
        "computed_at":          computed_at,
        "maintainer_status":                 maintainer["status"],
        "maintainer_last_verified_at":       maintainer["last_verified_at"],
        "maintainer_last_commit_at":         maintainer["last_commit_at"],
        "maintainer_days_since_last_commit": maintainer["days_since_last_commit"],
        "maintainer_commit_count_90d":       maintainer["commit_count_90d"],
        "maintainer_is_archived":            maintainer["is_archived"],
        "maintainer_activity_label":         maintainer["activity_label"],
        "downloads_status":                  downloads["status"],
        "downloads_last_verified_at":        downloads["last_verified_at"],
        "downloads_resolved_monthly":        downloads["monthly_downloads"],
    }

# ── DuckDB + Parquet writes ───────────────────────────────────────────────── #

def _write_scores(conn, scored: list[dict]) -> None:
    conn.execute("DELETE FROM desk_prod.fact_risk_scores")
    insert_rows(conn, "desk_prod.fact_risk_scores", scored)
    logger.info("wrote %d rows to fact_risk_scores", len(scored))


def _append_parquet(path: Path, create_sql: str, insert_sql: str, rows: list) -> None:
    if not rows:
        return
    conn_mem = duckdb.connect(":memory:")
    try:
        if path.exists():
            conn_mem.execute(f"CREATE TABLE hist AS SELECT * FROM read_parquet(?)", [str(path)])
        else:
            conn_mem.execute(create_sql)
            path.parent.mkdir(parents=True, exist_ok=True)
        conn_mem.executemany(insert_sql, rows)
        conn_mem.execute(f"COPY hist TO ? (FORMAT PARQUET)", [str(path)])
    finally:
        conn_mem.close()
    logger.info("appended %d rows to %s", len(rows), path.name)


def _append_score_history(scored: list[dict]) -> None:
    _append_parquet(
        HISTORY_PARQUET,
        "CREATE TABLE hist (package_name VARCHAR, risk_score DOUBLE, score_version BIGINT, computed_at VARCHAR)",
        "INSERT INTO hist VALUES (?, ?, ?, ?)",
        [[r["package_name"], r["risk_score"], r["score_version"], r["computed_at"]] for r in scored],
    )


def _append_download_history(packages: list[dict]) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    _append_parquet(
        DOWNLOAD_HISTORY_PARQUET,
        "CREATE TABLE hist (package_name VARCHAR, monthly_downloads BIGINT, recorded_at DATE)",
        "INSERT INTO hist VALUES (?, ?, ?)",
        [[p["package_name"], p["monthly_downloads"], today]
         for p in packages if p["monthly_downloads"] is not None],
    )


def _append_maintainer_history(packages: list[dict], computed_at: str) -> None:
    # Only packages with a real, live fetch this run are "confirmed true" —
    # this is exactly what future runs will carry forward from when their
    # own fetch fails, so only real data ever gets appended here.
    live = [
        p for p in packages
        if p["has_github_link"] and p["days_since_last_commit"] is not None
    ]
    _append_parquet(
        MAINTAINER_HISTORY_PARQUET,
        "CREATE TABLE hist (package_name VARCHAR, last_commit_at VARCHAR, "
        "days_since_last_commit BIGINT, commit_count_90d BIGINT, "
        "is_archived BOOLEAN, activity_label VARCHAR, fetched_at VARCHAR)",
        "INSERT INTO hist VALUES (?, ?, ?, ?, ?, ?, ?)",
        [[p["package_name"], _iso(p.get("last_commit_at")), p["days_since_last_commit"],
          p["commit_count_90d"], p["is_archived"], p.get("activity_label"), computed_at]
         for p in live],
    )

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("risk_score starting — version=%d", SCORE_VERSION)
    conn = get_connection()

    try:
        ver_changed      = _version_changed()
        packages         = _load_packages(conn)
        prev_scores      = _load_prev_scores()
        prev_downloads   = _load_prev_downloads()
        prev_maintainer  = _load_prev_maintainer()
        latest_downloads = _load_latest_downloads()
        computed_at      = datetime.now(timezone.utc).isoformat()

        if ver_changed:
            logger.warning(
                "RISK_SCORE_VERSION changed — all trend_direction values set to STABLE this run"
            )

        scored = [
            _score_package(pkg, prev_scores, prev_downloads, prev_maintainer,
                            latest_downloads, ver_changed, computed_at)
            for pkg in packages
        ]

        label_counts: dict[str, int] = {}
        maintainer_status_counts: dict[str, int] = {}
        downloads_status_counts: dict[str, int] = {}
        for row in scored:
            label_counts[row["risk_label"]] = label_counts.get(row["risk_label"], 0) + 1
            maintainer_status_counts[row["maintainer_status"]] = \
                maintainer_status_counts.get(row["maintainer_status"], 0) + 1
            downloads_status_counts[row["downloads_status"]] = \
                downloads_status_counts.get(row["downloads_status"], 0) + 1
        logger.info("score distribution: %s", label_counts)
        logger.info("maintainer data status: %s", maintainer_status_counts)
        logger.info("downloads data status: %s", downloads_status_counts)

        _write_scores(conn, scored)
        _append_score_history(scored)
        _append_download_history(packages)
        _append_maintainer_history(packages, computed_at)

        logger.info("risk_score complete — %d packages scored", len(scored))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
