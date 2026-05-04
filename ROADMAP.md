# DESK — Roadmap
# D3O phases with deliverables and acceptance criteria
# Rule: NEVER exceed 180 lines.

## Phase 1 — Design
Owner: Blueprint
Status: IN PROGRESS
Started: 2026-05-01

### Deliverables
1. Complete entity-relationship data model — all BigQuery tables, columns, types, relationships
2. Ingestion pipeline architecture — flow from all 4 APIs to raw BigQuery tables
3. dbt model structure — staging, intermediate, mart layers with lineage diagram
4. Risk scoring algorithm — weighted formula, input sources, output schema, edge cases documented
5. Graph schema — node types, edge types, properties for React Flow consumption
6. API contract — exact JSON shape frontend receives from graph export script
7. Refresh architecture — PyPI event trigger flow + 24hr GitHub scheduler flow

### Acceptance Criteria
- Data model supports all 5 MVP outputs without schema changes
- Every API source mapped to exactly one raw table
- Risk score formula documented with weight rationale and edge case handling
- dbt lineage is clear: raw → staging → intermediate → mart
- API contract is precise enough for Striker to build frontend without questions
- Zero open questions before Striker starts
- Blueprint presents to Dhoni. Dhoni approves. Observer logs to DECISIONS.md.

---

## Phase 2 — Develop
Owner: Striker
Status: PENDING — blocked by Phase 1 completion

### Build Order (strict — each increment tested before next starts)
Increment 1  : BigQuery dataset setup — desk_dev and desk_prod, all tables, schemas
Increment 2  : PyPI ingestion script — top 1,000 packages, metadata, dependencies
Increment 3  : GitHub GraphQL ingestion — maintainer activity, commit frequency, repo health
Increment 4  : OSV.dev ingestion — CVE data per package, severity mapping
Increment 5  : deps.dev ingestion — dependency graph edges, transitive depth
Increment 6  : dbt staging models — raw → cleaned, one model per source
Increment 7  : dbt intermediate models — entity resolution across sources, deduplication
Increment 8  : dbt mart models — dim_packages, dim_maintainers, fact_risk_scores, fact_dependencies
Increment 9  : Risk scoring Python script — weighted formula, history table write, trend calculation
Increment 10 : JSON export script — BigQuery → graph JSON for frontend
Increment 11 : React frontend — SearchBar, GraphCanvas (React Flow), RiskScoreCard, MaintainerCard
Increment 12 : GitHub Actions workflows — daily_refresh.yml + pypi_event_trigger.yml

### Acceptance Criteria per Increment
- No increment merged without Guardian review
- No console.log anywhere in codebase at any point
- All dbt models have schema tests (not_null + unique on key columns minimum)
- Risk score validated against 5 known packages before Increment 10
- Frontend tested: package with 0 dependents, 1 dependent, 100+ dependents, invalid package name
- Guardian full sign-off required before Phase 3 begins

---

## Phase 3 — Deploy
Owner: Operator
Status: PENDING — blocked by Phase 2 + Guardian sign-off

### Deliverables
1. GCP project configured — BigQuery prod dataset, service account with minimum required IAM
2. GitHub repository secrets configured — GCP key, GitHub token, all env vars
3. GitHub Actions workflows live and verified — scheduler running, event trigger active
4. Initial data load — top 1,000 packages ingested, transformed, scored end-to-end
5. Vercel deployment live — frontend on public URL, always on
6. Health check — all 5 outputs verified for 3 test packages (requests, numpy, a deprecated package)

### Acceptance Criteria
- Pipeline runs end-to-end without manual intervention
- Frontend publicly accessible via Vercel URL
- 3 test packages return correct output within 3 seconds
- Zero credentials in any committed file — Operator verifies .gitignore before first push
- GitHub Actions run log clean — no warnings or skipped steps
- Guardian final sign-off on deployed system

---

## Phase 4 — Operate
Owner: Operator (monitoring) + Observer (logging)
Status: PENDING — blocked by Phase 3

### Deliverables
1. 24hr GitHub refresh running consistently without manual intervention
2. PyPI event feed triggering updates correctly on new package versions
3. Pipeline failure alerting — errors surface to Dhoni, not silently swallowed
4. BigQuery usage dashboard — free tier headroom visible
5. Learnings log — real usage reveals gaps, fed into next Design cycle

### Acceptance Criteria
- Zero manual pipeline interventions in first 7 days post-deploy
- Risk scores updating correctly as maintainer activity changes
- No free tier limits breached in first 30 days
- Observer logging health report at every session start

---

## Post-MVP — Future Cycles (not in scope, do not build)
- npm ecosystem ingestion (next ecosystem after PyPI proven)
- Priority-based refresh (high risk packages check more frequently)
- GitHub token rotation pool (multiple tokens for scale)
- Company exposure mapping (which orgs are downstream)
- "What breaks first" — propagation ranking by dependency depth
- Architecture explainer frontend (Link 2 of portfolio — interactive decision walkthrough)
- CRAN, Maven, NuGet ecosystem expansion
