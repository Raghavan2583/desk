# DESK — Session Log
# Owner: Observer. Append structured entries only. Never raw conversation.

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

## Session: DESK — 2026-07-02 — ~2 hr (risk score data-integrity investigation + 4 fixes)

### What happened
Coach asked how to verify risk scores are actually correct. Traced a real incident using
actual GitHub Actions logs (not guessing): python-multipart, and 41 other packages, jumped
from a genuine MEDIUM to a false CRITICAL between two pipeline runs. Root cause: GitHub's
secondary rate limit (403, distinct from the primary point-budget guard already in place)
cascaded through 767/967 packages after the first hit, wiping their maintainer data for
that run — and the scoring formula treated "no data" as "worst case." Coach correctly
rejected a first-pass fix that defaulted missing data to neutral instead ("what if it's
actually critical and we call it neutral"). Two more real, independently-verified bugs
found in the same pass: CVSS scores always blank (osv_ingest.py tried to float() OSV's
CVSS vector string instead of decoding it), and download counts missing for 98% of
packages (pypistats.org's real 30 req/min site-wide limit can't cover 1,000 packages/day;
old code hit it in ~4s and gave up for the rest of the run).

### Decisions made
- D059: Missing ingestion data must resolve to LIVE / CARRIED_FORWARD (real prior value +
  real verification date, from new maintainer_history.parquet) / NEVER_VERIFIED (explicit
  DATA_INCOMPLETE label, never a fabricated score) — never neutral, never worst-case.
- D060: GitHub's secondary rate limit is a different signal from the primary quota guard —
  now detected and retried with cooldown in github_ingest.py only; D014's general 4xx
  policy unchanged elsewhere.
- D061: Downloads rotate ~40 least-recently-checked packages/run (~3-4 week full cycle)
  instead of all 1,000 daily; carries forward last real count + date otherwise. Coach
  explicitly deferred true same-day refresh to a future step.
- D062: cvss==3.6 added (flagged to Coach first) to properly decode CVSS vectors.

### What failed and how it was resolved
- First attempt at the missing-maintainer-data fix used a flat neutral (5.0) fallback
  regardless of cause. Coach rejected it — researched real precedent (OpenSSF Scorecard's
  "inconclusive result" pattern) before redoing it as the LIVE/CARRIED_FORWARD/
  NEVER_VERIFIED resolution in D059 instead.

### Where we stopped
Phase: Operate. All 4 fixes implemented and committed locally only — commit 76c75033 on
main, NOT pushed (branch ahead 1, behind 2 of origin). Coach ran out of time before the
planned review pass — paused deliberately, not blocked. Frontend build verified clean
(vite build, 530 modules). All new Python logic verified via py_compile + standalone
scenario simulations (duckdb not installed locally) — all passed. Nothing pushed or
deployed; the real pipeline is still running the pre-fix code.

### Learnings for next D3O cycle
- Treating missing pipeline data as either neutral or worst-case both quietly corrupt the
  output — the only honest options are carry-forward-with-real-timestamp or an explicit
  "unverified" state. Applies to any future data source DESK adds.
- Real external rate limits (GitHub secondary limit, pypistats 30/min) only show up in real
  run logs, not by reading the code. `gh api repos/{owner}/{repo}/actions/jobs/{id}/logs`
  pulls raw logs when `gh run view --log` returns empty.
- Local `git log` can be behind `origin/main` even mid-session — `git fetch` before trusting
  local history when diagnosing "why does production look different from what I see."

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
