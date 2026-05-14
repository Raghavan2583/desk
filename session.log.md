# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

---

## Session: DESK — 2026-05-12 (night) — ~1.5 hrs

### What happened
Boss feedback session. Three UI changes shipped to production. (1) UPGRADE banner and SAFE VERSION badge merged into a single split box — white outer border with breathing glow, left half red/amber tint with red UPGRADE badge, right half emerald tint with green SAFE VERSION badge and version number. Standalone safe version badge below CVEs removed (now redundant). (2) "How is this scored?" modal upgraded — each factor row now shows actual pts contribution, a thin color-matched progress bar, and a Total score row at the bottom so users see how the final number was built. (3) TL;DR 3-line summary panel added above Depends on/Used by — left side has 3 narrative sentences (ecosystem reach, CVE state, verdict), right side has a plain-English conclusion sentence in peach. Left border is indigo (#818CF8, DE wordmark color), right border is rose (#F472B6, SK wordmark color). All changes committed (e7e62aa9) and deployed.

### Decisions made
- D050: UPGRADE banner and SAFE VERSION badge merged into one split box. White outer border + white breathing glow. Red left half (UPGRADE) + emerald right half (SAFE VERSION). Only renders when riskDriver is UPGRADE and a safe version exists — all other driver types (CRITICAL, ABANDONED, STALE) keep single-box layout.
- D051: Score modal now passes `components` and `risk_score` from packageData. Per-factor pts shown with progress bar (fraction of total score) and total row at bottom.
- D052: TL;DR panel uses DE_COLOR (#818CF8) left border + SK_COLOR (#F472B6) right border. Left verdict line colored indigo, right conclusion text peach (#FFAD93). Template-based generation from existing data fields — no API calls, no backend change.

### What failed and how it was resolved
- Changes not visible on localhost: WSL2 Vite file watcher does not detect changes across /mnt/d Windows filesystem boundary. Fix: kill and restart dev server after every edit. This is the permanent workaround for this project setup.
- Stray extra `}` introduced in ScoreModal JSX — esbuild caught it during build. Fixed immediately before deploy.

### Where we stopped
Phase: Operate. All changes committed and deployed. Git clean.
Last commit: e7e62aa9 — UPGRADE+SAFE VERSION merged box, score breakdown modal, TL;DR summary panel.

### Learnings for next D3O cycle
- WSL2 + Vite: always restart dev server after file edits — HMR does not fire across the /mnt/d boundary. Never diagnose "not visible" as a code issue before restarting the server first.
- TL;DR wording: template sentences must answer "so what?" not restate data already visible in pills. Boss confirmed plain-English verdict sentences are the right direction.

---

## Session: DESK — 2026-05-12 (evening) — ~3 hrs

### What happened
UI polish session driven by boss review. Recovered all P0+P1 changes from the morning session that were committed locally but never pushed to git (Vercel's GitHub integration re-deployed from origin, wiping the local deploy). Configured Pencil.dev as the global design tool standard with MCP server wired into ~/.claude/mcp.json. CVE panel rebuilt from scratch: version-aware risk driver banner with one-word verdict label (UPGRADE/CRITICAL/MONITOR/ABANDONED/STALE/RISING/EXPOSURE), patched/unpatched CVE split with red divider, SAFE VERSION breathing white badge above CVE list, 2-line CVE card showing fix version prominently on line 2. All 5 risk panel pills now colored. Leaderboard title bar redesigned: macOS dots removed, title text + sort buttons colored by mode (magenta/red), segmented pill toggle so both modes always visible. Homepage wordmark updated from green+red to indigo+rose, critical risk stat hardcoded red with scatter glow on all three stats.

### Decisions made
- D047: Pencil.dev is the global design tool for all projects with frontend UI. MCP server config in ~/.claude/mcp.json. Fallback: Figma if pricing changes post-early-access.
- D048: CVE panel is version-aware — safe version computed as highest fixed_in_version across all CVEs (semver compare). Risk driver banner shows actionable upgrade path with one-word label chip. Patched/unpatched CVEs split with visual divider.
- D049: Homepage wordmark colors indigo (#818CF8) + rose (#F472B6). Supersedes D039.

### What failed and how it was resolved
- Homepage overhaul attempt (aurora blobs + floating cards + navy bg) was reverted at Coach request — went too far without explicit instruction. Lesson: ask before redesigning a full page.
- Settings.json rejected mcpServers key — MCP config belongs in ~/.claude/mcp.json, not settings.json. Fixed immediately.

### Where we stopped
Phase: Operate. All changes committed and deployed. Git clean (frontend).
Last commit: f0b62821 — wordmark indigo+rose, critical risk always red.

### Learnings for next D3O cycle
- Never redesign a full page unprompted. Make targeted changes only unless explicitly asked for a full overhaul.
- MCP server config lives in ~/.claude/mcp.json — not settings.json.
- CVE panels need version context (what to upgrade to), not just counts. Data was already there — just not surfaced.

---

## Session: DESK — 2026-05-10 — ~8 hrs

### What happened
Full frontend overhaul across two pages. Home page: centered hero (removed CLI panel and aurora blobs), unified navy `#0D1117` background, macOS floating leaderboard window with purple glowing border ring, scroll zoom-out mechanic (hero zooms out, leaderboard rises). Graph page: scroll reveal (sticky graph zooms out, risk panel slides up from below), navy graph canvas with electric cyan/magenta glowing edges, focal node breathing pulse, 3-column risk panel header, compact CVE grid, dependency chips moved above CVEs with cyan/magenta color coding matching graph edges. Brand colors updated: DE=#3FB950 (green), SK=#E63946 (red). Search box updated to navy theme. All changes deployed to production via `npx vercel --prod` from frontend/. Root cause for repeated bg failures: `.react-flow__background { background: var(--bg) }` in index.css was overriding inline ReactFlow style prop silently — fixed by setting to `transparent`.

### Decisions made
- D039: Brand identity updated — DE=#3FB950 (green), SK=#E63946 (red). Supersedes D037.
- D040: Unified navy theme — C.bg=#0D1117 across home + explore. Matches GitHub standard.
- D041: Graph explore scroll reveal — sticky graph scales out (0.8) + fades, risk panel rises with purple ring. Same mechanic as home leaderboard.
- D042: Vercel deploy confirmed — `npx vercel --prod` from frontend/ is the reliable path. Git push alone does not trigger auto-deploy.

### What failed and how it was resolved
- ReactFlow background not changing: `.react-flow__background { background: var(--bg) }` CSS override silently painting canvas warm charcoal regardless of inline style. Fixed by setting to `transparent` in index.css.
- Graph scroll not working: ReactFlow capturing mouse wheel events. Fixed: `zoomOnScroll={false}` + `preventScrolling={false}` on ReactFlow component.
- Ambient orb effects invisible: opacity 0.05-0.09 too low to see. Decided to use plain navy instead — cleaner result.

### Where we stopped
Phase: Operate. Both pages live on production. Boss meeting pending.

### Learnings for next D3O cycle
- Always check for CSS class overrides before debugging inline style failures
- For bg color changes: two places only — `.react-flow__background` in index.css + `style` prop on ReactFlow component
- `npx vercel --prod` from frontend/ is the deploy command, not git push

---

## Session: DESK — 2026-05-12 — ~3 hrs

### What happened
Boss feedback session. Analysed 5 categories of feedback, pushed back on 3 items (DESK branding, AI-generated summaries, alternative suggestions, frameworks/utilities filter — all rejected with reasons). Built and deployed two batches. Batch 1 (P0): quick-pick chips below search bar, leaderboard sort controls (Blast Radius / Risk Score toggle), trend arrows redesigned as labelled row (↑ Rising / ↓ Falling / → Stable), action banner replaced with data-driven `getPrimaryRiskDriver()` function. Batch 2 (P1 + polish): tooltips on all pills using `position: fixed` + `getBoundingClientRect()` (absolute was clipped by overflow containers), share/copy button with URL routing `?pkg=name`, "How is this scored?" modal with 4-factor breakdown, graph node re-center on click via `setCenter()`, visual polish on scroll hints and back button. Pipeline drift (02:07 UTC scheduled, running ~06:00 UTC) explained and accepted — no fix needed.

### Decisions made
- D043: Action banner is data-driven, not prescriptive. `getPrimaryRiskDriver()` reads CVEs, maintainer state, trend history, blast radius — returns one plain-English evidence sentence. Returns null if no signal — banner hidden.
- D044: Tooltip implementation uses `position: fixed` + `getBoundingClientRect()`. `position: absolute` is clipped by `overflowY: auto` scroll containers in the explore view.
- D045: URL routing added — `?pkg=name` written to URL on package load, read on mount. Enables shareable deep links.
- D046: Pipeline schedule drift accepted. GitHub delays scheduled jobs on low-activity repos by 3-4 hours. Data still refreshes daily — exact hour irrelevant.

### What failed and how it was resolved
- Tooltips not visible after first deploy: `position: absolute` clipped by explore view's `overflowY: auto` scroll container. Fixed by switching to `position: fixed` with `getBoundingClientRect()`.

### Where we stopped
Phase: Operate. All boss feedback addressed. All P0 and P1 items shipped. No open work.

### Learnings for next D3O cycle
- Tooltip in scroll containers: always use `position: fixed` — `absolute` is clipped by overflow parents
- `getPrimaryRiskDriver()` pattern: derive action from data, never prescribe without evidence
- Graph re-center: `setCenter()` from `useReactFlow()` gives instant visual feedback before data loads
- Prescriptive labels without evidence erode trust — data-driven labels always preferred

---

## Checkpoint: "graph-page-redesign-locked" — 2026-05-10

Phase        : Operate
Active agent : Striker + Observer
State        :
  - Graph canvas: navy blue #0D1117 background (GitHub standard), transparent ReactFlow
    background SVG so CSS no longer overrides it
  - Edges: electric cyan #00D4FF (deps) + neon magenta #FF2D9A (dependents),
    both with drop-shadow glow filter
  - Focal node: risk-coloured gradient card with top colour stripe + slow breathing
    pulse animation (1.6s interval)
  - Regular nodes: coloured top stripe + gradient body + risk-colour glow on hover
  - Stats bar: floating pill top-center (deps · dependents · blast radius · CVEs)
  - Fit-to-screen button: bottom-right, purple border, SVG icon
  - Graph page scroll: graph zooms out (sticky), risk panel rises up from below
    with purple glowing border ring
  - Risk panel: 3-column header (package info · maintainer strip · risk score),
    CVEs in 2-column grid, dependencies side by side
  - Top bar: navy #0D1117, package breadcrumb + version + risk badge (glowing)
  - Entire explore view unified: #0D1117 throughout (top bar, canvas, gutters)
Next action  : Boss meeting feedback → decide on further P1 items

---

## Checkpoint: "home-page-redesign-locked" — 2026-05-10

Phase        : Operate
Active agent : Striker + Observer
State        :
  - Hero: fully centered layout (no CLI panel), 64px headline, search bar centered,
    inline stat row (1,000 · critical count · Daily). AuroraBg removed — plain C.bg background.
    Orbital animation retained. Bottom 45% fade to C.bg for seamless scroll transition.
  - Scroll effect: hero sticky (position:sticky), scales out (0.8) + fades on scroll,
    leaderboard rises over it with zIndex:2.
  - Leaderboard: macOS floating window (dark navy #13131E, traffic lights, title bar #1A1A2C).
    Glowing second border ring via box-shadow (gap #1A1614 → purple ring → 4 scatter layers).
    Top 20 packages, 4-column grid. Cards have risk-color glow borders.
    Outer background matches hero (C.bg = #1A1614) — unified dark throughout.
  - Brand identity: DE=#3FB950 (green), SK=#E63946 (red). Locked.
Next action  : Await boss meeting feedback. P1 items: Risk Movers, leaderboard tabs.

---

## PAUSE — 2026-05-08 evening — UI redesign session mid-flight. Alignment fix applied, awaiting Coach visual confirmation. Resume: /crew-start.

---

## Session: DESK — 2026-05-07 (evening) — ~4 hrs

### What happened
Full frontend overhaul driven by boss meeting feedback. Graph layout changed from three-column horizontal to vertical hierarchy (depends-on TOP → focal MIDDLE → used-by BOTTOM) with arrows flowing top→bottom. PackageNode handles moved Left/Right → Top/Bottom accordingly. Panel toggle and back button shipped (were uncommitted since last session). Legend removed — headers on graph nodes make it redundant. Home page rebuilt as a risk dashboard: blast radius leaderboard (top 10 by downstream impact, clickable tiles), ecosystem health ring (SVG donut with CRITICAL/HIGH/MEDIUM/LOW distribution), stats strip (packages tracked / critical count / daily refresh). DESK logo in top bar now navigates home. TL;DR health snapshot added to RiskScoreCard (one-liner: downstream · deps · CVEs · activity · last commit age). CVE rows redesigned: plain date (month year), link to GitHub Advisory / OSV, raw ID de-emphasised. CVE sort changed to descending (newest first). Search upgraded from prefix-only to substring with prefix results ranked first. DEpendency riSK brand identity locked: DE=#58A6FF, SK=#FF8C00, everywhere including the top bar wordmark. Cosmic orbital animation added to hero: 3 rings (blue/orange/green), glowing nodes, pulsing ambient core — pure CSS. All changes deployed to production. P2 (optional extras gap) confirmed already fixed — project memory was stale, live data verified clean.

### Decisions made
- D035: Vertical graph layout — depends-on TOP, focal MIDDLE, used-by BOTTOM (supersedes D024 three-column)
- D036: Home page as risk dashboard — leaderboard + health ring + stats bar, graph.json pre-warmed on mount
- D037: DEpendency riSK brand identity — DE=#58A6FF, SK=#FF8C00, consistent across all surfaces
- D038: Orbital hero animation — pure CSS @keyframes, 3 rings, decorative only, no interaction

### What failed and how it was resolved
- Commit blocked on push: remote had a newer data refresh commit. Fixed with git stash + pull --rebase + stash pop + push.
- Vercel CLI not auto-deploying on push (expected — wired to pipeline only). Resolved by running vercel deploy --prod manually from frontend/ each time.

### Where we stopped
Phase: Operate
Pipeline: fully automated, running daily at 02:07 UTC.
Frontend: https://frontend-sand-seven-57.vercel.app — orbital hero + brand identity live.
Boss meeting pending — Coach will present to boss and return with feedback.

### Learnings for next D3O cycle
- Vertical top-to-bottom graph layout communicates dependency chain more intuitively than horizontal columns for non-technical users.
- Pre-warming graph.json on mount eliminates all latency on the home page leaderboard — no perceived loading.
- CVE readability (date + link vs raw ID) significantly reduces cognitive load for non-professionals without losing data for professionals.
- Brand identity (colored acronym) is a fast way to communicate what the tool does before the user reads any copy.

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

---

## Session: DESK — 2026-05-07 — ~6 hrs

### What happened
GraphQL rate limit gap fixed: BATCH_SIZE 50→20, INTER_BATCH_SLEEP=2s, "Resource limits exceeded" now raises instead of warning silently. Maintainer rows went from 138 to 888 (out of 900 eligible). pypi_event_trigger race condition fixed: shared desk-pipeline concurrency group + git pull --rebase before push. Root cause of stale Vercel data found: [skip ci] in refresh commits was blocking Vercel deployments; daily_refresh workflows use schedule/dispatch only so [skip ci] never did anything for GitHub Actions — it only ever blocked Vercel. Fix: removed [skip ci], added vercel deploy --prod step with VERCEL_TOKEN secret. Full end-to-end verified: pipeline ran → 888 rows → data committed → Vercel deployed automatically → maintainer cards live. CI/CD guardrails documented in project GUARDRAILS.md, global ~/.claude/rules/cicd.md, and dhoni.md. Personal learnings written to LEARNINGS.md.

### Decisions made
- D032: GitHub GraphQL BATCH_SIZE 50→20 + 2s inter-batch sleep + raise on resource limits
- D033: Vercel auto-deploy via workflow step — supersedes D027 (manual CLI)
- D034: pypi_event_trigger joins desk-pipeline concurrency group + rebase before push

### What failed and how it was resolved
- Maintainer cards showing dashes: initially suspected browser cache (wrong). Root cause: Vercel never redeployed after pipeline runs because [skip ci] blocked all Vercel deployments since launch. Fixed by removing [skip ci] + adding deploy step.
- GitHub GraphQL "Resource limits exceeded": was silently swallowed as a warning. 762 packages had null maintainer data with no alert. Fixed by reducing BATCH_SIZE and raising on batch-level errors.
- Pipeline loop yesterday: cancel-in-progress: false + multiple manual triggers + pypi_event_trigger racing daily_refresh created sequential failures. Fixed with shared concurrency group.

### Where we stopped
Phase: Operate
All pipeline automation complete and verified. DESK fully automated end-to-end.
Pending: frontend/src/App.jsx + GraphCanvas.jsx + graph.js — uncommitted UI changes
  including zoom button fix (marginBottom 8→100), panel toggle, back button.
  Discuss column layout direction with Coach before committing GraphCanvas + graph.js.

### Learnings for next D3O cycle
- [skip ci] blocks Vercel. Only use it when skipping Vercel is explicitly intended.
- Diagnose stale data by curling the live URL — not by asking for a hard refresh.
- GraphQL HTTP 200 can contain batch-level failures. Always inspect errors field. Raise, never warn.
- Any two workflows writing to the same files need a shared concurrency group.

---

## Session: DESK — 2026-05-06 — ~4 hrs

### What happened
Pipeline health check revealed AMBER: dim_maintainers has only 138 rows (target 600+) due to GraphQL rate limits hitting 100 errors/run. All four demo packages (requests, numpy, django, flask) have null maintainer cards — scores inflated by neutral 4.0 maintainer component + real CVEs. Demo strategy revised to use typing-extensions, pydantic, tqdm, grpcio (all have full maintainer data). Optional extras fix shipped: deps_dev_ingest, stg_deps_dependencies, fact_dependencies, graph_export — edge count dropped 5363→2543 (53% were optional extras). hypothesis now shows exceptiongroup/tzdata/sortedcontainers only. OSV body-stall root cause found and fixed: OSV.dev sends headers then stalls on body, defeating single-value timeout. Fixed with (5,10) connect/read tuple. Same fix applied to github_ingest. Pipeline workflow hardened: continue-on-error on OSV step, git pull --rebase before push. DEMO_SCRIPT.md written. Guardian final sign-off: APPROVED.

### Decisions made
- D028: Optional extras filtering implemented in dbt + graph_export (supersedes D026 post-MVP deferral)
- D029: OSV ingest — BATCH_SIZE 50, timeout=(5,10), max_retries=3, continue-on-error in workflow
- D030: GitHub ingest — timeout=(5,10) on GraphQL POST
- D031: Workflow commit step uses git pull --rebase origin main before push to handle concurrent commits

### What failed and how it was resolved
- Pipeline hung on OSV step ×2 — single timeout=60 doesn't catch body stall (headers arrive, body stalls). Fixed with (5,10) tuple.
- Pipeline hung on GitHub maintainers ×1 — same body stall pattern. Fixed with (5,10) tuple.
- Commit step push rejected ×1 — concurrent code commits moved main ahead. Fixed with git pull --rebase before push.
- Push of github_ingest fix rejected locally — same rebase pattern. Fixed with git stash + pull --rebase + stash pop.

### Where we stopped
Phase: Operate
Active agent: Dhoni + Observer
Pipeline: last successful run 2026-05-06 ~04:30 UTC. All steps green. graph.json updated.
Guardian: APPROVED — DESK is demo-ready.
Demo script: DEMO_SCRIPT.md in project root.

### Learnings for next D3O cycle
- requests timeout=(connect, read) tuple is mandatory for any API that may stall on the response body. Single value is insufficient.
- OSV.dev and GitHub GraphQL both exhibit body-stall behaviour under load. Pattern applies to any future ingest scripts.
- continue-on-error on ingestion steps prevents one flaky external API from blocking the entire pipeline. All ingest steps should have it.
- 53% of requires_dist entries in the top-1000 are optional extras — much higher than expected. Blast radius counts were significantly inflated before the fix.
- Demo packages must have populated maintainer data. requests/numpy/django/flask all have null maintainer cards due to GraphQL rate limit gap (138/900 repos indexed).
- GraphQL rate limit root cause (100 errors/run, only 138 maintainer rows) is the top priority post-demo.

---

## Session: DESK — 2026-05-05 — ~4 hrs

### What happened
Real user testing with Coach + 2 friends exposed two root problems: (1) non-technical user found the graph overwhelming and unreadable — no legend, no direction cues, dagre layout created spaghetti; (2) technical user searched python-statemachine and procrastinate, found nothing, got zero explanation. Session was spent fixing both with a full graph UX overhaul and search feedback. Also discovered Vercel was deployed manually (not auto from git push), which caused confusion when changes weren't appearing live. Identified and documented the optional extras data gap — requires_dist includes optional extras which DESK treats as required deps, polluting the "Depends on" column for packages like hypothesis.

### Decisions made
- Three-column manual layout replaces dagre LR: deps LEFT, focal CENTER, usedBy RIGHT. Arrows all flow left→right (water flow). (D024)
- Only edges touching the focal node are rendered — cross-edges between neighbors removed. (D025)
- Optional extras filtering (requires_dist `; extra ==` lines) is post-MVP. Demo avoids packages with many extras. (D026)
- Vercel deployment: must run `vercel deploy --prod` from frontend/ directory. Git push to main does NOT trigger Vercel. (D027)

### What failed and how it was resolved
- Background color tinting (role-based node colors) failed — nodes too small for subtle tints to be visible. Reverted to risk-label border colors; position now communicates role.
- Dagre layout was not producing three-column structure — dagre does a full topological sort regardless of focal node. Replaced with manual column positioning.
- Changes not appearing live for 40 minutes — Vercel project is linked to CLI deployment, not GitHub integration. Root cause found via .vercel/project.json.

### Where we stopped
Phase: Operate
Active agent: Dhoni + Observer
Next task: Step 1 — Pipeline health check. Step 2 — Fix optional extras in pypi_ingest.py + graph_export.py. Step 3 — Re-export graph. Step 4 — Guardian final sign-off. Step 5 — Demo prep.

### Learnings for next D3O cycle
- Optional extras from requires_dist must be filtered at ingestion. Lines containing `; extra ==` should be marked is_optional=TRUE and excluded from graph edges.
- Packages where extras create circular relationships (hypothesis ↔ pytest): both a dep-of and used-by. Bidirectional edges need special handling post-MVP.
- sortedcontainers (blast_radius=4) is cut from hypothesis graph by the 15-node cap while high-blast optional extras dominate. Real deps can be invisible. Cap sorting by blast_radius only works correctly after optional extras are filtered.
- Demo package list for superiors: requests, numpy, django, flask, boto3. Avoid hypothesis, pytest, and any library with many optional extras.
