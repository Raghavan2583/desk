# DESK — Locked Decisions
# Observer writes every new locked decision here immediately.
# Rule: NEVER exceed 100 lines. One fact, one place.

## Foundational Architecture — D001–D014 | Locked 2026-05-01
Graph model over dashboard (D001). PyPI only, top 1,000 pre-computed (D002, D003). GitHub Actions + dbt Core + React + ReactFlow + Vercel free tier (D005–D008). GitHub GraphQL for maintainer data, 24hr refresh (D009, D010). Risk = CRITICAL/HIGH/MEDIUM/LOW + x.x/10 + trend arrow (D011). Score weights: maintainer 40%, CVE 30%, depth 20%, trend 10% (D012). Token rotation, priority queue, backoff built from day one (D013, D014). D004/BigQuery superseded by D057.
## D015 | Schema Validation at Ingestion Boundary | 2026-05-04
jsonschema validates API response before parsing; ValidationError fails GHA step + logs field path. Silent drift would write NULL with no alert.
## D016-D017 | Bootstrap source + BigQuery load-job mechanics — superseded by D057
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
## D034 | pypi_event_trigger Concurrency Fix — moot, workflow retired by D065
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
## D058 | NaN Sanitisation Pattern for JSON Export [amended] | 2026-06-30
`_nan(v)` helper converts `float('nan')` → `None` using identity trick (`NaN != NaN`). Round 1: applied to `fetchall()` paths, assumed `_df_rows()` (pandas) was already safe. Round 2 correction: it wasn't — pandas float64 columns silently revert `None` back to `NaN` on read, so `_df_rows()` needed the same `_nan()` treatment on dict values directly; pandas import removed from that path. Always pair with `allow_nan=False` on `json.dumps` for any JSON consumed by a browser — turns silent corruption into a loud ValueError. Verified fixed 2026-06-30: pipeline run 28468472701 green, MEDIUM/HIGH tiles with CVEs (aiohttp, apache-airflow) confirmed clickable.
## D057 | Replace BigQuery with DuckDB + Parquet history files | 2026-06-30
DuckDB runs in-process inside GitHub Actions — no server, no account, no billing. dbt-duckdb~=1.8.0 (pin minor — must match dbt-core 1.8.7). data/desk.duckdb is ephemeral per run (gitignored). Two Parquet files committed to repo for history: fact_risk_score_history.parquet + download_history.parquet (~5MB/year). pypi_ingest self-seeds scheduler_queue from hugovk every run. pandas must be in requirements.txt (DuckDB .df() depends on it). Pipeline live: run 28459003731 all 15 steps green.
## D059 | Missing Ingestion Data ≠ Neutral or Worst-Case | 2026-07-02
Root cause of a real false-CRITICAL spike (python-multipart 3.9→7.9, 1→42 packages CRITICAL): missing maintainer data was scored as worst-case (base=10). Fixed: resolve to LIVE / CARRIED_FORWARD (real prior value + real verification timestamp, from new maintainer_history.parquet) / NEVER_VERIFIED (explicit DATA_INCOMPLETE label, no fabricated score, never shown as a confident risk level). Same pattern applied to download counts (D061). A neutral guess was tried first and explicitly rejected by Coach — averaging in ignorance quietly biases risk estimates toward "looks safe."
## D060 | GitHub Secondary Rate Limit ≠ Primary Quota | 2026-07-02
github_ingest.py's existing X-RateLimit-Remaining guard only covers the point budget. GitHub's secondary rate limit (abuse detection, HTTP 403, can trip with budget still high) is a separate signal and was previously non-retryable by design (D014 policy), cascading instant failure through every batch after the first hit (767/967 packages lost in one run). Now detected via Retry-After header / "secondary rate limit" body text and retried with cooldown, scoped to github_ingest.py only — D014's general 4xx policy is unchanged for other sources.
## D061 | Downloads: Rotate, Don't Refresh Daily — superseded by D064
## D062 | cvss==3.6 Added for CVSS Vector Parsing | 2026-07-02
osv_ingest.py was float()-ing OSV's CVSS vector string directly (e.g. "CVSS:3.1/AV:N/...") instead of decoding it — cvss_score was always None. Red Hat Product Security's `cvss` library (CVSS2/3/4) decodes it properly. Flagged to Coach before adding per requirements.txt rule.
## D063 | Download Rotation Must Run Before Version-Skip Check — bugfix to D061 mechanism, moot since D064
## D064 | Retire the 40/day Download Rotation — Check All 1,000 Daily | 2026-07-04
D061's real constraint was pypistats.org's 30 req/min limit, not a per-day cap — 1,000 requests paced evenly fit in ~50 min, well under the limit. Removed `_select_download_batch`/rotation entirely; every package's download count is now re-checked every run, paced 3s apart (~20 req/min, wide margin). Hardened `_fetch_monthly_downloads` with `retry_with_backoff` (D014 policy) since a single rate-limit hit now risks losing far more packages' data for the day than the old 40-package batch did. `daily_refresh.yml` job timeout raised 60→120 min to fit the longer run. `download_history.parquet`/CARRIED_FORWARD fallback (D059) unchanged — still the safety net for any individual fetch that still fails.
## Orphaned export files (found 2026-07-04, no decision number — bugfix)
`export/graph_export.py` never deleted `frontend/public/data/package/{name}.json` for packages that dropped out of the top-1000 — 72 stale files accumulated back to May, silently missing newer fields like D059's status labels. Fixed: before writing, delete any package JSON whose name isn't in the current run's scored set. One-time cleanup of the 72 existing orphans done manually.
## D065 | Retire pypi_event_trigger.yml — Daily Refresh Only | 2026-07-05
Hourly event trigger (watched ~50 priority packages via PyPI RSS, ran the full pipeline early on a detected release) removed. No live usage benefit today — nobody depends on same-day freshness, and the daily run already covers all 1,000 packages including these 50. It had already caused a real bug (D034 git-push race), a concrete complexity cost rather than a hypothetical one. Workflow file deleted, docs updated to match; D034's concurrency fix is now moot since only one workflow writes to main.
