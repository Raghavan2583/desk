# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

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
