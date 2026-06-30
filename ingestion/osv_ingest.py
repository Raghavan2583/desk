"""
ingestion/osv_ingest.py
Fetches CVE/vulnerability data from OSV.dev for all tracked packages.
Writes one row per vulnerability to raw_osv_cves.

Two-phase approach:
  Phase 1 — POST /v1/querybatch: fast, returns {id, modified} only per vuln.
             Collects (package, vuln_id) pairs across all packages.
  Phase 2 — GET /v1/vulns/{id} per unique vuln ID: returns full data including
             severity and CVSS. Deduplicated so shared CVEs are fetched once.
             Rate-limited at 5 req/s with exponential backoff on 429.

Packages with no CVEs produce no rows — cve_component = 0 in risk scoring.

Usage:
    DESK_DB_PATH=data/desk.duckdb python ingestion/osv_ingest.py
"""
import json
import logging
import time
from datetime import datetime, timezone

import requests

from ingestion.db import get_connection, insert_rows
from ingestion.utils.backoff import retry_with_backoff
from ingestion.utils.queue import mark_complete, mark_error, mark_running
from ingestion.utils.validation import validate_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE        = 50
OSV_BATCH_URL     = "https://api.osv.dev/v1/querybatch"
OSV_VULN_BASE_URL = "https://api.osv.dev/v1/vulns"
OSV_REQ_DELAY     = 0.2
OSV_BATCH_DELAY   = 1.0

OSV_BATCH_SCHEMA = {
    "type": "object",
    "required": ["results"],
    "properties": {"results": {"type": "array"}},
}

_SEVERITY_MAP = {
    "CRITICAL": "CRITICAL",
    "HIGH":     "HIGH",
    "MODERATE": "MEDIUM",
    "MEDIUM":   "MEDIUM",
    "LOW":      "LOW",
    "NONE":     "NONE",
}

_CVSS_THRESHOLDS = [
    (9.0, "CRITICAL"),
    (7.0, "HIGH"),
    (4.0, "MEDIUM"),
    (0.1, "LOW"),
    (0.0, "NONE"),
]

# ── Severity helpers ─────────────────────────────────────────────────────── #

def _parse_severity(vuln: dict) -> tuple[str | None, float | None]:
    db_specific = vuln.get("database_specific") or {}
    raw_label   = (db_specific.get("severity") or "").upper()
    label       = _SEVERITY_MAP.get(raw_label)

    cvss_score: float | None = None
    for sev in vuln.get("severity") or []:
        raw_score = sev.get("score", "")
        try:
            cvss_score = float(raw_score)
            break
        except (ValueError, TypeError):
            pass

    if label is None and cvss_score is not None:
        for threshold, derived_label in _CVSS_THRESHOLDS:
            if cvss_score >= threshold:
                label = derived_label
                break

    return label, cvss_score


def _extract_fixed_version(affected: list) -> str | None:
    for entry in affected:
        if (entry.get("package") or {}).get("ecosystem") == "PyPI":
            for r in entry.get("ranges") or []:
                for event in r.get("events") or []:
                    if "fixed" in event:
                        return event["fixed"]
    return None


def _extract_affected_ranges(affected: list) -> list:
    ranges = []
    for entry in affected:
        if (entry.get("package") or {}).get("ecosystem") == "PyPI":
            for r in entry.get("ranges") or []:
                ranges.append({"type": r.get("type"), "events": r.get("events", [])})
    return ranges

# ── Row builder ──────────────────────────────────────────────────────────── #

def _build_row(package_name: str, vuln: dict, ingested_at: str) -> dict:
    severity_label, cvss_score = _parse_severity(vuln)
    affected = vuln.get("affected") or []
    return {
        "ingested_at":       ingested_at,
        "package_name":      package_name,
        "osv_id":            vuln["id"],
        "severity":          severity_label,
        "cvss_score":        cvss_score,
        "published_at":      vuln.get("published"),
        "modified_at":       vuln.get("modified"),
        "is_withdrawn":      "withdrawn" in vuln,
        "aliases":           json.dumps(vuln.get("aliases") or []),
        "affected_versions": json.dumps(_extract_affected_ranges(affected)),
        "fixed_in_version":  _extract_fixed_version(affected),
        "raw_payload":       json.dumps(vuln),
    }

# ── Phase 1: querybatch ───────────────────────────────────────────────────── #

def _query_batch(batch: list[str], session: requests.Session) -> list[dict]:
    body = {"queries": [{"package": {"name": p, "ecosystem": "PyPI"}} for p in batch]}
    response = retry_with_backoff(session.post, OSV_BATCH_URL, json=body, timeout=(5, 10), max_retries=3)
    response.raise_for_status()
    data = response.json()
    validate_response(data, OSV_BATCH_SCHEMA, source="osv")
    return data["results"]

# ── Phase 2: individual vuln detail fetch ─────────────────────────────────── #

def _fetch_vuln_details(
    vuln_ids: list[str],
    session: requests.Session,
) -> dict[str, dict]:
    cache: dict[str, dict] = {}
    total = len(vuln_ids)
    logger.info("fetching full data for %d unique CVE IDs", total)

    for i, vuln_id in enumerate(vuln_ids):
        if i % 50 == 0:
            logger.info("vuln details: %d/%d", i, total)
        try:
            resp = retry_with_backoff(
                session.get,
                f"{OSV_VULN_BASE_URL}/{vuln_id}",
                timeout=15,
            )
            resp.raise_for_status()
            cache[vuln_id] = resp.json()
        except Exception as exc:
            logger.warning("failed to fetch vuln %s: %s", vuln_id, exc)
        time.sleep(OSV_REQ_DELAY)

    logger.info("fetched %d/%d vuln details successfully", len(cache), total)
    return cache

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("osv_ingest starting")
    conn = get_connection()

    try:
        packages    = [
            row[0]
            for row in conn.execute(
                "SELECT package_name FROM desk_prod.scheduler_queue ORDER BY package_name"
            ).fetchall()
        ]
        ingested_at = datetime.now(timezone.utc).isoformat()

        mark_running(conn, packages)

        pkg_vuln_pairs: list[tuple[str, str]] = []
        completed: list[str] = []
        no_cve_count = 0

        with requests.Session() as session:
            for start in range(0, len(packages), BATCH_SIZE):
                batch = packages[start:start + BATCH_SIZE]
                try:
                    results = _query_batch(batch, session)
                    if len(results) != len(batch):
                        raise RuntimeError(
                            "OSV results count mismatch: expected %d got %d"
                            % (len(batch), len(results))
                        )
                    for package_name, result in zip(batch, results):
                        vulns = result.get("vulns") or []
                        if not vulns:
                            no_cve_count += 1
                        else:
                            for v in vulns:
                                pkg_vuln_pairs.append((package_name, v["id"]))
                        completed.append(package_name)
                except Exception as exc:
                    logger.error("querybatch %d–%d failed: %s", start, start + len(batch) - 1, exc)
                    for package_name in batch:
                        mark_error(conn, package_name, str(exc), "last_osv_ingest_at")
                time.sleep(OSV_BATCH_DELAY)

            logger.info(
                "phase 1 complete — packages=%d no_cve=%d vuln_refs=%d",
                len(packages), no_cve_count, len(pkg_vuln_pairs),
            )

            unique_ids   = list({vid for _, vid in pkg_vuln_pairs})
            vuln_details = _fetch_vuln_details(unique_ids, session)

        rows: list[dict] = []
        for package_name, vuln_id in pkg_vuln_pairs:
            full = vuln_details.get(vuln_id)
            if full:
                rows.append(_build_row(package_name, full, ingested_at))

        if rows:
            insert_rows(conn, "desk_raw.raw_osv_cves", rows)
            logger.info("inserted %d CVE rows into raw_osv_cves", len(rows))

        mark_complete(conn, completed, "last_osv_ingest_at")

        logger.info(
            "osv_ingest complete — cve_rows=%d unique_cves=%d no_cve=%d errors=%d",
            len(rows), len(unique_ids), no_cve_count,
            len(packages) - len(completed),
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
