# DESK — 2026-05-04

## What we did

**Design review**
- Coach reviewed ARCH.md. Answered 5 clarifications: schema derived from real API shapes, dynamic ingestion is event-driven polling (not schema auto-adaptation), dbt Core is free, risk formula grounded in OpenSSF + CVSS v3 + industry tools, frontend discussion deferred.
- Identified and filled schema validation gap — D015 locked, Section 8 added to ARCH.md.
- Added scheduler_queue state machine (pending → running → complete / error) to ARCH.md before any code was written.

**Increment 1 — BigQuery schema**
- `setup/create_schema.py` — creates desk_raw, desk_dev, desk_prod datasets and all tables. Idempotent.
- `requirements.txt`, `.env.example`, `.gitignore`

**Increment 2 — PyPI ingestion**
- `ingestion/utils/backoff.py` — exponential backoff with jitter (D014)
- `ingestion/utils/validation.py` — shared schema validation (D015)
- `ingestion/utils/token_pool.py` — GitHub token rotation skeleton
- `ingestion/bootstrap.py` — seeds scheduler_queue from public BigQuery PyPI dataset
- `ingestion/pypi_ingest.py` — fetches PyPI + pypistats, version-change detection, batch BQ writes

**Increment 3 — GitHub GraphQL ingestion**
- `ingestion/utils/queue.py` — shared queue status functions extracted for all 4 scripts
- `ingestion/github_ingest.py` — alias-based batching (50 repos/query), rate limit handling, dim_packages fallback on first run

**Increment 4 — OSV CVE ingestion**
- `ingestion/osv_ingest.py` — 100-package batch POST, severity parsing, results-count guard

**Increment 5 — deps.dev ingestion**
- `ingestion/deps_dev_ingest.py` — two endpoints per package, 404 = "not indexed" (not error), version URL-encoded

**Increment 6 — dbt staging**
- `dbt/dbt_project.yml`, `dbt/profiles.yml` (env vars only, safe to commit)
- `dbt/models/staging/sources.yml`
- `stg_pypi_packages.sql`, `stg_github_maintainers.sql`, `stg_osv_cves.sql`, `stg_deps_dependencies.sql`, `stg_deps_dependents.sql`

**Increment 7 — dbt intermediate**
- `int_packages_resolved.sql` — LEFT JOIN pypi + github on github_repo_url
- `int_cve_summary_per_package.sql` — COUNTIF per severity label
- `int_dependency_metrics.sql` — max_depth + direct_dep_count + blast_radius_count

**Increment 8 — dbt marts + schema tests**
- `dim_packages.sql`, `dim_maintainers.sql`, `fact_dependencies.sql`
- `schema.yml` — not_null + unique on key columns; fact_risk_scores tested as source (written by risk_score.py)

**Increment 9 — Risk scoring**
- `scoring/risk_score.py` — full weighted formula (0.4 maintainer + 0.3 CVE + 0.2 depth + 0.1 downloads), version-change detection, WRITE_TRUNCATE for current scores, WRITE_APPEND for history

**Increment 10 — JSON export**
- `export/graph_export.py` — produces graph.json, index.json, package/{name}.json from BigQuery

**Increment 11 — React frontend**
- `frontend/package.json` — React 18 + reactflow v11 + dagre
- `frontend/src/utils/colors.js` — all DESIGN.md hex values
- `frontend/src/utils/graph.js` — getVisibleSubgraph + dagre layout
- `frontend/src/components/PackageNode.jsx` — circle node, size = blast radius, white ring when focused
- `frontend/src/components/SearchBar.jsx` — autocomplete with keyboard nav
- `frontend/src/components/MaintainerCard.jsx` — activity badge + commit stats
- `frontend/src/components/RiskScoreCard.jsx` — score + sparkline + CVEs + dep links
- `frontend/src/components/GraphCanvas.jsx` — ReactFlow + dagre layout
- `frontend/src/App.jsx` — two-state layout (empty search / explore mode)

## What's left
- Increment 12: GitHub Actions workflows (daily_refresh.yml + pypi_event_trigger.yml)
- Guardian full sign-off
- Deploy phase (Operator)
