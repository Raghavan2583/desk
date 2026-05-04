# DESK — Stack and Setup
# Rule: NEVER exceed 180 lines.

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Language | Python 3.11+ | All API clients native. dbt, scoring, export all Python. |
| Scheduler | GitHub Actions | Free 2,000 min/month. Secrets management. No extra infra. |
| Storage | BigQuery (GCP) | Coach has GCP account. 10GB + 1TB queries free. dbt native. |
| Transformation | dbt Core | Free. Industry standard. BigQuery adapter. Runs on GH Actions. |
| Risk Scoring | Python script | Runs post-dbt on GitHub Actions. Writes to fact_risk_score_history. |
| Graph Export | Python script | BigQuery → JSON. Consumed by frontend. Static, no server needed. |
| Frontend | React + React Flow | React Flow purpose-built for node graphs. Vercel-ready. |
| Hosting | Vercel (free tier) | Always on. No cold starts. Static export. |

## Data Sources

| Source | Protocol | Auth | What we fetch |
|---|---|---|---|
| PyPI JSON API | REST | None | Package metadata, dependencies, download stats, latest version |
| GitHub API | GraphQL | Personal Access Token | Maintainer commits, activity, repo health, contributor count |
| OSV.dev | REST | None | CVEs per package, severity, patch status |
| deps.dev | REST | None | Dependency graph edges, transitive depth, dependent count |

## Repository Structure

```
DESK/
├── .github/
│   └── workflows/
│       ├── daily_refresh.yml        # 24hr GitHub maintainer check (all 1,000 packages)
│       └── pypi_event_trigger.yml   # Fires on new PyPI package version published
├── ingestion/
│   ├── pypi_ingest.py               # Top 1,000 packages — metadata + dependencies
│   ├── github_ingest.py             # Maintainer activity via GraphQL (batched)
│   ├── osv_ingest.py                # CVE data from OSV.dev per package
│   ├── deps_dev_ingest.py           # Dependency edges from deps.dev
│   └── utils/
│       ├── backoff.py               # Exponential backoff — built fully in MVP
│       └── token_pool.py            # Token rotation skeleton — MVP uses index 0 only
├── dbt/
│   ├── models/
│   │   ├── staging/
│   │   │   ├── stg_pypi_packages.sql
│   │   │   ├── stg_github_maintainers.sql
│   │   │   ├── stg_osv_cves.sql
│   │   │   └── stg_deps_dependencies.sql
│   │   ├── intermediate/
│   │   │   ├── int_packages_resolved.sql    # Entity resolution across sources
│   │   │   └── int_maintainers_resolved.sql # Deduplicate maintainers across packages
│   │   └── marts/
│   │       ├── dim_packages.sql
│   │       ├── dim_maintainers.sql
│   │       ├── fact_dependencies.sql
│   │       ├── fact_risk_scores.sql
│   │       └── fact_risk_score_history.sql  # Trend line data — append only
│   ├── tests/
│   │   └── schema.yml               # not_null + unique tests on all key columns
│   └── dbt_project.yml
├── scoring/
│   └── risk_score.py                # Weighted formula v1. RISK_SCORE_VERSION env var.
├── export/
│   └── graph_export.py              # BigQuery → graph JSON → /frontend/public/data/
├── frontend/
│   ├── public/
│   │   └── data/                    # Static JSON graph files served by Vercel
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx        # Package search input
│   │   │   ├── GraphCanvas.jsx      # React Flow graph — nodes, edges, zoom, pan
│   │   │   ├── RiskScoreCard.jsx    # Label + numeric + trend arrow
│   │   │   └── MaintainerCard.jsx   # Maintainer health — last commit, package count
│   │   └── App.jsx
│   └── package.json
├── .env.example                     # Template only. Never commit actual .env
├── .gitignore                       # .env listed before first commit. Operator verifies.
└── requirements.txt                 # Python dependencies — pinned versions

```

## BigQuery Dataset Structure

```
desk_raw/                          # Raw API responses. Append only. Purged on schedule.
  raw_pypi_packages
  raw_github_maintainers
  raw_osv_cves
  raw_deps_edges

desk_dev/                          # Striker builds and tests here. Mirrors prod structure.
  (all mart tables — dev data only)

desk_prod/                         # Production. Operator controls. Never written during dev.
  dim_packages
  dim_maintainers
  fact_dependencies
  fact_risk_scores
  fact_risk_score_history          # Append only — never update, only insert
  scheduler_queue                  # Priority skeleton — all priority=1 in MVP
```

## Environment Variables (.env — never commit)

```
# GitHub API
GITHUB_TOKENS=["token_1"]          # Array. MVP uses index 0. Add tokens here for rotation.

# GCP
GCP_PROJECT_ID=                    # Your GCP project ID
GCP_DATASET_RAW=desk_raw
GCP_DATASET_DEV=desk_dev
GCP_DATASET_PROD=desk_prod
GCP_SERVICE_ACCOUNT_KEY_PATH=      # Local path only. Never commit the key file.

# Pipeline Config
PYPI_TOP_N=1000                    # Change to 10000 post-MVP
RISK_SCORE_VERSION=1               # Increment when formula changes — preserves history
REFRESH_INTERVAL_HOURS=24          # GitHub check frequency
```

## GitHub Actions Secrets Required (Operator configures)
- GCP_SERVICE_ACCOUNT_KEY — JSON key, base64 encoded
- GH_TOKEN_1 — Personal access token with repo:read scope
- GCP_PROJECT_ID

## Free Tier Limits — Monitor Every Session
| Resource | Free Limit | Action if approaching |
|---|---|---|
| BigQuery storage | 10 GB | Alert Coach. Archive raw layer first. |
| BigQuery queries | 1 TB/month | Optimise query patterns. Partition tables. |
| GitHub Actions | 2,000 min/month | Reduce refresh frequency or optimise job time. |
| Vercel bandwidth | 100 GB/month | Static JSON — unlikely to hit. Monitor anyway. |
