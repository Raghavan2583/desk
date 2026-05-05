# DESK — DEpendency riSK
# Project context for Cricket Crew
# Phase: Operate | Updated: 2026-05-05
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
Frontend : https://frontend-sand-seven-57.vercel.app
Repo     : https://github.com/Raghavan2583/desk
Pipeline : daily_refresh.yml — 02:07 UTC daily
Monitor  : schema_monitor.yml — Mondays 08:17 UTC

## Last Session
2026-05-04/05 — Full Deploy phase complete. 8 infra bugs fixed during pipeline bringup.
Data quality bugs B001/B002/B003 fixed. Card-node UI shipped. DESK live.

## Next Action
Observer: Monitor next scheduled pipeline run (02:07 UTC 2026-05-06).
Check GitHub maintainer row count post-run. Target: 600+ unique packages.
If still low, investigate GraphQL null returns for psf/requests, numpy/numpy, django/django.
Then Guardian: final sign-off on live system with complete data.

## Project Location
/mnt/d/PERSONAL/Raghav/Project/Main Projects/desk/

## MVP Scope (locked)
IN:
- PyPI top 1,000 packages only
- 4 data sources: PyPI API, GitHub GraphQL API, OSV.dev, deps.dev
- Risk score: numeric (x.x/10) + label (CRITICAL/HIGH/MEDIUM/LOW) + trend arrow
- 5 outputs: blast radius graph, risk score card, maintainer card, 12-month trend line, blast radius count
- Refresh: event-driven PyPI feed + 24hr GitHub maintainer check
- Storage: BigQuery on GCP (Coach has existing account)
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
✓  1  BigQuery schema setup (create_schema.py)
✓  2  PyPI ingestion (pypi_ingest.py, bootstrap.py, utils/)
✓  3  GitHub GraphQL ingestion (github_ingest.py)
✓  4  OSV CVE ingestion (osv_ingest.py)
✓  5  deps.dev ingestion (deps_dev_ingest.py)
✓  6  dbt staging models (5 SQL + project config)
✓  7  dbt intermediate models (3 SQL)
✓  8  dbt mart models + schema tests
✓  9  Risk scoring (risk_score.py)
✓ 10  JSON export (graph_export.py)
✓ 11  React frontend (13 files — Vite + ReactFlow + dagre)
   12  GitHub Actions workflows — NEXT
