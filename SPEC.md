# DESK — Architecture Design
# Owner: Blueprint. Read by: Striker, Guardian, Operator.
# Rule: This file is the single source of truth for all technical design decisions.
#        Striker reads this before writing a single line of code. No questions after handoff.

---

## 1. DATA MODEL

### Raw Layer — desk_raw (append-only, partitioned by ingested_at DAY)

**raw_pypi_packages**
| Column | Type | Notes |
|---|---|---|
| ingested_at | TIMESTAMP | Partition key |
| package_name | STRING | Normalized lowercase |
| latest_version | STRING | |
| summary | STRING | |
| author | STRING | |
| author_email | STRING | |
| requires_python | STRING | |
| requires_dist | JSON | Raw install_requires array |
| project_urls | JSON | Full project_urls dict from PyPI |
| monthly_downloads | INT64 | From pypistats.org recent endpoint |
| github_repo_url | STRING | Extracted — NULL if not found |
| raw_payload | STRING | Full JSON response for re-processing |

Cluster by: package_name

**raw_github_maintainers**
| Column | Type | Notes |
|---|---|---|
| ingested_at | TIMESTAMP | Partition key |
| package_name | STRING | The PyPI package this maps to |
| github_repo_url | STRING | |
| repo_owner | STRING | |
| repo_name | STRING | |
| last_commit_at | TIMESTAMP | From defaultBranchRef.target.committedDate |
| commit_count_90d | INT64 | From history(since: 90_days_ago).totalCount |
| open_issues_count | INT64 | |
| stars_count | INT64 | |
| forks_count | INT64 | |
| contributors_count | INT64 | From mentionableUsers.totalCount |
| is_archived | BOOL | |
| is_fork | BOOL | |
| primary_language | STRING | |
| license_spdx | STRING | |
| created_at | TIMESTAMP | |
| raw_payload | STRING | Full GraphQL response fragment |

Cluster by: package_name

**raw_osv_cves**
| Column | Type | Notes |
|---|---|---|
| ingested_at | TIMESTAMP | Partition key |
| package_name | STRING | |
| osv_id | STRING | e.g. GHSA-xxxx or CVE-xxxx |
| severity | STRING | CRITICAL / HIGH / MEDIUM / LOW / NONE |
| cvss_score | FLOAT64 | |
| published_at | TIMESTAMP | |
| modified_at | TIMESTAMP | |
| is_withdrawn | BOOL | |
| aliases | JSON | Array of CVE alias IDs |
| affected_versions | JSON | Affected version ranges |
| fixed_in_version | STRING | NULL if unpatched |
| raw_payload | STRING | |

Cluster by: package_name

**raw_deps_edges**
| Column | Type | Notes |
|---|---|---|
| ingested_at | TIMESTAMP | Partition key |
| package_name | STRING | Package whose deps we fetched |
| version | STRING | Version queried against |
| dependency_name | STRING | |
| dependency_version_constraint | STRING | e.g. ">=1.21.0" |
| depth_level | INT64 | 1 = direct, 2+ = transitive |
| raw_payload | STRING | |

Cluster by: package_name

**raw_deps_dependents**
| Column | Type | Notes |
|---|---|---|
| ingested_at | TIMESTAMP | Partition key |
| package_name | STRING | |
| dependent_count | INT64 | Global count from deps.dev (not top-1000 scoped) |
| raw_payload | STRING | |

---

### Production Layer — desk_prod

**scheduler_queue**
| Column | Type | Notes |
|---|---|---|
| package_name | STRING | PK |
| priority | INT64 | MVP: all = 1. Skeleton for post-MVP. |
| last_pypi_ingest_at | TIMESTAMP | |
| last_github_ingest_at | TIMESTAMP | |
| last_osv_ingest_at | TIMESTAMP | |
| last_deps_ingest_at | TIMESTAMP | |
| next_github_check_at | TIMESTAMP | |
| status | STRING | pending / running / complete / error |
| retry_count | INT64 | |
| last_error | STRING | NULL if no error |

### scheduler_queue — State Machine

| Status | Meaning |
|---|---|
| pending | Queued, not yet processed this cycle |
| running | Ingestion script has claimed this package (in-flight) |
| complete | All four sources ingested successfully this cycle |
| error | Last run failed — last_error populated, retry_count incremented |

Transition rules:
- bootstrap.py inserts with status = 'pending', retry_count = 0
- Each ingestion script sets status = 'running' before starting a package
- On success: status = 'complete', last_error = NULL
- On failure: status = 'error', last_error = <message>, retry_count += 1
- Eligible for re-ingestion: status IN ('pending', 'complete', 'error')

**dim_packages**
| Column | Type | Notes |
|---|---|---|
| package_name | STRING | PK |
| latest_version | STRING | |
| summary | STRING | |
| requires_python | STRING | |
| monthly_downloads | INT64 | |
| github_repo_url | STRING | NULL if no GitHub link |
| author | STRING | |
| author_email | STRING | |
| has_github_link | BOOL | Computed: github_repo_url IS NOT NULL |
| is_top_1000 | BOOL | |
| first_seen_at | TIMESTAMP | |
| last_updated_at | TIMESTAMP | |

**dim_maintainers**
| Column | Type | Notes |
|---|---|---|
| github_repo_url | STRING | PK |
| repo_owner | STRING | |
| repo_name | STRING | |
| last_commit_at | TIMESTAMP | |
| days_since_last_commit | INT64 | Computed in dbt |
| commit_count_90d | INT64 | |
| open_issues_count | INT64 | |
| stars_count | INT64 | |
| contributors_count | INT64 | |
| is_archived | BOOL | |
| is_fork | BOOL | |
| activity_label | STRING | ACTIVE / SLOW / STALE / ABANDONED |
| last_updated_at | TIMESTAMP | |

Activity label thresholds (CASE logic in stg_github_maintainers):
- ACTIVE: days_since_last_commit <= 30 AND is_archived = FALSE
- SLOW: 31–90 days AND is_archived = FALSE
- STALE: 91–365 days AND is_archived = FALSE
- ABANDONED: 365+ days OR is_archived = TRUE

**fact_dependencies**
| Column | Type | Notes |
|---|---|---|
| package_name | STRING | |
| dependency_name | STRING | |
| version_constraint | STRING | |
| depth_level | INT64 | |
| is_direct | BOOL | depth_level = 1 |
| ingested_at | TIMESTAMP | |

**fact_risk_scores** (current — overwritten each scoring run)
| Column | Type | Notes |
|---|---|---|
| package_name | STRING | PK |
| risk_score | FLOAT64 | 0.0–10.0, rounded to 1 dp |
| risk_label | STRING | CRITICAL / HIGH / MEDIUM / LOW |
| trend_direction | STRING | RISING / FALLING / STABLE |
| component_maintainer | FLOAT64 | Weighted contribution (0–4.0) |
| component_cve | FLOAT64 | Weighted contribution (0–3.0) |
| component_depth | FLOAT64 | Weighted contribution (0–2.0) |
| component_downloads | FLOAT64 | Weighted contribution (0–1.0) |
| blast_radius_count | INT64 | From raw_deps_dependents |
| score_version | INT64 | From RISK_SCORE_VERSION env var |
| computed_at | TIMESTAMP | |

**fact_risk_score_history** — identical columns to fact_risk_scores.
Written by risk_score.py only. Append-only — NEVER update, only INSERT.
This is the source of trend arrows and the 12-month sparkline.

---

## 2. INGESTION PIPELINE ARCHITECTURE

### Bootstrap (run once, then monthly)
Get the initial top-1,000 package list from the public PyPI BigQuery dataset:
```sql
SELECT file.project AS package_name, COUNT(*) AS downloads
FROM `bigquery-public-data.pypi.file_downloads`
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND file.project IS NOT NULL AND file.project != ''
GROUP BY package_name ORDER BY downloads DESC LIMIT 1000
```
Seeds `scheduler_queue` with priority=1 for all 1,000 packages.
Script: `ingestion/bootstrap.py`

### pypi_ingest.py
- API: `https://pypi.org/pypi/{package}/json` (REST, no auth)
- Download stats: `https://pypistats.org/api/packages/{package}/recent` → use `last_month`
- GitHub URL extraction order:
  1. Scan `project_urls` values for `github.com/` — check keys: Source, Repository, Code, GitHub, Homepage
  2. Fallback: check `home_page` field
  3. Normalize: strip `.git` suffix, trailing slashes, extract `owner/repo`
  4. If not found: github_repo_url = NULL
- Writes to: `raw_pypi_packages`

### github_ingest.py
- API: GitHub GraphQL `https://api.github.com/graphql`
- Auth: `Authorization: Bearer {GITHUB_TOKENS[0]}`
- Batch size: 50 repos per query (alias-based batching)
- GraphQL fields per repo: pushedAt, defaultBranchRef.target.history(since:90d).totalCount,
  issues(states:OPEN).totalCount, stargazerCount, forkCount, isArchived, isFork,
  primaryLanguage.name, licenseInfo.spdxId, createdAt, mentionableUsers.totalCount
- Rate limiting: check `X-RateLimit-Remaining` after each call. If < 100, sleep until `X-RateLimit-Reset`
- Packages with github_repo_url = NULL: skip entirely. No row written.
- Writes to: `raw_github_maintainers`

### osv_ingest.py
- API: `https://api.osv.dev/v1/querybatch` (POST, no auth)
- Batch size: 100 packages per request
- Body: `{"queries": [{"package": {"name": "p", "ecosystem": "PyPI"}}, ...]}`
- Empty response (no CVEs): write nothing — absence of rows = no CVEs = cve_component = 0
- Writes to: `raw_osv_cves`

### deps_dev_ingest.py
- API 1 (edges): `GET https://api.deps.dev/v3alpha/systems/PYPI/packages/{name}/versions/{version}/dependencies`
- API 2 (dependents): `GET https://api.deps.dev/v3alpha/systems/PYPI/packages/{name}`
  → extract `defaultVersion.dependentCount` from response
- No auth. Exponential backoff on 429. Sequential per package.
- Writes to: `raw_deps_edges` + `raw_deps_dependents`

### Pipeline Data Flow
```
PyPI JSON API ──────────► raw_pypi_packages ──────────┐
GitHub GraphQL API ──────► raw_github_maintainers       │
OSV.dev batch API ───────► raw_osv_cves                 │
deps.dev REST API ───────► raw_deps_edges               │
                  └──────► raw_deps_dependents          │
                                                        ▼
                                                   dbt build
                                                        │
                           ┌────────────────────────────┤
                           ▼                            ▼
                      staging models            intermediate models
                      (clean + type)            (entity resolve)
                           │                            │
                           └────────────┬───────────────┘
                                        ▼
                               mart models (dim/fact)
                                        │
                               risk_score.py
                                        │
                         ┌─────────────┼─────────────┐
                         ▼             ▼              ▼
              fact_risk_scores  fact_risk_score_history
                                        │
                               graph_export.py
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
               graph.json          index.json     package/{name}.json
                                        │
                                   Vercel (React)
```

---

## 3. DBT MODEL STRUCTURE

### Staging (`dbt/models/staging/`) — clean, deduplicate, type-cast

**stg_pypi_packages.sql**
- Source: raw_pypi_packages
- Dedup: ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC) = 1
- Output: package_name, latest_version, summary, author, author_email,
  requires_python, monthly_downloads, github_repo_url, requires_dist

**stg_github_maintainers.sql**
- Source: raw_github_maintainers
- Dedup: latest ingested_at per github_repo_url
- Computed: `days_since_last_commit = DATE_DIFF(CURRENT_DATE(), DATE(last_commit_at), DAY)`
- Computed: `activity_label` via CASE on days_since_last_commit and is_archived

**stg_osv_cves.sql**
- Source: raw_osv_cves
- Filter: WHERE is_withdrawn = FALSE
- Dedup: latest ingested_at per (package_name, osv_id)

**stg_deps_dependencies.sql**
- Source: raw_deps_edges
- Dedup: latest ingested_at per (package_name, dependency_name, depth_level)
- Computed: `is_direct = (depth_level = 1)`

**stg_deps_dependents.sql**
- Source: raw_deps_dependents
- Dedup: latest ingested_at per package_name

### Intermediate (`dbt/models/intermediate/`) — entity resolution

**int_packages_resolved.sql**
- LEFT JOIN stg_pypi_packages + stg_github_maintainers ON github_repo_url
- Adds: has_github_link = (github_repo_url IS NOT NULL)
- One row per package

**int_cve_summary_per_package.sql**
- Aggregates stg_osv_cves grouped by package_name
- Columns: critical_count, high_count, medium_count, low_count, total_cve_count
- Packages not in raw_osv_cves → LEFT JOIN gives all counts = 0

**int_dependency_metrics.sql**
- Aggregates stg_deps_dependencies by package_name
- Columns: max_depth, direct_dep_count
- LEFT JOINs stg_deps_dependents to add blast_radius_count

### Marts (`dbt/models/marts/`) — final dimensional tables

**dim_packages.sql** → from int_packages_resolved
**dim_maintainers.sql** → from stg_github_maintainers
**fact_dependencies.sql** → from stg_deps_dependencies

Note: `fact_risk_scores` and `fact_risk_score_history` are NOT built by dbt.
They are written by risk_score.py. dbt only runs `dbt test` against them after the write.

### Schema tests (`dbt/tests/schema.yml`) — minimum required
- dim_packages.package_name: not_null, unique
- dim_maintainers.github_repo_url: not_null, unique
- fact_dependencies.package_name: not_null
- fact_risk_scores.package_name: not_null, unique
- fact_risk_scores.risk_score: not_null (accepted_values: numeric 0.0–10.0)

---

## 4. RISK SCORING FORMULA

Script: `scoring/risk_score.py`
Reads from BigQuery: dim_packages JOIN dim_maintainers JOIN int_cve_summary_per_package JOIN int_dependency_metrics

### Component A — Maintainer (weight 0.4, max contribution 4.0)
```
base_score:
  days <= 30:    0.0
  31–90:         2.0
  91–180:        4.0
  181–365:       6.0
  366–730:       8.0
  730+:          10.0

penalties (additive, cap at 10.0):
  is_archived = TRUE:              +2.0
  commit_count_90d = 0
  AND NOT is_archived:             +1.0

EDGE CASE — no GitHub URL:   raw = 5.0 (neutral, unknown)
EDGE CASE — package archived: raw = min(10.0, base + 2.0)

maintainer_component = min(10.0, raw) * 0.4
```

### Component B — CVE (weight 0.3, max contribution 3.0)
```
raw = min(10.0, critical*3.0 + high*2.0 + medium*1.0 + low*0.5)

EDGE CASE — no CVEs in OSV response: raw = 0.0 (healthy, not neutral)

cve_component = raw * 0.3
```

### Component C — Depth / Blast Radius (weight 0.2, max contribution 2.0)
```
blast_radius_count buckets:
  0:           0.0
  1–10:        2.0
  11–50:       4.0
  51–100:      6.0
  101–200:     8.0
  200+:        10.0

EDGE CASE — 0 dependents: raw = 0.0 (safest for this component)

depth_component = raw * 0.2
```

### Component D — Download Trend (weight 0.1, max contribution 1.0)
```
pct_change = (current_monthly - prev_monthly) / prev_monthly

> +20%:          0.0  (growing — healthy)
0% to +20%:      2.0
-10% to 0%:      4.0
-30% to -10%:    6.0
-50% to -30%:    8.0
< -50%:          10.0

EDGE CASE — no history (first run or new package): raw = 5.0 (neutral)
EDGE CASE — prev_monthly = 0: raw = 5.0 (avoid divide-by-zero)

prev_monthly = value from fact_risk_score_history ~180 days ago, same score_version

download_component = raw * 0.1
```

### Final Score
```
risk_score = round(maintainer_component + cve_component + depth_component + download_component, 1)

risk_label:
  0.0–2.9:   LOW
  3.0–4.9:   MEDIUM
  5.0–7.4:   HIGH
  7.5–10.0:  CRITICAL
```

### Trend Direction
```
prev_score = risk_score from fact_risk_score_history 30 days ago, same score_version
If no prev_score: STABLE
If |risk_score - prev_score| < 0.5: STABLE
If risk_score - prev_score >= 0.5: RISING
If risk_score - prev_score <= -0.5: FALLING

CRITICAL: NEVER compare scores across different RISK_SCORE_VERSIONs.
If version changed since last run: trend = STABLE for all packages this run.
```

### Edge Cases Summary
| Situation | Handling |
|---|---|
| No GitHub URL | maintainer raw = 5.0 (neutral) |
| Package archived | +2.0 penalty on maintainer raw |
| 0 CVEs in OSV | cve_component = 0.0 |
| 0 dependents | depth_component = 0.0 |
| No download history | download raw = 5.0 (neutral) |
| RISK_SCORE_VERSION changed | trend = STABLE, all packages |
| commit_count_90d = 0, not archived | +1.0 penalty on maintainer raw |
| prev_monthly_downloads = 0 | download raw = 5.0 |

---

## 5. API CONTRACT — FRONTEND JSON FILES

Produced by: `export/graph_export.py`
Written to: `frontend/public/data/`

### graph.json — full graph, loaded on first search
```json
{
  "metadata": {
    "generated_at": "<ISO8601>",
    "package_count": 1000,
    "score_version": 1
  },
  "nodes": [
    {
      "id": "numpy",
      "type": "package",
      "data": {
        "package_name": "numpy",
        "risk_score": 2.4,
        "risk_label": "LOW",
        "trend_direction": "STABLE",
        "blast_radius_count": 312,
        "monthly_downloads": 54000000
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "pandas->numpy",
      "source": "pandas",
      "target": "numpy",
      "data": {
        "depth_level": 1,
        "version_constraint": ">=1.21.0"
      }
    }
  ]
}
```

Rules:
- position always `{ "x": 0, "y": 0 }` — React Flow computes layout client-side (dagre)
- Include only edges where BOTH source AND target are in the top-1,000
- Include only direct edges (depth_level = 1) in graph.json to keep file size manageable

### package/{package_name}.json — detail panel, loaded on click
```json
{
  "package_name": "requests",
  "latest_version": "2.31.0",
  "summary": "Python HTTP for Humans.",
  "requires_python": ">=3.7",
  "monthly_downloads": 98000000,
  "github_repo_url": "https://github.com/psf/requests",
  "risk_score": 3.1,
  "risk_label": "MEDIUM",
  "trend_direction": "STABLE",
  "score_version": 1,
  "components": {
    "maintainer": 1.6,
    "cve": 0.6,
    "depth": 0.8,
    "downloads": 0.1
  },
  "maintainer": {
    "last_commit_at": "<ISO8601>",
    "days_since_last_commit": 45,
    "commit_count_90d": 8,
    "contributors_count": 12,
    "is_archived": false,
    "activity_label": "SLOW"
  },
  "cves": [
    {
      "osv_id": "GHSA-xxxx-xxxx-xxxx",
      "severity": "HIGH",
      "cvss_score": 7.5,
      "published_at": "<ISO8601>",
      "fixed_in_version": "2.30.0"
    }
  ],
  "trend_history": [
    { "date": "YYYY-MM-DD", "risk_score": 3.4 }
  ],
  "blast_radius_count": 89,
  "direct_dependents": ["boto3", "httpx", "fastapi"],
  "direct_dependencies": ["urllib3", "certifi", "chardet", "idna"]
}
```

Rules:
- `components` values are weighted contributions — they sum to `risk_score`
- `cves` sorted by cvss_score DESC, is_withdrawn = false only
- `trend_history` max 12 months, one entry per calendar month, same score_version only
- `direct_dependents` max 10, sorted by blast_radius_count DESC, within top-1,000 only
- `direct_dependencies` all depth_level=1 within top-1,000 only
- `maintainer` block is null if has_github_link = false

### index.json — lightweight search autocomplete
```json
{
  "generated_at": "<ISO8601>",
  "packages": [
    {
      "name": "numpy",
      "risk_label": "LOW",
      "risk_score": 2.4,
      "blast_radius_count": 312,
      "trend_direction": "STABLE",
      "monthly_downloads": 54000000
    }
  ]
}
```

Rules:
- Sorted by blast_radius_count DESC
- This is the only file loaded on initial page load — must be small

---

## 6. REFRESH ARCHITECTURE

### daily_refresh.yml — runs 02:00 UTC every day
```
Steps in order:
  1. Checkout repo
  2. Python 3.11 setup + pip install -r requirements.txt
  3. GCP auth (service account JSON from GCP_SERVICE_ACCOUNT_KEY secret)
  4. Run github_ingest.py — all packages in scheduler_queue
  5. Run osv_ingest.py — all packages
  6. Run deps_dev_ingest.py — all packages
  7. dbt build --target prod
  8. dbt test --target prod  ← fail workflow here if tests fail
  9. Run risk_score.py
  10. Run graph_export.py
  11. git commit + push updated JSON files (Vercel autodeploys on push)
```

### pypi_event_trigger.yml — runs every 6 hours (polling)
```
Steps in order:
  1. Checkout repo
  2. Python 3.11 + install
  3. GCP auth
  4. Run pypi_ingest.py
     — Compare current PyPI version vs latest_version in dim_packages
     — If unchanged: skip, log as checked, no write
     — If changed: write to raw_pypi_packages
  5. If any packages changed:
     a. Run deps_dev_ingest.py for changed packages only
     b. dbt build --select +dim_packages --target prod (selective)
     c. risk_score.py for changed packages + their direct dependents
     d. graph_export.py for affected package JSON files
     e. git commit + push
  6. If nothing changed: exit 0, no commit
```

### GitHub Actions token budget (monthly estimate)
| Workflow | Duration | Runs/month | Minutes |
|---|---|---|---|
| daily_refresh | ~10 min | 30 | 300 |
| pypi_event_trigger | ~4 min | 120 | 480 |
| **Total** | | | **~780 / 2,000 free** |

---

## 7. OPEN QUESTIONS
None. All design decisions resolved. Striker may begin Increment 1.

---

## 8. SCHEMA VALIDATION

### Problem
If an upstream API silently removes or renames a field we depend on, the ingestion script
will either crash mid-run or write NULL/wrong data to BigQuery with no alert.
raw_payload protects historical data but does not prevent silent bad writes on the current run.

### Approach
Each ingestion script defines a `MINIMAL_SCHEMA` constant at module level.
After fetching the API response, before parsing any fields, validate against that schema.
We only declare fields we actually extract — upstream APIs may freely add new fields.

Library: `jsonschema` (pip install jsonschema). Add to requirements.txt.

### Validation Pattern (all four scripts follow this)
```python
import jsonschema

def validate_response(response: dict, schema: dict, source: str) -> None:
    try:
        jsonschema.validate(instance=response, schema=schema)
    except jsonschema.ValidationError as e:
        logger.error(f"SCHEMA_CHANGE_DETECTED source={source} field={list(e.path)} message={e.message}")
        raise  # fail the GitHub Actions step — triggers workflow failure email
```

On `ValidationError`: log the offending field path, re-raise. GitHub Actions marks the step
as failed and sends email to the repo owner. No partial writes — validation happens before
any BigQuery insert call.

### Minimal Schemas Per Script

**pypi_ingest.py**
```python
PYPI_SCHEMA = {
    "type": "object",
    "required": ["info"],
    "properties": {
        "info": {
            "type": "object",
            "required": ["name", "version"],
            "properties": {
                "name":          {"type": "string"},
                "version":       {"type": "string"},
                "requires_dist": {"type": ["array", "null"]},
                "project_urls":  {"type": ["object", "null"]},
                "home_page":     {"type": ["string", "null"]}
            }
        }
    }
}
```

**github_ingest.py** (validated per repo alias in the GraphQL response)
```python
GITHUB_REPO_SCHEMA = {
    "type": "object",
    "required": ["pushedAt", "stargazerCount", "forkCount", "isArchived", "isFork",
                 "issues", "mentionableUsers"],
    "properties": {
        "pushedAt":          {"type": ["string", "null"]},
        "stargazerCount":    {"type": "integer"},
        "forkCount":         {"type": "integer"},
        "isArchived":        {"type": "boolean"},
        "isFork":            {"type": "boolean"},
        "defaultBranchRef":  {"type": ["object", "null"]},
        "issues":            {"type": "object", "required": ["totalCount"]},
        "mentionableUsers":  {"type": "object", "required": ["totalCount"]}
    }
}
```

**osv_ingest.py**
```python
OSV_BATCH_SCHEMA = {
    "type": "object",
    "required": ["results"],
    "properties": {
        "results": {"type": "array"}
    }
}
```

**deps_dev_ingest.py** (two endpoints, two schemas)
```python
DEPS_DEV_DEPS_SCHEMA = {
    "type": "object",
    "required": ["nodes"],
    "properties": {"nodes": {"type": "array"}}
}

DEPS_DEV_PACKAGE_SCHEMA = {
    "type": "object",
    "required": ["defaultVersion"],
    "properties": {
        "defaultVersion": {
            "type": "object",
            "required": ["dependentCount"],
            "properties": {"dependentCount": {"type": "integer"}}
        }
    }
}
```

### Alert Mechanism
GitHub Actions workflow failure = the alert. No additional tooling needed.
GitHub emails the repository owner on every failed workflow run by default.
The log line `SCHEMA_CHANGE_DETECTED` is searchable in the Actions run output
and gives the exact field path that broke.

### What This Does NOT Cover
- API returning HTTP 4xx/5xx — handled by existing exponential backoff logic.
- New fields added by the API — intentionally ignored (minimal schema pattern).
- pypistats.org download endpoint — simple integer field, no schema needed.
