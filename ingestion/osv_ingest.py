"""
ingestion/osv_ingest.py
Fetches CVE/vulnerability data from OSV.dev for all tracked packages.
Writes one row per vulnerability to raw_osv_cves.

Packages with no CVEs produce no rows — absence = no CVEs = cve_component = 0
in the risk scoring formula (ARCH.md Section 4).

Usage:
    GCP_PROJECT_ID=<id> python ingestion/osv_ingest.py
"""
import json
import logging
import os
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

_RAW_TABLE   = f"{PROJECT_ID}.{DATASET_RAW}.raw_osv_cves"
_QUEUE_TABLE = f"{PROJECT_ID}.{DATASET_PROD}.scheduler_queue"

BATCH_SIZE      = 100
OSV_BATCH_URL   = "https://api.osv.dev/v1/querybatch"

OSV_BATCH_SCHEMA = {
    "type": "object",
    "required": ["results"],
    "properties": {
        "results": {"type": "array"},
    },
}

# ── Severity helpers ─────────────────────────────────────────────────────── #

# CVSS v3 base score → severity label (NIST standard thresholds)
_CVSS_THRESHOLDS = [
    (9.0, "CRITICAL"),
    (7.0, "HIGH"),
    (4.0, "MEDIUM"),
    (0.1, "LOW"),
    (0.0, "NONE"),
]


def _parse_severity(vuln: dict) -> tuple[str | None, float | None]:
    """
    Returns (severity_label, cvss_score).
    Label comes from database_specific.severity (present in most GHSA entries).
    Numeric score comes from severity[].score if it is a direct float.
    If only a label is available, score is None. If only a score is available,
    label is derived from CVSS thresholds.
    """
    db_specific = vuln.get("database_specific") or {}
    label: str | None = (db_specific.get("severity") or "").upper() or None

    cvss_score: float | None = None
    for sev in vuln.get("severity") or []:
        raw_score = sev.get("score", "")
        try:
            cvss_score = float(raw_score)
            break
        except (ValueError, TypeError):
            pass  # CVSS vector strings like "CVSS:3.1/AV:N/..." are not floats

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

def _build_rows(package_name: str, vulns: list, ingested_at: str) -> list[dict]:
    rows = []
    for vuln in vulns:
        severity_label, cvss_score = _parse_severity(vuln)
        affected = vuln.get("affected") or []
        rows.append({
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
        })
    return rows

# ── Batch execution ──────────────────────────────────────────────────────── #

def _query_batch(
    batch: list[str],
    session: requests.Session,
) -> list[dict]:
    """POST querybatch for up to BATCH_SIZE packages. Returns raw response JSON."""
    body = {
        "queries": [
            {"package": {"name": p, "ecosystem": "PyPI"}} for p in batch
        ]
    }
    response = retry_with_backoff(
        session.post,
        OSV_BATCH_URL,
        json=body,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    validate_response(data, OSV_BATCH_SCHEMA, source="osv")
    return data["results"]

# ── Queue helpers ─────────────────────────────────────────────────────────── #

def _load_queue() -> list[str]:
    query = f"SELECT package_name FROM `{_QUEUE_TABLE}` ORDER BY package_name"
    return [row.package_name for row in client.query(query).result()]

# ── Main ─────────────────────────────────────────────────────────────────── #

def main() -> None:
    logger.info("osv_ingest starting — project=%s", PROJECT_ID)

    packages    = _load_queue()
    ingested_at = datetime.now(timezone.utc).isoformat()

    mark_running(client, _QUEUE_TABLE, packages)

    rows: list[dict]     = []
    completed: list[str] = []
    no_cve_count         = 0

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
                        completed.append(package_name)
                        continue
                    package_rows = _build_rows(package_name, vulns, ingested_at)
                    rows.extend(package_rows)
                    completed.append(package_name)
                    logger.info("%-40s %d CVE(s)", package_name, len(package_rows))
            except Exception as exc:
                logger.error("batch %d–%d failed: %s", start, start + len(batch) - 1, exc)
                for package_name in batch:
                    mark_error(client, _QUEUE_TABLE, package_name,
                                str(exc), "last_osv_ingest_at")

    if rows:
        job = client.load_table_from_json(
            rows,
            _RAW_TABLE,
            job_config=bigquery.LoadJobConfig(
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
                schema=client.get_table(_RAW_TABLE).schema,
            ),
        )
        job.result()
        if job.errors:
            raise RuntimeError("BigQuery load failed: %s" % job.errors)
        logger.info("inserted %d CVE rows into raw_osv_cves", len(rows))

    mark_complete(client, _QUEUE_TABLE, completed, "last_osv_ingest_at")

    logger.info(
        "osv_ingest complete — cve_rows=%d no_cve=%d errors=%d",
        len(rows), no_cve_count, len(packages) - len(completed),
    )


if __name__ == "__main__":
    main()
