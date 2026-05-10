# DESK — Locked Decisions
# Observer writes every new locked decision here immediately.
# Rule: NEVER exceed 100 lines. One fact, one place. Rationale mandatory.

## D001 — Knowledge Graph over Dashboard
DECISION: Model as a graph. Entities and relationships, not flat tables.
RATIONALE: Chain of reasoning (package → maintainer → dependents → blast radius) is only possible with a graph. A dashboard shows facts. A graph reveals connections that create the insight. This is the core product differentiator.
LOCKED: 2026-05-01

## D002 — PyPI Only for MVP
DECISION: Ingest Python ecosystem (PyPI) only for MVP. npm, Maven, NuGet — post-MVP one by one.
RATIONALE: Python dominates DE/ML stacks at target companies (Swiggy, Razorpay, Zepto). Interviewers feel the impact immediately when searching pandas or fastapi. Depth over breadth wins the portfolio moment.
LOCKED: 2026-05-01

## D003 — Top 1,000 Packages for MVP
DECISION: Pre-compute graph for top 1,000 PyPI packages by download count. Fetch on-demand beyond that.
RATIONALE: Top 1,000 covers ~80% of real-world Python usage. Manageable within free tier. Expand to 10,000 post-MVP once pipeline is proven.
LOCKED: 2026-05-01

## D004 — BigQuery on GCP
DECISION: BigQuery as primary storage and query layer.
RATIONALE: Coach has existing GCP account. Free tier: 10GB storage + 1TB queries/month — sufficient for MVP. Native dbt Core support. No new account setup required.
LOCKED: 2026-05-01

## D005 — GitHub Actions as Scheduler and Runner
DECISION: GitHub Actions for all scheduled pipeline runs and event-triggered updates.
RATIONALE: Free tier (2,000 minutes/month). No additional infrastructure. Secrets management built in. Sufficient for MVP refresh frequency.
LOCKED: 2026-05-01

## D006 — dbt Core for Transformations
DECISION: dbt Core (open source) for all BigQuery transformations.
RATIONALE: Free. Industry standard for DE portfolios. Runs on GitHub Actions. Native BigQuery adapter. Schema tests built in.
LOCKED: 2026-05-01

## D007 — React + React Flow for Frontend
DECISION: React with React Flow library for graph visualization.
RATIONALE: React Flow is purpose-built for node-graph visualization. Free, well-maintained, professional output without heavy customisation. Coach confirmed this choice.
LOCKED: 2026-05-01

## D008 — Vercel for Frontend Hosting
DECISION: Vercel free tier for React frontend hosting.
RATIONALE: Always on, no cold starts, free tier sufficient for portfolio project. Static JSON graph export removes any server dependency.
LOCKED: 2026-05-01

## D009 — GitHub GraphQL API from Day One
DECISION: Use GitHub GraphQL API for all maintainer data. Never REST for bulk operations.
RATIONALE: GraphQL allows batching multiple repo queries in one API call. REST requires one call per repo. At 1,000 packages this matters immediately. Future-proof for 10,000 package expansion without pipeline rewrite.
LOCKED: 2026-05-01

## D010 — 24-Hour GitHub Maintainer Refresh
DECISION: Check GitHub maintainer activity every 24 hours for all watched packages.
RATIONALE: No event feed exists for arbitrary GitHub repos. Predictable and simple for MVP. Optimise to priority-based refresh post-MVP using the priority column skeleton already in schema.
LOCKED: 2026-05-01

## D011 — Risk Score Format: Label + Numeric + Trend
DECISION: Display risk as label (CRITICAL/HIGH/MEDIUM/LOW) prominently, numeric score (x.x/10) underneath small, trend arrow (rising/falling/stable) alongside.
RATIONALE: Label for leaders — quick read. Number for engineers — comparison and precision. Trend for 2026 — direction matters more than static state. All three serve different users in one view.
LOCKED: 2026-05-01

## D012 — Risk Score Formula (MVP v1)
DECISION: Score = maintainer activity (40%) + CVE count (30%) + dependency depth (20%) + download trend (10%).
RATIONALE: Weighted toward human risk (maintainer) because that is the unsolved gap others ignore. CVEs alone are already tracked by Snyk and others. Trend included as signal of ecosystem health.
LOCKED: 2026-05-01

## D013 — MVP Skeleton for Future Scale
DECISION: Wire skeleton for token rotation, priority queue, and exponential backoff from day one. Full implementation post-MVP.
DETAIL: Token config accepts array (MVP uses index 0). Scheduler table has priority column (MVP sets all to 1). Backoff built fully in MVP. GraphQL used from day one.
RATIONALE: Retrofitting these post-MVP requires pipeline rewrite. Skeleton costs near zero now. Saves significant rework at 10,000 packages.
LOCKED: 2026-05-01

## D014 — Exponential Backoff Built Fully in MVP
DECISION: Exponential backoff on all API calls built fully in MVP — not as a skeleton.
RATIONALE: Without backoff, any rate limit or transient API failure crashes the pipeline. 10 lines of code. No reason to defer. Pipeline must be robust from first run.
LOCKED: 2026-05-01

## D015 — Schema Validation at Ingestion Boundary
DECISION: Each ingestion script validates the API response against a minimal jsonschema before parsing or writing to BigQuery. On ValidationError: log the exact field path, raise the exception to fail the GitHub Actions step.
RATIONALE: Silent schema drift (upstream API renames or removes a field) would write NULL or wrong data with no alert. Minimal schema pattern means upstream can add fields freely without breaking us — we only guard fields we extract. raw_payload already protects historical re-processing. This guards the current run.
ALERT MECHANISM: GitHub Actions workflow failure triggers email to repo owner by default. No additional tooling needed.
LOCKED: 2026-05-04

## D016 — Bootstrap Source: hugovk/top-pypi-packages
DECISION: bootstrap.py fetches top-N packages from hugovk/top-pypi-packages JSON endpoint, not bigquery-public-data.pypi.file_downloads.
RATIONALE: BQ public dataset query scans 200-400GB per run, exceeding free-tier scan quota on new projects. hugovk provides same top-N list via a lightweight JSON endpoint updated monthly. No scan cost, no billing dependency.
LOCKED: 2026-05-05

## D017 — Ingestion Writes: Load Jobs Only
DECISION: All ingestion scripts use client.load_table_from_json() (batch load job), never client.insert_rows_json() (streaming insert).
RATIONALE: Streaming inserts are blocked in BigQuery free tier. For large raw_payload rows (50-200KB per package), streaming insert requests exceed the 10MB per-request limit and hang indefinitely. Load jobs have no size limit, commit immediately (enabling same-run DML), and are free on any billing tier.
LOCKED: 2026-05-05

## D018 — Dependency Data Source: requires_dist (not deps.dev)
DECISION: deps_dev_ingest.py parses requires_dist from raw_pypi_packages to build dependency edges and blast radius counts. deps.dev v3alpha is no longer used.
RATIONALE: deps.dev v3alpha removed /dependencies endpoint (404 for all PyPI packages) and removed dependentCount from the package endpoint. requires_dist is already in raw_pypi_packages, requires no external API, and produces correct dependency edges within the top-1000 set.
LOCKED: 2026-05-05

## D019 — OSV Ingestion: Two-Phase Fetch + MODERATE→MEDIUM Mapping
DECISION: Phase 1 querybatch collects {id, modified} per vuln (minimal data). Phase 2 fetches GET /v1/vulns/{id} per unique ID for full data including severity. Rate-limited at 5 req/s. OSV label "MODERATE" mapped to "MEDIUM" in scoring.
RATIONALE: querybatch returns summary data only — severity and CVSS are absent. Individual vuln lookups return full data. Deduplication across packages reduces requests from N×vulns to unique_vulns only. OSV uses "MODERATE" where NIST uses "MEDIUM" — without mapping, all MODERATE CVEs scored as 0.
LOCKED: 2026-05-05

## D020 — GitHub Batch Fault Tolerance: Per-Package Exception Isolation
DECISION: _execute_batch in github_ingest.py wraps per-package validation in try/except. One schema failure skips that package only — does not abort the remaining repos in the batch.
RATIONALE: Previous design lost all 50 packages in a batch when any single repo caused a ValidationError. Real-world GitHub repos have edge cases (archived, forked, unusual fields) that should not penalise all co-processed packages.
LOCKED: 2026-05-05

## D021 — Proactive API Schema Monitoring
DECISION: schema_monitor.yml runs weekly (Mondays 08:17 UTC). scripts/schema_health_check.py makes lightweight test calls to all upstream APIs (PyPI, OSV querybatch, OSV vuln detail, deps.dev, hugovk) and validates minimal expected fields. Fails loudly on schema drift.
RATIONALE: D015 is reactive (detects drift only during pipeline runs). Proactive monitoring catches API changes within 7 days regardless of pipeline schedule, giving time to fix before data quality degrades.
LOCKED: 2026-05-05

## D022 — PackageNode: Card Style
DECISION: PackageNode renders as a dark rounded-rectangle card (160×64px) containing risk label badge, score, trend arrow, and blast radius count. Edges use smoothstep type; focused-package edges are animated.
RATIONALE: Circle nodes with external labels were hard to read at scale. Card nodes expose key data directly without requiring hover, match React Flow's standard design language, and are easier to scan in a dense graph.
LOCKED: 2026-05-05

## D024 — Three-Column Graph Layout Replaces Dagre
DECISION: Graph explore view uses manual three-column positioning: dependencies LEFT, focal CENTER, dependents RIGHT. All edges flow left→right. Dagre LR removed for this view.
RATIONALE: Dagre LR does a full topological sort across all edges in graph.json — the focal node lands in a rank determined by graph topology, not user intent. Manual layout guarantees focal is always centered. Position communicates role without a legend. User testing confirmed dagre output was unreadable for non-technical users.
LOCKED: 2026-05-05

## D025 — Only Focal-Touching Edges Rendered
DECISION: getVisibleSubgraph renders only edges where the focal node is source or target. Cross-edges between two neighbor nodes are excluded.
RATIONALE: Showing all edges between visible nodes (previous behaviour) created spaghetti — if A and B are both neighbors of focal, and A→B exists in the graph, that edge appeared. It was irrelevant to the user's search and added visual noise. Pure star/hub topology from the focal is the correct model for one-package exploration.
LOCKED: 2026-05-05

## D026 — Optional Extras Filtering: Post-MVP
DECISION: requires_dist lines containing `; extra ==` are not filtered in the current MVP. Post-MVP: pypi_ingest.py flags is_optional=TRUE, graph_export.py excludes them from edges.
RATIONALE: The gap was discovered during real user testing (2026-05-05). Fixing it requires ingestion change + pipeline re-run + graph re-export. Not blocking for MVP demo if demo uses safe packages (requests, numpy, django, flask). Risk accepted.
LOCKED: 2026-05-05

## D027 — Vercel Deployment: Manual CLI, Not Git Integration
DECISION: Vercel production deployment requires `vercel deploy --prod` from frontend/ directory. Git push to main does NOT trigger Vercel auto-deploy.
RATIONALE: The frontend Vercel project (prj_lkBSMfh5CXDvE1idq81fLyz5lte4) was linked via CLI (frontend/.vercel/project.json), not GitHub integration. There is no GitHub→Vercel webhook configured. This is intentional for now — post-MVP, connect GitHub integration to automate.
LOCKED: 2026-05-05

## D028 — Optional Extras Filtering: Implemented (Supersedes D026)
DECISION: requires_dist lines containing `; extra ==` are classified as is_optional=TRUE in stg_deps_dependencies via REGEXP_CONTAINS on raw_payload spec string. graph_export.py filters AND NOT COALESCE(is_optional, FALSE) on both edge queries. deps_dev_ingest skips optional deps when counting blast_radius.
RATIONALE: 53% of all requires_dist edges in the top-1000 were optional extras — inflating blast_radius counts and showing false dependencies (e.g. hypothesis → numpy/pandas/django). Fix works on all existing data via raw_payload without schema migration or re-ingestion.
LOCKED: 2026-05-06

## D029 — OSV Ingest Resilience
DECISION: BATCH_SIZE=50, timeout=(5,10) connect/read tuple, max_retries=3 on querybatch calls. OSV_BATCH_DELAY=1.0s between batches. continue-on-error: true on OSV step in workflow.
RATIONALE: OSV.dev exhibits body-stall: sends HTTP headers then stalls on response body, defeating single-value timeouts. Tuple timeout enforces 10s maximum between any two bytes on the body. Pipeline must not be blocked by one flaky external API — continue-on-error ensures dbt/scoring/export run regardless.
LOCKED: 2026-05-06

## D030 — GitHub Ingest Timeout Tuple
DECISION: timeout=(5,10) connect/read tuple on GitHub GraphQL POST in github_ingest.py.
RATIONALE: Same body-stall pattern as OSV.dev — GraphQL endpoint sends headers then stalls under load. Single timeout=60 was holding the socket open indefinitely.
LOCKED: 2026-05-06

## D031 — Workflow Commit Step: Rebase Before Push
DECISION: daily_refresh.yml commit step runs git pull --rebase origin main before git push to handle concurrent commits to main.
RATIONALE: Code fixes pushed to main while pipeline runs caused the data commit to be rejected as non-fast-forward. Rebase ensures the graph data commit always lands on top of latest main cleanly.
LOCKED: 2026-05-06

## D032 — GitHub GraphQL Batch Size Reduction
DECISION: BATCH_SIZE reduced from 50 to 20. INTER_BATCH_SLEEP=2s added. "Resource limits exceeded" in GraphQL response body now raises RuntimeError (was logged as warning).
RATIONALE: At 50 repos/query, GitHub's server-side node complexity limit triggered silently — HTTP 200 with errors field, no data written. 762/900 packages had null maintainer rows. At 20, all 888 eligible packages indexed.
LOCKED: 2026-05-07

## D033 — Vercel Auto-Deploy via Workflow Step (Supersedes D027)
DECISION: daily_refresh.yml runs `npx vercel deploy --prod` as its final step using VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID secrets. [skip ci] removed from refresh commit message.
RATIONALE: [skip ci] blocked Vercel deployments (Vercel treats it as a skip signal). GitHub integration was never configured — Vercel was never auto-deploying. Workflow step deploys only when pipeline produces real data, not on every code commit. More precise than GitHub integration.
LOCKED: 2026-05-07

## D034 — pypi_event_trigger Concurrency and Rebase
DECISION: pypi_event_trigger.yml joins the desk-pipeline concurrency group (cancel-in-progress: false) and adds git pull --rebase before push.
RATIONALE: Without a shared concurrency group, pypi_event_trigger raced daily_refresh on git push — both write to frontend/public/data/. The rebase fix (D031) was applied to daily_refresh but not pypi_event_trigger.
LOCKED: 2026-05-07

## D035 — Vertical Graph Layout (Supersedes D024)
DECISION: Graph explore view uses vertical three-row positioning: dependencies TOP, focal MIDDLE, dependents BOTTOM. Arrows flow top→bottom. PackageNode handles moved to Top/Bottom.
RATIONALE: Horizontal three-column layout placed depends-on and used-by side by side, which felt arbitrary. Vertical hierarchy communicates the dependency chain (upstream → package → downstream) in the natural reading direction. Boss confirmed the vertical layout gives a better "big picture" view.
LOCKED: 2026-05-07

## D036 — Home Page as Risk Dashboard
DECISION: Home page replaced with a risk dashboard: blast radius leaderboard (top 10 by downstream impact), ecosystem health ring (SVG donut showing CRITICAL/HIGH/MEDIUM/LOW split), stats strip (packages tracked / critical count / daily refresh). graph.json pre-warmed on mount.
RATIONALE: Empty search box gave no value before interaction. Dashboard communicates the tool's core insight immediately — before the user types anything. Leaderboard tiles are clickable, making the home page an entry point to the graph, not just a search gateway.
LOCKED: 2026-05-07

## D037 — DEpendency riSK Brand Identity
DECISION: DE=#58A6FF (accent blue), SK=#FF8C00 (orange) with glow, applied to all DESK wordmarks across home page hero and top bar. Full name formatted as DEpendency riSK with DE/SK coloured.
RATIONALE: Acronym is not obvious from "DESK" alone. Colour-coding the source letters (DE from DEpendency, SK from riSK) communicates the name's origin instantly. Consistent across surfaces for brand recognition.
LOCKED: 2026-05-07

## D038 — Orbital Hero Animation
DECISION: Home page hero uses a pure CSS @keyframes orbital animation: 3 rings (blue r=80, orange r=134, green r=192), glowing nodes, pulsing ambient core glow. Decorative only — no interaction, no data binding.
RATIONALE: Static text hero had no visual impact. Cosmic orbital animation matches DESK's network/graph metaphor — nodes orbiting a center mirrors the dependency graph concept. Pure CSS (no canvas, no library) keeps bundle size unchanged.
LOCKED: 2026-05-07

## D039 — Brand Identity Updated (Supersedes D037)
DECISION: DE=#3FB950 (green), SK=#E63946 (red). Applied to wordmark, hero, all surfaces.
RATIONALE: Previous DE=blue/SK=orange lacked contrast against navy background. Green/red matches ecosystem health semantics (safe/risk) and reads clearly on #0D1117.
LOCKED: 2026-05-10

## D040 — Unified Navy Theme
DECISION: C.bg=#0D1117 (GitHub standard dark navy) across all pages — home, explore, top bar, leaderboard gutters.
RATIONALE: Warm charcoal #1A1614 clashed with the graph canvas. Navy is the industry standard (GitHub, Linear, Vercel dashboards) and eliminates the seam between home and explore views.
LOCKED: 2026-05-10

## D041 — Graph Explore Scroll Reveal
DECISION: Explore mode uses sticky graph (zooms out + fades on scroll) with risk panel rising from below — same mechanic as home leaderboard. zoomOnScroll=false on ReactFlow lets mouse wheel scroll the page.
RATIONALE: Side-by-side panel wasted screen space and hid the graph context. Scroll reveal gives full-screen graph first, then full-width risk analysis — better information hierarchy.
LOCKED: 2026-05-10

## D042 — ReactFlow Background Fix
DECISION: index.css `.react-flow__background` set to `background: transparent`. ReactFlow background colour controlled exclusively via `style={{ background: '...' }}` prop on the ReactFlow component.
RATIONALE: The CSS class override silently painted the canvas regardless of any inline style set in React. This caused every background change attempt to fail. Transparent is the correct default — the React prop controls the colour.
LOCKED: 2026-05-10

## D023 — GitHub URL Search Fallback in pypi_ingest
DECISION: When _extract_github_url returns None, pypi_ingest calls GitHub Search API (search/repositories) to find the repo. Discovered URL is written into the raw_pypi_packages row — persists through dbt to dim_packages without schema changes. Rate-limited at 2.1s/req. Aborts on first 429/403.
RATIONALE: Some packages list their GitHub repo under non-standard project_urls keys or omit it entirely from PyPI metadata. Search API finds the authoritative repo by name. Writing to raw_pypi_packages ensures the URL flows through dbt automatically on the same run.
LOCKED: 2026-05-05
