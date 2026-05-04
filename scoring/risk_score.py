"""
scoring/risk_score.py
Computes risk scores for all packages using the weighted formula (ARCH.md Section 4).

Writes:
  fact_risk_scores        — WRITE_TRUNCATE (current scores, overwritten each run)
  fact_risk_score_history — WRITE_APPEND   (append-only, never deleted)

Design note: ARCH.md Section 4 references fact_risk_score_history for prev_monthly_downloads.
That table does not store monthly_downloads (its schema mirrors fact_risk_scores).
prev_monthly is therefore read from raw_pypi_packages ~180 days ago, which holds the data
because it is append-only partitioned storage.

Usage:
    GCP_PROJECT_ID=<id> RISK_SCORE_VERSION=1 python scoring/risk_score.py
"""
import logging
import os
from datetime import datetime, timezone

from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID    = os.environ["GCP_PROJECT_ID"]
DATASET_PROD  = os.environ.get("GCP_DATASET_PROD",  "desk_prod")
DATASET_RAW   = os.environ.get("GCP_DATASET_RAW",   "desk_raw")
SCORE_VERSION = int(os.environ.get("RISK_SCORE_VERSION", "1"))

client = bigquery.Client(project=PROJECT_ID)

_DIM_PACKAGES    = f"{PROJECT_ID}.{DATASET_PROD}.dim_packages"
_DIM_MAINTAINERS = f"{PROJECT_ID}.{DATASET_PROD}.dim_maintainers"
_INT_CVE         = f"{PROJECT_ID}.{DATASET_PROD}.int_cve_summary_per_package"
_INT_DEPS        = f"{PROJECT_ID}.{DATASET_PROD}.int_dependency_metrics"
_RAW_PYPI        = f"{PROJECT_ID}.{DATASET_RAW}.raw_pypi_packages"
_FACT_SCORES     = f"{PROJECT_ID}.{DATASET_PROD}.fact_risk_scores"
_FACT_HISTORY    = f"{PROJECT_ID}.{DATASET_PROD}.fact_risk_score_history"

# ── Data loading ─────────────────────────────────────────────────────────── #

_MAIN_QUERY = """
SELECT
    p.package_name,
    p.monthly_downloads,
    p.has_github_link,
    p.github_repo_url,
    m.days_since_last_commit,
    m.commit_count_90d,
    m.is_archived,
    COALESCE(c.critical_count, 0) AS critical_count,
    COALESCE(c.high_count,     0) AS high_count,
    COALESCE(c.medium_count,   0) AS medium_count,
    COALESCE(c.low_count,      0) AS low_count,
    COALESCE(d.blast_radius_count, 0) AS blast_radius_count
FROM `{dim_packages}` p
LEFT JOIN `{dim_maintainers}` m ON p.github_repo_url = m.github_repo_url
LEFT JOIN `{int_cve}`          c ON p.package_name    = c.package_name
LEFT JOIN `{int_deps}`         d ON p.package_name    = d.package_name
"""

_PREV_SCORES_QUERY = """
SELECT package_name, risk_score AS prev_risk_score
FROM (
    SELECT
        package_name,
        risk_score,
        ROW_NUMBER() OVER (
            PARTITION BY package_name
            ORDER BY ABS(DATE_DIFF(DATE(computed_at),
                                   DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), DAY))
        ) AS rn
    FROM `{history}`
    WHERE score_version = @score_version
      AND DATE(computed_at)
          BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY)
              AND DATE_SUB(CURRENT_DATE(), INTERVAL 25 DAY)
)
WHERE rn = 1
"""

_PREV_DOWNLOADS_QUERY = """
SELECT package_name, monthly_downloads AS prev_monthly_downloads
FROM (
    SELECT
        package_name,
        monthly_downloads,
        ROW_NUMBER() OVER (
            PARTITION BY package_name
            ORDER BY ABS(DATE_DIFF(DATE(ingested_at),
                                   DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY), DAY))
        ) AS rn
    FROM `{raw_pypi}`
    WHERE monthly_downloads IS NOT NULL
      AND DATE(ingested_at)
          BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 185 DAY)
              AND DATE_SUB(CURRENT_DATE(), INTERVAL 175 DAY)
)
WHERE rn = 1
"""

_LAST_VERSION_QUERY = "SELECT MAX(score_version) AS last_version FROM `{history}`"


def _load_packages() -> list[dict]:
    query = _MAIN_QUERY.format(
        dim_packages=_DIM_PACKAGES,
        dim_maintainers=_DIM_MAINTAINERS,
        int_cve=_INT_CVE,
        int_deps=_INT_DEPS,
    )
    rows = [dict(row) for row in client.query(query).result()]
    logger.info("loaded %d packages for scoring", len(rows))
    return rows


def _load_prev_scores() -> dict[str, float]:
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("score_version", "INT64", SCORE_VERSION)
        ]
    )
    query = _PREV_SCORES_QUERY.format(history=_FACT_HISTORY)
    return {
        row.package_name: row.prev_risk_score
        for row in client.query(query, job_config=job_config).result()
    }


def _load_prev_downloads() -> dict[str, int]:
    query = _PREV_DOWNLOADS_QUERY.format(raw_pypi=_RAW_PYPI)
    return {
        row.package_name: row.prev_monthly_downloads
        for row in client.query(query).result()
    }


def _version_changed() -> bool:
    """True if RISK_SCORE_VERSION differs from the latest version in history."""
    query = _LAST_VERSION_QUERY.format(history=_FACT_HISTORY)
    result = list(client.query(query).result())
    if not result or result[0].last_version is None:
        return False  # first run — no version change
    return int(result[0].last_version) != SCORE_VERSION

# ── Formula components (ARCH.md Section 4) ───────────────────────────────── #

def _maintainer_raw(
    days: int | None,
    is_archived: bool | None,
    commit_count_90d: int | None,
    has_github_link: bool,
) -> float:
    if not has_github_link:
        return 5.0  # no GitHub URL — neutral unknown

    archived = bool(is_archived)
    commits  = commit_count_90d or 0

    if days is None:
        base = 10.0  # no commit history — treat as worst case
    elif days <= 30:   base = 0.0
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
    if blast_radius == 0:    return 0.0
    elif blast_radius <= 10: return 2.0
    elif blast_radius <= 50: return 4.0
    elif blast_radius <= 100: return 6.0
    elif blast_radius <= 200: return 8.0
    else:                    return 10.0


def _download_raw(current: int | None, prev: int | None) -> float:
    if current is None or prev is None or prev == 0:
        return 5.0  # no history or divide-by-zero — neutral
    pct = (current - prev) / prev
    if pct > 0.20:   return 0.0
    elif pct > 0.0:  return 2.0
    elif pct > -0.10: return 4.0
    elif pct > -0.30: return 6.0
    elif pct > -0.50: return 8.0
    else:             return 10.0


def _risk_label(score: float) -> str:
    if score <= 2.9:  return "LOW"
    elif score <= 4.9: return "MEDIUM"
    elif score <= 7.4: return "HIGH"
    else:              return "CRITICAL"


def _trend(current: float, prev: float | None, version_changed: bool) -> str:
    if version_changed or prev is None:
        return "STABLE"
    diff = current - prev
    if abs(diff) < 0.5:  return "STABLE"
    return "RISING" if diff >= 0.5 else "FALLING"

# ── Score computation ─────────────────────────────────────────────────────── #

def _score_package(
    pkg: dict,
    prev_scores: dict[str, float],
    prev_downloads: dict[str, int],
    version_changed: bool,
    computed_at: str,
) -> dict:
    m_raw  = _maintainer_raw(
        pkg["days_since_last_commit"],
        pkg["is_archived"],
        pkg["commit_count_90d"],
        pkg["has_github_link"],
    )
    c_raw  = _cve_raw(
        pkg["critical_count"], pkg["high_count"],
        pkg["medium_count"],   pkg["low_count"],
    )
    d_raw  = _depth_raw(pkg["blast_radius_count"])
    dl_raw = _download_raw(
        pkg["monthly_downloads"],
        prev_downloads.get(pkg["package_name"]),
    )

    m_comp  = round(m_raw  * 0.4, 4)
    c_comp  = round(c_raw  * 0.3, 4)
    d_comp  = round(d_raw  * 0.2, 4)
    dl_comp = round(dl_raw * 0.1, 4)

    score = round(m_comp + c_comp + d_comp + dl_comp, 1)

    return {
        "package_name":        pkg["package_name"],
        "risk_score":          score,
        "risk_label":          _risk_label(score),
        "trend_direction":     _trend(score, prev_scores.get(pkg["package_name"]),
                                      version_changed),
        "component_maintainer": m_comp,
        "component_cve":        c_comp,
        "component_depth":      d_comp,
        "component_downloads":  dl_comp,
        "blast_radius_count":  pkg["blast_radius_count"],
        "score_version":        SCORE_VERSION,
        "computed_at":          computed_at,
    }

# ── BigQuery writes ───────────────────────────────────────────────────────── #

def _write(rows: list[dict], table_ref: str, disposition: str) -> None:
    table      = client.get_table(table_ref)
    job_config = bigquery.LoadJobConfig(
        write_disposition=disposition,
        schema=table.schema,
    )
    job = client.load_table_from_json(rows, table_ref, job_config=job_config)
    job.result()
    logger.info("wrote %d rows to %s (%s)", len(rows), table_ref.split(".")[-1], disposition)

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("risk_score starting — version=%d project=%s", SCORE_VERSION, PROJECT_ID)

    ver_changed    = _version_changed()
    packages       = _load_packages()
    prev_scores    = _load_prev_scores()
    prev_downloads = _load_prev_downloads()
    computed_at    = datetime.now(timezone.utc).isoformat()

    if ver_changed:
        logger.warning(
            "RISK_SCORE_VERSION changed — all trend_direction values set to STABLE this run"
        )

    scored = [
        _score_package(pkg, prev_scores, prev_downloads, ver_changed, computed_at)
        for pkg in packages
    ]

    label_counts = {}
    for row in scored:
        label_counts[row["risk_label"]] = label_counts.get(row["risk_label"], 0) + 1
    logger.info("score distribution: %s", label_counts)

    _write(scored, _FACT_SCORES,   bigquery.WriteDisposition.WRITE_TRUNCATE)
    _write(scored, _FACT_HISTORY,  bigquery.WriteDisposition.WRITE_APPEND)

    logger.info("risk_score complete — %d packages scored", len(scored))


if __name__ == "__main__":
    main()
