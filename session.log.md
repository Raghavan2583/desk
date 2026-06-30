# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

---

## Session: DESK — 2026-06-30 — ~4 hr (D057 build)

### What happened
Full D057 migration built and deployed. BigQuery → DuckDB migration: 24 files changed (803 insertions, 1096 deletions). New ingestion/db.py creates DuckDB schemas and all tables on every pipeline connection. pypi_ingest.py now self-seeds scheduler_queue from hugovk (queue was persistent in BigQuery; DuckDB is fresh each run). Two Parquet history files committed to repo (data/history/). First pipeline run: all 5 ingestion steps passed, dbt failed on MicrobatchConcurrency — dbt-duckdb pinned to ~=1.8.0 to match dbt-core 1.8.7. Second pipeline triggered; awaiting result.

### Decisions made
- D057 build complete: commit ea7f4926 on main
- dbt-duckdb pinned ~=1.8.0 (fix commit 4412ea25) — dbt-duckdb>=1.8.0 resolved to 1.9.x which needs dbt-core 1.9.x

### What failed and how it was resolved
- dbt-duckdb version conflict: `Capability.MicrobatchConcurrency` not in dbt-core 1.8.x. Fix: `dbt-duckdb~=1.8.0` constrains to <1.9.0.

### Where we stopped
Phase: Operate. D057 fully live. Pipeline run 28459003731 — all 15 steps green. Site updated.
Coach must manually delete GCP_PROJECT_ID and GCP_SERVICE_ACCOUNT_KEY from GitHub Settings → Secrets (no longer used).

### Learnings for next D3O cycle
- `>=X.Y.0` never pins minor version — pip installs latest, which may need a newer core version. Always use `~=X.Y.0` for adapter packages to stay in the same minor family.
- DuckDB in-process: all 5 ingestion scripts shared a single .duckdb file cleanly with sequential access and explicit conn.close() calls.
- When stripping a cloud provider from requirements.txt, audit all files for pandas/.df()/.to_dataframe() calls — pandas is often a silent transitive dependency of BigQuery but must be declared explicitly for DuckDB pipelines.

---

## Session: DESK — 2026-06-30 — ~30 min

### What happened
Session maintenance and architectural decision. DECISIONS.md compacted 285→92 lines (overdue from last session). BigQuery billing issue surfaced — Coach stopped GCP billing on June 1. Full pipeline architecture explained to Coach (fetch → DB → dbt transforms → score → export static JSON). Two options evaluated: DuckDB (Option 1) and pure Python no-DB (Option 3). D057 locked: replace BigQuery with DuckDB + Parquet files for append-only history. No code built — awaiting Coach build instruction.

### Decisions made
- D057: Replace BigQuery with DuckDB. dbt-duckdb adapter replaces dbt-bigquery. Two history tables (fact_risk_score_history, download history) persisted as Parquet files committed to repo (~5MB/year). Runs on GitHub Actions free runner — no hardware requirements, no account needed.

### What failed and how it was resolved
- Nothing failed. Session was planning only.

### Where we stopped
Phase: Operate. D057 approved, build not started. Awaiting Coach "go" signal.

### Learnings for next D3O cycle
- DuckDB runs in-process inside GitHub Actions — no server, no account, no billing.
- Parquet files for append-only history are safe to commit — tiny size, grows ~5MB/year.
- BigQuery trend history (May 1–June 1) is unrecoverable but only 1 month — starting fresh is fine.
- BigQuery scan-based billing is a trap for append-only pipelines: tables grow → scan cost grows silently.

---

## Session: DESK — 2026-05-23 — ~1 hr

### What happened
Crew maintenance session — no code changes. session.log.md compacted (496→134 lines). ARCH.md renamed to SPEC.md (two architecture files reconciled — spec-level vs narrative-level, not duplicates). Soul file improvements reviewed and one gap filled: observer.md lacked a crew-start compaction response block. Permanent fix added to striker.md: check existing .md files before creating any new one.

### Decisions made
- ARCH.md renamed to SPEC.md — spec-level detail file. ARCHITECTURE.md remains narrative overview. One source of truth per concern.
- striker.md: new rule — NEVER creates a .md file without listing existing project .md files and confirming no scope overlap to Dhoni.
- observer.md: crew-start compaction block added — Observer responds to Dhoni's startup flag before any work is routed.

### What failed and how it was resolved
- Nothing failed. All changes were additive or non-destructive.

### Where we stopped
Phase: Operate. DESK stable. No pending code changes.

### Learnings for next D3O cycle
- File proliferation (two arch docs) is caught by making Striker check before creating, not by Observer detecting after.
- DECISIONS.md compaction should happen every 2-3 sessions, not wait until 285 lines.

---

## Session: DESK — 2026-05-20 — ~2 hr

### What happened
Two infrastructure fixes and one large content deliverable. (1) Pipeline bot-push deploy failure diagnosed: daily_refresh.yml was running but site frozen at May 15 data. Root cause: GitHub Actions does not trigger push-based workflows from github-actions[bot] commits — a security rule. Fix: deploy step added directly inside daily_refresh.yml (D055). (2) Gmail SMTP alert reverted — Coach did not want to share email password. Switched to GitHub native notifications. (3) 8-episode documentary series written and deployed at documentary-site-xi.vercel.app.

### Decisions made
- D055: daily_refresh.yml deploys Vercel directly. Supersedes D054.
- D056: Documentary series (8 episodes) + reading site at documentary-site-xi.vercel.app.

### What failed and how it was resolved
- Gmail SMTP alert reverted — no email password. GitHub native notifications used instead.
- node_modules committed in first documentary commit — .gitignore missing. Fixed with git rm -r --cached.
- Vercel build failed: episodes.js imported markdown from outside project root. Fix: copied files into documentary-site/src/episodes/.

### Where we stopped
Phase: Operate. DESK stable. Pipeline deploys correctly after every daily run.

### Learnings for next D3O cycle
- GitHub Actions bot-push limitation is a recurring trap. Deploy step must live in the same job as the data commit.
- Pipeline success ≠ site updated. Curl the live URL to verify the full chain.

---

## Session: DESK — 2026-05-15 (extended) — ~1 hr

### What happened
LinkedIn project section content written for DESK. Coach's AVP will review the profile directly. One entry (not two) — DESK with live product URL and deck URL. Final approved copy uses declarative, trust-focused voice matching the About section tone.

### Decisions made
- LinkedIn project: one entry, not two. Deck is supporting material inside the same entry.
- LinkedIn description voice: short, declarative, trust-focused.

### What failed and how it was resolved
- First draft second line was too explanatory. Replaced with declarative contrast.

### Where we stopped
Phase: Operate. LinkedIn content finalised. Awaiting AVP review.

### Learnings for next D3O cycle
- Profile copy must echo the same voice as the About section — inconsistency is the first thing a senior reviewer notices.

---

## Sessions: 2026-05-12 to 2026-05-15 [COMPRESSED]
- 2026-05-15 (deploy overwrite): Watch List expanded 12→20 tiles. Manual vercel --prod overwrote pipeline data — fixed via deploy_frontend.yml (D054). feedback_deploy_approval.md written to memory.
- 2026-05-14 (deck rebuild, ~4 hrs): desk-deck rebuilt for LinkedIn — 10 slides, webp characters, 3 ReactFlow diagrams, glass-shatter CSS. D053 locked. ReactFlow blank fix: explicit pixel height required when parent uses alignItems:center.
- 2026-05-14 (~3 hrs): Watch List tab, CVE Count tab, stat row popovers, share/copy URL routing (?pkg=name), score modal, graph re-center. desk-deck scaffolded.
- 2026-05-12 (night): UPGRADE+SAFE VERSION merged split box (D050). Score modal per-factor pts + progress bar (D051). TL;DR panel (D052). WSL2+Vite: always restart dev server after edits — HMR does not fire across /mnt/d boundary.
- 2026-05-12 (evening): CVE panel version-aware risk driver banner, patched/unpatched split (D048). Pencil.dev locked as global design tool (D047). Wordmark indigo+rose (D049).
- 2026-05-12 (morning): Data-driven action banner getPrimaryRiskDriver() (D043). Tooltips position:fixed (D044). URL routing ?pkg=name (D045). Pipeline schedule drift accepted (D046).
- 2026-05-10 (~8 hrs): Navy #0D1117 unified (D040). Scroll reveal both pages (D041). .react-flow__background CSS class override fixed → transparent (D042).

---

## Archive: 2026-05-03 to 2026-05-08 [COMPRESSED]
- 2026-05-08: Paused mid-UI-session. Resumed 2026-05-10.
- 2026-05-07 (evening): Vertical graph TOP/MIDDLE/BOTTOM (D035). Home page risk dashboard + SVG health ring (D036). Orbital CSS @keyframes animation (D038).
- 2026-05-07: [skip ci] unblocked Vercel deploys. GraphQL BATCH_SIZE 50→20 (D032). Maintainer rows 138→888. pypi_event_trigger race condition fixed (D034).
- 2026-05-06: Optional extras filter (D028). OSV+GitHub timeout tuples (D029/D030). Rebase-before-push (D031). Guardian approved — DESK demo-ready.
- 2026-05-05: Three-column graph layout; optional extras deferred; Vercel CLI deploy (D024/D025/D026/D027). Real user test: non-technical users found graph overwhelming.
- 2026-05-04/05: Full deploy phase. GitHub repo, GCP IAM, BigQuery, Vercel live. 7+ pipeline runs — each failure exposed real infra bug. D016–D023 locked.
- 2026-05-04: Increments 1–11 complete. Schema validation at ingestion (D015). SQL injection risk found and fixed in pypi_ingest.py.
- 2026-05-03: Blueprint complete. Bootstrap via hugovk/top-pypi-packages, blast radius from deps.dev dependentCount, dagre layouts client-side.

---
