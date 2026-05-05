# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

---

## Session: DESK — 2026-05-04/05 — ~10 hours

### What happened
Increment 12 (GitHub Actions workflows) built and Guardian-reviewed. Guardian found and Striker fixed one blocking bug (int_dependency_metrics FULL OUTER JOIN — leaf packages were losing blast_radius_count). Guardian gave conditional approval with 3 documented data quality bugs (B001 deps.dev schema drift, B002 OSV severity NULL, B003 GitHub batch fault). Full Deploy phase executed: GitHub repo created (Raghavan2583/desk), GCP IAM granted, BigQuery schema initialized, Vercel deployed. Pipeline ran 7+ times before succeeding — each failure exposed and fixed a real infrastructure bug (streaming insert limits, pypistats rate limit, load job migration, deps.dev API removal, OSV two-phase fetch, GitHub batch isolation). Frontend upgraded from circle nodes to card-style nodes. Schema health monitoring added. GitHub URL search fallback + rate limit logging implemented as next-iteration fix. DESK is live.

### Decisions made
- D016: Bootstrap uses hugovk/top-pypi-packages JSON (not BQ public dataset) — eliminates 200-400GB scan cost on every bootstrap run.
- D017: All ingestion scripts use load_table_from_json (not insert_rows_json) — streaming inserts blocked in free tier and hit 10MB request limit for large raw_payload rows.
- D018: deps_dev_ingest rewritten to parse requires_dist from raw_pypi_packages — deps.dev v3alpha removed dependency endpoints and dependentCount field entirely.
- D019: OSV two-phase fetch — querybatch collects vuln IDs (returns {id,modified} only), GET /v1/vulns/{id} per unique ID for full severity data. MODERATE→MEDIUM label mapping added.
- D020: GitHub batch fault tolerance — per-package try/except inside _execute_batch. One schema failure no longer aborts the remaining 49 repos in the batch.
- D021: Proactive schema monitoring — schema_monitor.yml runs weekly, scripts/schema_health_check.py validates all upstream API shapes independently of the data pipeline.
- D022: PackageNode redesigned as dark card (risk badge + score + trend arrow + blast radius count). Smoothstep edges, animated on focused package.
- D023: GitHub Search API fallback in pypi_ingest — packages without GitHub URLs in PyPI metadata try search/repositories. Discovered URL written to raw_pypi_packages for persistence.

### What failed and how it was resolved
- Bootstrap: insert_rows_json on scheduler_queue failed (streaming buffer blocks DML for ~90min) — switched to load_table_from_json.
- pypi_ingest: pypistats.org rate-limited all 1,000 packages; timeout=30 per call caused 6-min hang — added early-abort flag on first 429, reduced timeout to 10.
- pypi_ingest: insert_rows_json for 1,000 full raw_payload rows exceeded 10MB streaming limit — switched to load job.
- github_ingest: same load job fix; also per-package exception isolation increased coverage from 155 to 264+ unique packages.
- deps_dev_ingest: all 1,000 packages returned 0 rows — deps.dev v3alpha removed /dependencies endpoint and dependentCount. Rewritten to parse requires_dist instead. Now produces 5,363 edges and 805 dependent counts.
- osv_ingest: all 2,341 CVEs had severity=NULL — querybatch returns minimal data only; switched to individual vuln lookups with dedup. OSV uses "MODERATE" not "MEDIUM" — added label mapping.
- GitHub Actions secret GITHUB_TOKEN_1 rejected — GitHub reserves GITHUB_ prefix. Renamed to GH_TOKEN_1.
- Pipeline cancelled 3 times (exit 143) — progress logging every 100 packages added so run looks alive in GitHub Actions UI.
- GCP billing not enabled on desk-495317 — removed billing from momentum-489709 to free the slot, enabled on desk-495317.
- IAM: bigquery-agent@momentum-489709 lacked permissions on desk-495317 — granted via gcloud using Windows gcloud credentials from WSL.

### Where we stopped
Phase: Deploy (complete) → Operate begins
Frontend: https://frontend-sand-seven-57.vercel.app
Pipeline: daily at 02:07 UTC (daily_refresh.yml). Schema monitor: Mondays 08:17 UTC.
GitHub URL coverage: 900/1000 packages have github_repo_url in raw_pypi_packages.
GitHub maintainer coverage: ~224 unique packages (low — next scheduled run will process all 900 via GraphQL since dim_packages now has 900 URLs).
Rate limit: 4,984/5,000 GraphQL points remaining after full run — second token NOT needed.
Next action: Let scheduled run at 02:07 UTC execute. Check GitHub maintainer row count afterward. If coverage < 600, investigate GraphQL null returns per-repo. Then Guardian final sign-off on live system.

### Learnings for next D3O cycle
- Streaming inserts are unsuitable for large raw_payload rows. Load jobs should be the default pattern for all raw ingestion.
- Alpha APIs (deps.dev v3alpha) require proactive schema monitoring, not just reactive D015 validation.
- OSV querybatch returns summary data only — individual vuln lookups required for severity. Dedup first to avoid N×M calls.
- GitHub Search fallback works but only activates for packages with version changes. 900 URLs were already in PyPI metadata — coverage was always high; the bottleneck was batch error handling (B003).
- GCP billing must be enabled on the project BEFORE any pipeline run. Document in SETUP.md pre-flight checklist.

---

## Session: DESK — 2026-05-04 — full day

### What happened
Coach reviewed ARCH.md and raised 5 clarifications: schema origin (derived from real API shapes, not guessed), dynamic ingestion (event-driven polling confirmed, schema auto-adaptation explicitly rejected), dbt free tier confirmed, risk formula grounded in OpenSSF + CVSS v3 + industry practice, frontend discussion deferred. Schema validation gap identified — D015 locked, Section 8 added to ARCH.md. Scheduler-queue state machine added before first ingestion script. Striker then completed Increments 1–11 in sequence: BigQuery schema, all 4 ingestion scripts, dbt staging/intermediate/mart layers, risk scoring engine, JSON export, and the full React frontend.

### Decisions made
- D015: Schema validation at ingestion boundary — jsonschema.validate() before any BigQuery write. ValidationError fails GitHub Actions step, triggers email alert.
- Scheduler_queue state machine: pending → running → complete / error. Each ingestion script marks status per this contract.
- queue.py shared module: common queue status functions extracted to ingestion/utils/queue.py used by all 4 ingest scripts.
- deps.dev 404 = "not indexed" (complete, not error) — prevents permanent error state for packages not in deps.dev.
- prev_monthly_downloads: sourced from raw_pypi_packages ~180 days ago. fact_risk_score_history lacks the column — Blueprint oversight, documented inline in risk_score.py.
- OSV severity: database_specific.severity for label, direct numeric float for score where available. CVSS vectors produce None score (no extra dep added).
- Frontend: reactflow v11 + dagre, Vite build, custom SVG sparkline (zero extra deps beyond plan).
- dim_packages first_seen_at / last_updated_at: MIN/MAX of ingested_at from raw_pypi_packages read directly in mart CTE (staging model doesn't preserve these).

### What failed and how it was resolved
- GraphCanvas destructured `{ visNodes, visEdges }` but getVisibleSubgraph returns `{ nodes, edges }` — caught in self-critique, fixed before reporting.
- pypi_ingest.py originally used per-package BQ DML (2,000 queries for 1,000 packages) — redesigned to 3 batch queries using UNNEST(@packages) array parameter.
- pypi_ingest.py originally had string-formatted SQL for error messages — SQL injection risk, fixed to parameterized queries.

### Where we stopped
Phase: Develop
Active agent: Striker (Increment 11 complete, Increment 12 not started)
Next task: Increment 12 — GitHub Actions workflows (daily_refresh.yml + pypi_event_trigger.yml), then Guardian full sign-off before Deploy phase.

### Learnings for next D3O cycle
- fact_risk_score_history schema should include monthly_downloads for clean download trend calculation. Flag for post-MVP schema revision.
- dims first_seen_at/last_updated_at should be added to stg_pypi_packages in a future dbt refactor.
- int_dependency_metrics uses LEFT JOIN from dep_edges — packages with dependents but no tracked dependencies (e.g. numpy with C extensions) get blast_radius_count = 0. Minor accuracy issue; acceptable for MVP.

---

## Session: DESK — 2026-05-03 — ~30 min

### What happened
Blueprint activated and produced a complete technical design for all six architecture areas: data model (BigQuery schemas), ingestion pipeline, dbt model structure, risk scoring formula with edge cases, frontend API contract (JSON file shapes), and refresh workflow architecture. All design decisions were resolved internally — zero open questions remain. ARCH.md written to project folder. Presented to Dhoni/Coach for approval. Coach is reviewing before next session.

### Decisions made
- Bootstrap method: one-time BQ query against `bigquery-public-data.pypi.file_downloads`, scoped by date. Run monthly thereafter to contain query cost.
- Blast radius source: deps.dev global `dependentCount` (ecosystem-wide). More accurate signal than self-join on top-1,000.
- Packages without GitHub URL: maintainer raw score = 5.0 (neutral). ~10-15% of top-1,000 affected. Acceptable for MVP.
- graph.json edges: direct (depth=1) only, both nodes must be in top-1,000.
- Node positions in graph.json: `{x:0, y:0}` placeholder. React Flow dagre handles layout client-side.
- Trend direction: never compare across RISK_SCORE_VERSIONs. trend = STABLE on version change.
- PyPI event trigger: polling every 6 hours via GitHub Actions scheduler. Not true webhook. Acceptable for MVP.
- dbt does NOT write fact_risk_scores or fact_risk_score_history. risk_score.py writes both. dbt only tests them.

### What failed and how it was resolved
Nothing failed this session.

### Where we stopped
Phase: Design
Active agent: Blueprint (design complete, awaiting Coach approval)
Next task: Coach reviews ARCH.md → approves → Observer logs new decisions to DECISIONS.md → Striker begins Increment 1 (BigQuery schema setup)

### Learnings for next D3O cycle
- pypistats.org has no SLA — if down during ingest, monthly_downloads = NULL. download_component falls back to neutral 5.0. Acceptable.
- BQ public dataset bootstrap scan is ~200-400 GB. Run once only, then monthly with date scope to stay inside 1 TB free quota.
