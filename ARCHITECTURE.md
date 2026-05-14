# DESK — Architecture Deep Dive
# DEpendency riSK · Full system design from scratch to production

---

## 1. What DESK is and why it exists

Most Python applications depend on dozens of open source packages. Those packages are built and maintained by volunteers — often a single person — with no SLA, no contract, and no obligation to keep going. When a maintainer quits, gets compromised, or simply stops responding to CVE reports, nobody in the ecosystem gets notified. Products break silently.

DESK answers one question: **which packages in the PyPI top 1,000 are most likely to fail — and what breaks with them if they do?**

It does this by continuously pulling data from four independent sources, transforming it through a structured pipeline, scoring every package on a 0–10 risk scale, and serving the result as a live dependency graph on the web.

---

## 2. System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions                               │
│   daily_refresh.yml (02:07 UTC)  +  pypi_event_trigger.yml      │
└────────────┬──────────────────────────────────────────────────┘
             │
   ┌─────────▼──────────┐
   │   Ingestion Layer   │  4 Python scripts → BigQuery raw tables
   │  (ingestion/*.py)   │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────┐
   │   Transform Layer   │  dbt Core → 5 staging + 3 intermediate + 3 mart models
   │   (dbt/models/)     │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────┐
   │   Scoring Layer     │  risk_score.py → fact_risk_scores + fact_risk_score_history
   │  (scoring/)         │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────┐
   │   Export Layer      │  graph_export.py → graph.json, index.json, package/{name}.json
   │  (export/)          │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────┐
   │   Frontend          │  React + ReactFlow + dagre → Vercel
   │  (frontend/)        │
   └────────────────────┘
```

Storage: **Google BigQuery** (GCP). Two datasets — `desk_raw` (append-only raw tables) and `desk_prod` (dbt-managed, WRITE_TRUNCATE where applicable).

---

## 3. Data sources and ingestion

### 3.1 PyPI API — `ingestion/pypi_ingest.py`

**What it fetches:** Package metadata from `https://pypi.org/pypi/{package}/json` and monthly download counts from `https://pypistats.org/api/packages/{package}/recent`.

**Deduplication:** Before fetching, the script loads the current `latest_version` for every package from `dim_packages`. If the version hasn't changed since the last run, the package is skipped entirely — no API call, no write. This keeps the raw table lean and avoids redundant processing.

**GitHub URL discovery:** PyPI metadata often contains a GitHub URL in `project_urls` (keys like `Source`, `Repository`, `Code`). The script checks those keys in priority order. If no GitHub URL is found, it falls back to the GitHub Search API (`/search/repositories`) — rate-limited at 2.1 seconds per request to stay under the 30 req/min authenticated cap. The discovered URL is stored permanently in that package's raw row so future runs don't need to re-search.

**Write:** `WRITE_APPEND` to `desk_raw.raw_pypi_packages`. The table is partitioned by `ingested_at`. Deduplication to one-row-per-package happens in the staging dbt model (`stg_pypi_packages`) using a `ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY ingested_at DESC)` window.

**Utilities used:** `retry_with_backoff.py` (exponential backoff on HTTP errors), `validation.py` (JSON schema check on PyPI response), `queue.py` (marks packages as running/complete/error in `scheduler_queue`).

---

### 3.2 GitHub GraphQL API — `ingestion/github_ingest.py`

**What it fetches:** Maintainer health signals for each package that has a GitHub URL — last push timestamp, commit count over the past 90 days, contributor count, open issues, star count, archive status, fork status.

**Batching:** The script uses GraphQL alias batching — 20 repos per query, each aliased as `repo_0`, `repo_1`, etc. This reduces the number of API calls from N (one per package) to N/20 (one per batch), which is critical when tracking 1,000 packages.

**Token pool:** Multiple GitHub personal access tokens are loaded from the `GITHUB_TOKENS` environment variable (JSON array). The `token_pool.py` utility rotates tokens round-robin and watches `X-RateLimit-Remaining` headers. When a token drops below the buffer threshold (100 remaining), the next token in the pool is used.

**Packages with no GitHub URL are skipped** — no row is written for them to `raw_github_maintainers`. This is handled in `int_packages_resolved.sql` via a LEFT JOIN, and in risk scoring via the `has_github_link` flag (a missing GitHub URL results in a neutral maintainer score of 5.0/10).

**Write:** `WRITE_APPEND` to `desk_raw.raw_github_maintainers`.

---

### 3.3 OSV.dev — `ingestion/osv_ingest.py`

**What it fetches:** Known CVEs (Common Vulnerabilities and Exposures) for each package from the Open Source Vulnerabilities database (`https://api.osv.dev`). Each CVE record includes: OSV ID, severity level (CRITICAL/HIGH/MEDIUM/LOW), CVSS score, publish date, and the version in which it was fixed (if any).

**Pipeline treatment:** This step runs with `continue-on-error: true` in the GitHub Actions workflow. The OSV API can be flaky; a failure here should not abort the entire daily refresh. The pipeline proceeds to scoring with whatever CVE data is already in BigQuery from the last successful run.

**Write:** `WRITE_APPEND` to `desk_raw.raw_osv_cves`.

---

### 3.4 deps.dev — `ingestion/deps_dev_ingest.py`

**What it fetches:** The dependency graph for each package from `https://deps.dev` — specifically which packages each of the top 1,000 depends on directly, and whether each dependency is optional or required. This is what powers the blast radius calculation.

**Write:** `WRITE_APPEND` to `desk_raw.raw_deps_dependencies` and `raw_deps_dependents`.

---

## 4. Transform layer — dbt Core

dbt runs as `dbt build --target prod` in the pipeline. It executes all models in dependency order and runs schema tests after each layer.

Two BigQuery datasets are in play:
- `desk_raw` — raw append-only tables (written by ingestion scripts, never touched by dbt)
- `desk_prod` — dbt-owned tables (staging, intermediate, marts, and scoring outputs)

### 4.1 Staging models (5 models)

Each staging model reads from one raw table and produces a clean, deduplicated, one-row-per-entity view. No business logic — just normalisation.

| Model | Source | Key transformation |
|-------|--------|--------------------|
| `stg_pypi_packages` | `raw_pypi_packages` | `ROW_NUMBER()` dedup → latest version per package |
| `stg_github_maintainers` | `raw_github_maintainers` | Dedup by `github_repo_url`, compute `days_since_last_commit`, derive `activity_label` |
| `stg_osv_cves` | `raw_osv_cves` | Clean CVE records, normalise severity to CRITICAL/HIGH/MEDIUM/LOW |
| `stg_deps_dependencies` | `raw_deps_dependencies` | Flag optional vs required dependencies |
| `stg_deps_dependents` | `raw_deps_dependents` | Inbound dependency edges |

---

### 4.2 Intermediate models (3 models)

Intermediate models join staging data and perform aggregations that multiple mart models need.

**`int_packages_resolved`**
Joins `stg_pypi_packages` with `stg_github_maintainers` on `github_repo_url`. This is the single source of truth for one-row-per-package with both PyPI and GitHub fields. The `has_github_link` boolean is derived here. Packages without a GitHub URL get NULL maintainer fields — this is intentional and handled downstream in risk scoring.

**`int_cve_summary_per_package`**
Groups `stg_osv_cves` by package and counts CVEs at each severity level:
```sql
COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) AS critical_count,
COUNT(CASE WHEN severity = 'HIGH' THEN 1 END)     AS high_count,
...
```
One row per package with aggregated CVE counts.

**`int_dependency_metrics`**
Computes the blast radius for each package — the number of other top-1,000 packages that directly depend on it. Uses the `stg_deps_dependents` table, filtering to non-optional dependencies only.

---

### 4.3 Mart models (3 models)

Mart models are the final, query-ready tables that the scoring script reads from.

**`dim_packages`**
The primary package dimension. Joins `int_packages_resolved` with package timestamps (MIN/MAX `ingested_at` from the raw table). Contains: package metadata, GitHub URL, `has_github_link`, `first_seen_at`, `last_updated_at`. One row per package.

**`dim_maintainers`**
Maintainer health dimension. Derived from `stg_github_maintainers`. Contains: `last_commit_at`, `days_since_last_commit`, `commit_count_90d`, `contributors_count`, `is_archived`, `is_fork`, `activity_label`. One row per GitHub repo URL.

**`fact_dependencies`**
Edge table. One row per (package → dependency) relationship. Contains `is_direct`, `is_optional`, and `dependency_version_constraint`. Used to build the graph edges in `graph_export.py`.

---

## 5. Risk scoring — `scoring/risk_score.py`

The scoring script reads from the mart and intermediate tables, computes a weighted risk score for every package, and writes two tables:

- `fact_risk_scores` — current scores, `WRITE_TRUNCATE` (overwritten each run)
- `fact_risk_score_history` — append-only historical record, used for trend calculation

### 5.1 The formula

```
risk_score = (M × 0.4) + (C × 0.3) + (D × 0.2) + (DL × 0.1)
```

Where each component is a raw score from 0.0 to 10.0:

**M — Maintainer health (40% weight)**

| Condition | Raw score |
|-----------|-----------|
| No GitHub link | 5.0 (neutral) |
| Last commit ≤ 30 days | 0.0 |
| Last commit 31–90 days | 2.0 |
| Last commit 91–180 days | 4.0 |
| Last commit 181–365 days | 6.0 |
| Last commit 1–2 years | 8.0 |
| Last commit > 2 years | 10.0 |
| + archived repo | +2.0 penalty |
| + zero commits in 90 days (not archived) | +1.0 penalty |

Maximum maintainer score is capped at 10.0.

**C — CVE exposure (30% weight)**

```
raw = (critical × 3.0) + (high × 2.0) + (medium × 1.0) + (low × 0.5)
```
Capped at 10.0.

**D — Blast radius / ecosystem depth (20% weight)**

| Downstream dependents | Raw score |
|----------------------|-----------|
| 0 | 0.0 |
| 1–10 | 2.0 |
| 11–50 | 4.0 |
| 51–100 | 6.0 |
| 101–200 | 8.0 |
| > 200 | 10.0 |

**DL — Download trend (10% weight)**

Compares current monthly downloads against the same package 180 days ago (read from the append-only `raw_pypi_packages` partition):

| Download trend (% change) | Raw score |
|--------------------------|-----------|
| Growing > 20% | 0.0 |
| Growing 0–20% | 2.0 |
| Declining < 10% | 4.0 |
| Declining 10–30% | 6.0 |
| Declining 30–50% | 8.0 |
| Declining > 50% | 10.0 |
| No history available | 5.0 (neutral) |

---

### 5.2 Risk labels

| Score range | Label |
|-------------|-------|
| 0.0 – 2.9 | LOW |
| 3.0 – 4.9 | MEDIUM |
| 5.0 – 7.4 | HIGH |
| 7.5 – 10.0 | CRITICAL |

### 5.3 Trend direction

Compared against the score from ~30 days ago (nearest row in `fact_risk_score_history`):

| Change | Direction |
|--------|-----------|
| ≥ +0.5 | RISING |
| ≤ −0.5 | FALLING |
| < ±0.5 | STABLE |

If `RISK_SCORE_VERSION` changed (formula updated), all trends are set to STABLE for that run to avoid false signals.

---

## 6. Export layer — `export/graph_export.py`

The export script reads the scored data from BigQuery and writes three types of static JSON files to `frontend/public/data/`. These files are committed to the repository and served as static assets by Vercel — no server-side rendering, no API calls from the browser at runtime.

### 6.1 `graph.json`

The full dependency graph. Loaded once when the user first performs a search.

```json
{
  "metadata": { "generated_at": "...", "package_count": 1000, "score_version": 1 },
  "nodes": [
    {
      "id": "requests",
      "type": "package",
      "data": {
        "package_name": "requests",
        "risk_score": 1.8,
        "risk_label": "LOW",
        "trend_direction": "STABLE",
        "blast_radius_count": 218,
        "monthly_downloads": 94000000,
        "cve_count": 0
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "requests->urllib3",
      "source": "requests",
      "target": "urllib3",
      "data": { "depth_level": 1, "version_constraint": ">=1.21.1" }
    }
  ]
}
```

Only edges where both source AND target are in the top 1,000 are included. Positions are all (0,0) — ReactFlow + dagre handle layout at render time.

### 6.2 `index.json`

Lightweight list for the search autocomplete. Loaded on page load (small file). Sorted by `blast_radius_count` descending so the riskiest packages surface first in autocomplete results.

### 6.3 `package/{name}.json`

Per-package detail file. One file per package, loaded on node click. Contains:
- Full risk score with component breakdown (maintainer, CVE, depth, downloads)
- Maintainer health details (last commit date, commit cadence, contributor count, archive status)
- CVE list (sorted by CVSS score descending)
- 12-month risk score trend history (one entry per calendar month)
- Direct dependencies (what this package depends on)
- Direct dependents (top 10 packages that depend on this one, by blast radius)

---

## 7. GitHub Actions pipeline

### 7.1 `daily_refresh.yml` — 02:07 UTC daily

The primary pipeline. Runs on a cron schedule (off the :00/:30 marks to avoid API congestion) and also supports manual `workflow_dispatch`.

**Concurrency:** Uses a `desk-pipeline` concurrency group with `cancel-in-progress: false`. This means if a run is still in progress when the next cron fires, the new run is queued rather than cancelled. A running pipeline is never aborted mid-flight.

**Step order:**
1. Checkout + Python 3.11 setup
2. `pip install -r requirements.txt`
3. Decode GCP service account key from base64 secret to a temp file
4. `pypi_ingest.py` — fetch PyPI metadata + downloads
5. `github_ingest.py` — fetch maintainer health via GraphQL
6. `osv_ingest.py` — fetch CVEs (`continue-on-error: true`)
7. `deps_dev_ingest.py` — fetch dependency graph
8. `dbt build --target prod` — run all dbt models + schema tests
9. `risk_score.py` — compute scores, write to BigQuery
10. `graph_export.py` — write static JSON files to `frontend/public/data/`
11. Git commit the updated JSON files (`chore: refresh graph data`)
12. `npx vercel deploy --prod` — deploy the frontend with the new data

**Secrets used:** `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY` (base64 encoded), `GH_TOKEN_1` (GitHub PAT for GraphQL), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

### 7.2 `pypi_event_trigger.yml` — event-driven

A second pipeline that fires when PyPI package events are detected (new releases, yanked versions). This allows DESK to respond to changes between daily runs — if a popular package publishes a new version mid-day, the data is refreshed within the hour rather than waiting until 02:07 UTC the next morning.

### 7.3 `schema_monitor.yml` — Mondays 08:17 UTC

Runs `scripts/schema_health_check.py` weekly to verify that all expected BigQuery tables and columns exist. Catches schema drift early (e.g., if a source API changes its response format and the ingestion script silently writes fewer fields).

---

## 8. Frontend — React + ReactFlow + dagre

The frontend is a Vite-built React application deployed on Vercel. It has no backend — all data is served from the static JSON files committed to the repository.

**Package graph:** Rendered with ReactFlow. Node positions are computed at load time using dagre (a directed graph layout algorithm) which places nodes in a hierarchical left-to-right layout based on dependency relationships.

**Node colours:** Each node is coloured by its risk label — CRITICAL (red), HIGH (orange), MEDIUM (yellow), LOW (green) — providing an at-a-glance ecosystem health map.

**Search:** Prefix-search on `index.json`. Typing a package name loads matching entries from the pre-built index and highlights the corresponding node in the graph.

**Detail panel:** Clicking a node loads `package/{name}.json` (lazy-loaded on click) and renders: risk score card, maintainer health, CVE list, trend chart (12 months), blast radius count, top dependents.

**Leaderboard tabs:**
- Watch List — highest risk score packages
- CVE Count — packages with the most active CVEs

**Deployment:** Each pipeline run commits updated JSON files to the repo. The final step of `daily_refresh.yml` triggers `vercel deploy --prod`, which builds and deploys the updated static files. The live URL always reflects the latest data from the most recent successful pipeline run.

---

## 9. Storage schema (BigQuery)

### Raw dataset — `desk_raw`

| Table | Type | Description |
|-------|------|-------------|
| `raw_pypi_packages` | Partitioned, append-only | PyPI metadata + download counts per ingest run |
| `raw_github_maintainers` | Partitioned, append-only | GitHub repo health signals per ingest run |
| `raw_osv_cves` | Partitioned, append-only | CVE records from OSV.dev |
| `raw_deps_dependencies` | Partitioned, append-only | Outbound dependency edges |
| `raw_deps_dependents` | Partitioned, append-only | Inbound dependency edges |

### Production dataset — `desk_prod`

| Table | Written by | Write mode |
|-------|-----------|------------|
| `dim_packages` | dbt | WRITE_TRUNCATE |
| `dim_maintainers` | dbt | WRITE_TRUNCATE |
| `fact_dependencies` | dbt | WRITE_TRUNCATE |
| `stg_*` (5 models) | dbt | WRITE_TRUNCATE |
| `int_*` (3 models) | dbt | WRITE_TRUNCATE |
| `fact_risk_scores` | risk_score.py | WRITE_TRUNCATE |
| `fact_risk_score_history` | risk_score.py | WRITE_APPEND (never deleted) |
| `scheduler_queue` | bootstrap.py | Managed manually |

---

## 10. Design decisions

**Why BigQuery and not Postgres?**
DESK processes 1,000 packages × 4 sources every day. BigQuery's serverless execution means there is no database to provision or maintain, costs scale to zero when the pipeline isn't running, and partitioned tables make the append-only raw storage pattern efficient to query.

**Why static JSON instead of a live API?**
The data changes once per day (at 02:07 UTC). Serving a live API to handle queries that always return the same answer until the next pipeline run is unnecessary overhead. Static JSON served from a CDN is faster, cheaper, and has no cold start.

**Why dbt instead of raw SQL scripts?**
dbt provides dependency ordering (models run in the right sequence automatically), schema tests after each layer, and the `ref()` function which makes the DAG explicit. It also separates concern clearly — staging cleans, intermediate joins and aggregates, marts are query-ready.

**Why OSV.dev instead of the GitHub Advisory Database?**
OSV.dev aggregates from multiple sources (GitHub, NVD, PyPA) and returns a unified record per CVE. It's free, has a simple REST API, and covers the Python ecosystem completely.

**Why the scoring weights (40/30/20/10)?**
Maintainer health is the primary predictor of future risk — a package with no active maintainer can't patch its own CVEs. CVE exposure is the most immediate threat. Blast radius determines impact scope. Download trend is a lagging indicator of community confidence, used as a tiebreaker. These weights are configurable via `RISK_SCORE_VERSION` — bumping the version resets all trends to STABLE to avoid false signals from a formula change.

---

*Built by Raghavan T M · 2026*
