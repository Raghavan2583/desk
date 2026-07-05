# DESK — DEpendency riSK
# Project context for Cricket Crew
# Phase: Operate | Updated: 2026-07-05
# Rule: NEVER exceed 150 lines.

## What DESK Is
A knowledge graph that maps open source dependency risk across the PyPI ecosystem.
User types any package name → sees blast radius, risk score, maintainer health, trend.
The method creates the insight. Connections reveal what flat data cannot.

## Problem Statement
Product companies depend on OSS packages maintained by volunteers.
When a package goes unmaintained or gets compromised — nobody sees it coming.
DESK maps the chain before it breaks, not after.
Nobody has a tool watching the entire ecosystem: "Which packages threaten the most apps?"
That is the unsolved gap DESK fills.

## Active Roster
Blueprint  : Design phase lead — owns architecture, data model, graph schema
Striker    : Develop phase lead — builds pipeline, scoring engine, frontend
Guardian   : Quality gate — nothing ships without explicit sign-off
Operator   : Deploy phase — GCP setup, GitHub Actions, Vercel
Observer   : Every phase — logs all decisions, failures, transitions
Dhoni      : Orchestrator — routes everything, never skips a phase

## Benched
Selector   : Project initialised 2026-05-01. Dormant. Reactivates only on re-scoping.

## Current Phase
Operate — DESK is live

## Live URLs
Frontend    : https://frontend-sand-seven-57.vercel.app
Repo        : https://github.com/Raghavan2583/desk
Pipeline    : daily_refresh.yml — 02:07 UTC daily (deploys Vercel directly — D055)
Monitor     : schema_monitor.yml — Mondays 08:17 UTC
Deep Dive   : https://documentary-site-xi.vercel.app (engineering deep-dive, replaced old 8-episode documentary 2026-07-05)

## Last Session
2026-07-05 — Verified D064's first daily run (success, 1h25m). Public-repo cleanup (deleted
stale docs, added README, purged 511 dead Actions runs). Retired pypi_event_trigger.yml
(D065) after it proved redundant and already-buggy. Rebuilt the documentary as a real
engineering deep-dive (public + private versions), deployed live. Fixed two real product
bugs found by reviewing a live package page: ABANDONED label conflated confirmed-archived
with inferred-inactive (D066, split into DORMANT/ARCHIVED), and the score modal displayed
the wrong weight percentages (D067).

## Next Action
After tomorrow's 02:07 UTC run recomputes activity_label from raw data, confirm jinja2 (and
any other 365+ day, non-archived package) now shows DORMANT instead of ABANDONED on the live
site — D066's data-side change hasn't been observed live yet, only the frontend code deploy
has.
  Deck URL: https://desk-deck.vercel.app
  Local dev: cd desk-deck && CHOKIDAR_USEPOLLING=true npx vite --port 5174

## Project Location
/mnt/d/PERSONAL/Raghav/Project/Main Projects/desk/

## MVP Scope (locked)
IN:
- PyPI top 1,000 packages only
- 4 data sources: PyPI API, GitHub GraphQL API, OSV.dev, deps.dev
- Risk score: numeric (x.x/10) + label (CRITICAL/HIGH/MEDIUM/LOW) + trend arrow
- 5 outputs: blast radius graph, risk score card, maintainer card, 12-month trend line, blast radius count
- Refresh: daily full pipeline run + 24hr GitHub maintainer check
- Storage: DuckDB (in-process, ephemeral per run) + Parquet history files committed to repo (D057)
- Transform: dbt Core
- Frontend: React + React Flow on Vercel (desktop only)
- Skeleton built in: token rotation config, priority column, exponential backoff, GraphQL from day one

OUT (explicitly post-MVP):
- npm / any non-PyPI ecosystem
- Company exposure mapping
- User accounts or authentication
- Alerts or notifications
- Replacement package suggestions
- Mobile frontend
- Blast radius propagation ranking ("what breaks first" ordering)

## Increment Status (Develop phase)
✓  1  DuckDB schema setup (ingestion/db.py — replaces BigQuery create_schema.py)
✓  2  PyPI ingestion (pypi_ingest.py, self-seeds queue; bootstrap.py merged in)
✓  3  GitHub GraphQL ingestion (github_ingest.py)
✓  4  OSV CVE ingestion (osv_ingest.py)
✓  5  deps.dev ingestion (deps_dev_ingest.py)
✓  6  dbt staging models (5 SQL + project config)
✓  7  dbt intermediate models (3 SQL)
✓  8  dbt mart models + schema tests
✓  9  Risk scoring (risk_score.py) + Parquet history files
✓ 10  JSON export (graph_export.py)
✓ 11  React frontend (13 files — Vite + ReactFlow + dagre)
✓ 12  GitHub Actions workflows (D057: DuckDB, no GCP secrets)
