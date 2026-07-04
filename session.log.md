# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

---

## Session: DESK — 2026-07-04 — ~3.5 hr (git cleanup, downloads-freshness UI, orphan bugfix, rotation retirement)

### What happened
Opened with crew-start health check (SESSION.md compacted 33→26 lines). Reviewed and committed a large backlog of pending local changes across 8 commits: gitignore fixes, untracking committed documentary-site/node_modules (2,139 files/49MB, committed since 2026-05-20), ARCH.md→SPEC.md rename, WSL2 vite polling fix, session memory docs, LEARNINGS.md/DESK_USER_GUIDE.md (with a stale BigQuery reference corrected to DuckDB), frontend lockfile. Confirmed the 07-04 02:07 UTC run (first with D059-D063 live) was green end-to-end. Built a downloads-freshness UI feature (pill + always-visible caption showing LIVE/CARRIED_FORWARD/NEVER_VERIFIED, mirroring MaintainerCard) after Coach asked to verify D061's rotation was visible anywhere on the site — it wasn't; the backend computed it correctly but nothing in the frontend read it. While verifying with a real screenshot, found a real backend bug: graph_export.py never deleted per-package JSON files for packages that fell out of the top-1000, leaving 72 stale orphans (some from May) silently missing newer schema fields — fixed + cleaned up. Then, prompted by Coach questioning the 25-day rotation cycle, re-examined the real rate-limit math and found the 40/day cap was overly conservative — retired the rotation entirely (D064): all 1,000 packages now checked daily, paced 3s apart, hardened with retry/backoff, workflow timeout raised 60→120 min.

### Decisions made
- D064: retire the 40/day download rotation, check all 1,000 packages daily at 3s/request (~20 req/min), retry/backoff hardened. See DECISIONS.md.
- Orphaned export files: graph_export.py must delete package JSON for packages no longer in the current scored set, not just add/update. No decision number — bugfix, not an architecture choice.
- documentary-site/node_modules untracked from git rather than a full history rewrite — Coach explicitly declined the rewrite as too invasive for the benefit.
- INTERVIEW_DEEP_DIVE.md kept fully out of the public repo (gitignored) — candid interview-prep material, already distributed as a private Claude Artifact.

### What failed and how it was resolved
- None substantively — every change was verified before commit (production build checks, Node-script logic verification against real sample JSON, syntax/YAML validation). One process cleanup: a vite dev server from earlier verification was left running after an ineffective `kill`; caught and properly killed during a final double-check pass.

### Where we stopped
Phase: Operate. All work committed and pushed to origin/main (8 commits this session). Frontend auto-deployed twice via the existing deploy_frontend.yml path trigger, both green. Tonight's 02:07 UTC run is the first real test of D064 — a one-shot reminder is scheduled for tomorrow 10:37 AM to check it (run duration, timeout headroom, spot-check a previously-CARRIED_FORWARD package flipping to LIVE).

### Learnings for next D3O cycle
- A "known limitation, accepted as interim" note in DECISIONS.md is worth periodically re-questioning — D061's 40/day cap was framed as a rate-limit ceiling, but the real constraint was requests/minute, not requests/day; redoing the math showed all 1,000 fit in ~50 min.
- Verifying a UI feature against real data can surface a second, unrelated bug (the orphan files) — worth chasing both to completion rather than only fixing the one in scope.
- `kill <pid>` on a process launched via `npm exec`/`npx` doesn't always kill the real child process (node vite) — verify with `ps aux | grep` after killing, don't trust a clean exit code alone.

---

## Session: DESK — 2026-07-03b — ~40 min (interview deep-dive documentary)

### What happened
Coach requested a full technical deep-dive of DESK for interview prep — distinct from the
8-episode documentary-site (D056), which is a project-journey narrative for archive/boss
review. Read every real layer of the system (ingestion/*.py, db.py, all dbt SQL,
risk_score.py, graph_export.py, daily_refresh.yml, DECISIONS.md D001-D063, LEARNINGS.md)
before writing anything — no generic filler. Produced INTERVIEW_DEEP_DIVE.md (11 sections:
story, architecture, pipeline flow, data model, tech decisions, code-level patterns,
production failure scenarios, system design scaling, alternatives, interview Q&A bank,
ownership). Then built and published a themed Claude Artifact version (sticky nav, DESK's
real palette from colors.js/index.css, scroll-tracking) for sharing with colleagues —
recommended over a third Vercel deploy since this doc is candid internal prep material, not
public-facing like documentary-site/desk-deck.

### Decisions made
- Artifact (private-by-default, redeploy-in-place) over standing up a new Vercel project for
  this doc — right tool for "share with a few colleagues," not a permanent public surface.

### What failed and how it was resolved
- None — single-pass write, no rework needed.

### Where we stopped
Phase: Operate (unchanged). INTERVIEW_DEEP_DIVE.md committed to working tree (untracked,
not yet git-committed by Coach). Artifact live, private, shareable on demand.

### Learnings for next D3O cycle
- Verified: files outside the fixed crew-start read list (CLAUDE.md/AGENTS.md/DECISIONS.md/
  GUARDRAILS.md/ROADMAP.md/SETUP.md/SESSION.md/session.log.md/DESIGN.md) do not get loaded
  into context automatically — confirmed by grep, no cross-reference exists. Safe pattern for
  any future large reference doc: keep it un-referenced by the crew files unless a session
  actually needs to open it.

---

## Session: DESK — 2026-07-03 — ~1 hr (review, D063 fix, push)

### What happened
Reviewed the local-only commit 76c75033 (D059-D062) before push, as planned. Traced all
four fixes against the actual code paths they touch (github_ingest.py retry logic,
osv_ingest.py CVSS parsing, github_ingest.py maintainer carry-forward) — three checked out
clean. The fourth (download rotation, D061) had a real bug: pypi_ingest.py's pre-existing
"skip if PyPI version unchanged" check ran before the new download-batch check, so most
packages never got a fresh row written even when due for a download recheck, leaving stale
counts silently mislabeled LIVE. Fixed and committed as D063. Origin had also moved on
(3 automated `chore: refresh graph data` bot commits, 06-30 to 07-02) — rebased cleanly
(zero file overlap: bot commits only touch generated data, ours only touch source) and
pushed both commits to main.

### Decisions made
- D063: download-batch check must run before the version-unchanged skip, or D061's rotation
  never actually fires for stable packages. See DECISIONS.md.

### What failed and how it was resolved
- First push attempt was rejected (non-fast-forward) — origin had 3 bot data-refresh commits
  we didn't have locally. Stashed unrelated pre-existing pending changes (CLAUDE.md,
  DECISIONS.md, SESSION.md, session.log.md, both vite.config.js, ARCH.md deletion) before
  rebasing to avoid risking them, rebased cleanly, restored the stash, then pushed.

### Where we stopped
Phase: Operate. Commits 0d13cbdb (D059-D062) + dd6f1b54 (D063) pushed to origin/main.
Neither daily_refresh.yml (schedule/dispatch only) nor deploy_frontend.yml (frontend/**
paths only) triggers on this push, so nothing executes until tonight's 02:07 UTC scheduled
run — Coach will check it directly, no session check-in requested. The older unrelated
pending pile (CLAUDE.md, DECISIONS.md, SESSION.md, session.log.md, vite.config.js x2,
ARCH.md deletion, untracked SPEC.md/LEARNINGS.md/DESK_USER_GUIDE.md) is still uncommitted
and unreviewed — untouched this session. Coach wants to discuss documentary creation next,
deferred to a new session by mutual agreement (topic is long/distinct from Operate work).

### Learnings for next D3O cycle
- A fix that adds new "skip this work" branching (D061's download batch) has to be checked
  against every *existing* "skip this work" branch already in the function — two independent
  skip conditions can silently AND together into "skipped more often than either intended."
- Before pushing after any gap, `git fetch` + compare file lists between the two branches
  first — if there's zero overlap, rebase is safe without reading every line of the bot's
  commits individually.

---

## Archive: 2026-07-02 [COMPRESSED]
- D059-D062: risk-score data-integrity investigation, triggered by a real false-CRITICAL incident (python-multipart). Root cause: GitHub secondary rate limit cascaded data loss across 767/967 packages, and missing data was scored as worst-case. Fixed: LIVE/CARRIED_FORWARD/NEVER_VERIFIED resolution (D059, never neutral/worst-case — Coach explicitly rejected a neutral-fallback first pass), GitHub secondary rate limit retry (D060), download rotation 40/day (D061, deferred same-day refresh to a future step), CVSS vector decode via `cvss` lib (D062).
- Learnings: neutral-or-worst-case defaults both silently corrupt output; real external rate limits only show up in run logs, not code (`gh api .../actions/jobs/{id}/logs` when `gh run view --log` is empty); `git fetch` before trusting local history mid-session.

---

## Archive: 2026-06-30 [COMPRESSED]
- D057 planned then built: BigQuery→DuckDB migration (24 files, commit ea7f4926), dbt-duckdb pinned ~=1.8.0 (MicrobatchConcurrency conflict, fix 4412ea25), pipeline live all 15 steps green (run 28459003731). Orphaned GCP secrets deleted from GitHub after stability confirmed.
- D058: NaN serialisation bug found (CVE fields → literal `NaN` token → invalid JSON → silent JS parse failure → dead leaderboard tiles) and fixed in two rounds — first pass missed that pandas float64 columns silently revert `None` back to `NaN`; `_df_rows()` needed the same `_nan()` treatment as the `fetchall()` path. Verified closed: run 28468472701 green, tiles clickable.
- Learnings preserved in D057/D058 (DECISIONS.md): `~=X.Y.0` pin adapter packages to match core version; audit for silent transitive deps (pandas) when stripping a cloud provider; sanitise NaN at every serialisation path independently, not just at the data layer; `allow_nan=False` on any `json.dumps` a browser will parse.

---

## Archive: 2026-05-03 to 2026-05-23 [COMPRESSED]
- 2026-05-23: Crew maintenance. session.log.md compacted. ARCH.md → SPEC.md. striker.md rule added: check existing .md files before creating new ones.
- 2026-05-20: Bot-push deploy fix (D055) — deploy step moved inside daily_refresh.yml. Documentary site deployed (D056, 8 episodes, documentary-site-xi.vercel.app).
- 2026-05-15: LinkedIn project section written. One entry, trust-focused voice, live URL + deck URL.
- 2026-05-12 to 2026-05-15: Watch List 12→20 tiles (D054). desk-deck rebuilt for LinkedIn (D053). Watch List tab, CVE Count tab, stat row popovers, URL routing, score modal. UPGRADE+SAFE VERSION box (D050-D052). CVE panel (D048). Pencil.dev locked (D047). Wordmark indigo+rose (D049). Navy #0D1117 (D040-D042).
- 2026-05-03 to 2026-05-10: Full build + deploy. Blueprint complete. Increments 1–11. BigQuery + Vercel live (D016–D023). Guardian approved demo-ready. Graph layout (D024-D038).

---
