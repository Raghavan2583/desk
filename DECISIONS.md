# DESK — Locked Decisions
# Observer writes every new locked decision here immediately.
# Rule: NEVER exceed 100 lines. One fact, one place.

## Foundational Architecture — D001–D014 | Locked 2026-05-01
Graph model over dashboard (D001). PyPI only, top 1,000 pre-computed (D002, D003). GitHub Actions + dbt Core + React + ReactFlow + Vercel free tier (D005–D008). GitHub GraphQL for maintainer data, 24hr refresh (D009, D010). Risk = CRITICAL/HIGH/MEDIUM/LOW + x.x/10 + trend arrow (D011). Score weights: maintainer 40%, CVE 30%, depth 20%, trend 10% (D012). Token rotation, priority queue, backoff built from day one (D013, D014). D004/BigQuery superseded by D057.
## D015 | Schema Validation at Ingestion Boundary | 2026-05-04
jsonschema validates API response before parsing; ValidationError fails GHA step + logs field path. Silent drift would write NULL with no alert.
## D016 | Bootstrap: hugovk/top-pypi-packages | 2026-05-05
JSON endpoint, not BQ public dataset. BQ public scans 200-400GB per run; exceeds free-tier quota.
## D017 | Ingestion: Load Jobs Only | 2026-05-05
client.load_table_from_json() only — no streaming inserts. Streaming blocked on free tier; load jobs unlimited + free + immediate commit.
## D018 | Dependency Data: requires_dist | 2026-05-05
Parse requires_dist from raw_pypi_packages. deps.dev v3alpha removed /dependencies endpoint (404 on all PyPI packages).
## D019 | OSV: Two-Phase Fetch + MODERATE→MEDIUM | 2026-05-05
Phase 1 querybatch for IDs; Phase 2 GET per unique ID for severity. Map MODERATE→MEDIUM (OSV/NIST labels diverge).
## D020 | GitHub Batch Fault Tolerance | 2026-05-05
Per-package try/except in _execute_batch — one failure skips that package only. Previous design lost all 50 in batch on any single error.
## D021 | Proactive Schema Monitor | 2026-05-05
schema_monitor.yml weekly (Mon 08:17 UTC) tests all upstream APIs. D015 only catches drift during pipeline runs; weekly gives days to fix.
## D022 | PackageNode: Card Style | 2026-05-05
160×64px dark rounded-rectangle: risk badge + score + trend + blast count. Smoothstep edges; focal edges animated.
## D023 | GitHub URL Search Fallback | 2026-05-05
pypi_ingest calls GitHub Search API when _extract_github_url fails (rate-limited 2.1s/req). Some packages omit GitHub URL from PyPI metadata.
## D025 | Focal-Touching Edges Only | 2026-05-05
getVisibleSubgraph renders only edges where focal is source or target. Cross-neighbor edges create spaghetti.
## D028 | Optional Extras Filter [supersedes D026] | 2026-05-06
requires_dist lines with '; extra ==' → is_optional=TRUE in stg_deps; graph_export.py filters from edge queries. 53% of edges were optional extras, inflating blast_radius.
## D029 | OSV Ingest Resilience | 2026-05-06
BATCH_SIZE=50, timeout=(5,10), max_retries=3, 1s inter-batch delay, continue-on-error: true. OSV body-stall pattern; pipeline must not block on one flaky API.
## D030 | GitHub Ingest Timeout Tuple | 2026-05-06
timeout=(5,10) on GitHub GraphQL POST. Same body-stall as OSV; single timeout=60 held socket indefinitely.
## D031 | Rebase Before Push | 2026-05-06
daily_refresh.yml: git pull --rebase origin main before git push. Concurrent pushes caused non-fast-forward rejection.
## D032 | GraphQL BATCH_SIZE 50→20 | 2026-05-07
BATCH_SIZE=20, INTER_BATCH_SLEEP=2s; resource limit error now raises RuntimeError. At 50, server silently returned no data for 762/900 packages.
## D034 | pypi_event_trigger Concurrency Fix | 2026-05-07
Joins desk-pipeline concurrency group (cancel-in-progress: false) + rebase before push. Race condition with daily_refresh on git push.
## D035 | Vertical Graph Layout [supersedes D024] | 2026-05-07
Dependencies TOP, focal MIDDLE, dependents BOTTOM. Horizontal layout felt arbitrary; vertical communicates dependency chain naturally.
## D036 | Home Page Risk Dashboard | 2026-05-07
Blast radius leaderboard (top 10) + health ring (SVG donut) + stats strip. graph.json pre-warmed on mount. Empty search gave no value before interaction.
## D038 | Orbital Hero Animation | 2026-05-07
Pure CSS @keyframes: 3 rings + glowing nodes + pulsing core. No interaction, no bundle impact. Mirrors dependency graph concept.
## D040 | Unified Navy Theme | 2026-05-10
C.bg=#0D1117 across all pages (home, explore, top bar, gutters). Warm charcoal clashed with graph canvas; navy is industry standard.
## D041 | Scroll Reveal: Graph + Risk Panel | 2026-05-10
Sticky graph (zooms out + fades on scroll), risk panel rises from below. zoomOnScroll=false lets wheel scroll page. Side-by-side wasted space.
## D042 | ReactFlow Background Fix | 2026-05-10
.react-flow__background { background: transparent }. CSS class override painted canvas regardless of inline style prop.
## D043 | Risk Driver Banner: Data-Driven | 2026-05-12
getPrimaryRiskDriver() computes sentence from CVEs, maintainer state, trend, blast radius — no static labels. Static labels without data erode trust.
## D044 | Tooltip: position fixed | 2026-05-12
position:fixed + getBoundingClientRect. position:absolute clipped by overflowY:auto scroll containers.
## D045 | URL Routing: ?pkg= Deep Links | 2026-05-12
window.history.replaceState writes ?pkg=name; on mount reads param to auto-load package. No router library needed.
## D046 | Pipeline Schedule Drift: Accepted | 2026-05-12
GHA fires 3-4hr late on low-activity repos. No fix — exact hour irrelevant for risk tool showing week-over-week trends.
## D047 | Pencil.dev as Global Design Tool | 2026-05-12
Standard for all frontend projects. MCP in ~/.claude/mcp.json. Fallback: Figma if pricing changes.
## D048 | CVE Panel: Version-Aware Remediation | 2026-05-12
Safe version (highest fixed_in_version via semver), patched/unpatched split, one-word risk chip. CVE counts alone cause alert fatigue.
## D049 | Brand Identity: Indigo + Rose [supersedes D037, D039] | 2026-05-12
DE_COLOR=#818CF8 (indigo), SK_COLOR=#F472B6 (rose). Critical risk stays #E63946 (semantic). Distinctive on dark backgrounds.
## D050 | UPGRADE + SAFE VERSION Split Box | 2026-05-12
When riskDriver=UPGRADE + safe version: single split box (red left/UPGRADE, emerald right/SAFE VERSION). Two boxes for one signal was redundant.
## D051 | Score Modal: Per-Factor Breakdown | 2026-05-12
ScoreModal shows actual pts contribution + color-matched progress bar + total row. Static weights showed no connection to specific package score.
## D052 | TL;DR Summary Panel | 2026-05-12
3-sentence template above Depends on/Used by. DE_COLOR left border, SK_COLOR right border, peach conclusion. Zero API calls.
## D053 | desk-deck: Portfolio Presentation | 2026-05-14
Standalone Vite+React at desk-deck.vercel.app. 10 slides, Framer Motion, ReactFlow (disabled). No GitHub remote until Coach decides to go public.
## D055 | Pipeline Deploys Frontend Directly [supersedes D027, D033, D054] | 2026-05-20
daily_refresh.yml: npx vercel deploy --prod after data commit. Bot commits cannot trigger push-based workflows (GHA security rule prevents it).
## D056 | Documentary Series + Site | 2026-05-20
8 episodes at desk/documentary/. Reading site at documentary-site-xi.vercel.app. Shareable project journey for archive and boss review.
## D057 | Replace BigQuery with DuckDB + Parquet history files | 2026-06-30
DuckDB runs in-process inside GitHub Actions — no server, no account, no billing. dbt-duckdb~=1.8.0 (pin minor — must match dbt-core 1.8.7). data/desk.duckdb is ephemeral per run (gitignored). Two Parquet files committed to repo for history: fact_risk_score_history.parquet + download_history.parquet (~5MB/year). pypi_ingest self-seeds scheduler_queue from hugovk every run. pandas must be in requirements.txt (DuckDB .df() depends on it). Pipeline live: run 28459003731 all 15 steps green.
