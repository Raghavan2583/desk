# DESK — DEpendency riSK

A knowledge graph that maps open-source dependency risk across the PyPI ecosystem.
Type any Python package name and see how much of the ecosystem depends on it, how
healthy its maintainers are, what CVEs it carries, and whether that risk is rising
or falling.

**Live site:** https://frontend-sand-seven-57.vercel.app

---

## The problem

Every Python project depends on packages maintained by volunteers, with no SLA and
no obligation to keep going. When a maintainer disappears or a package gets
compromised, nobody in the ecosystem is watching for it — tools like Snyk or
Dependabot only tell you about *your own* dependencies. Nobody answers the bigger
question: **which packages threaten the most projects if they fail?**

DESK watches the top 1,000 most-downloaded PyPI packages and answers that question
directly.

## What you see

Search any package and get:
- **Blast radius** — how many of the top 1,000 packages depend on it
- **Risk score** — CRITICAL / HIGH / MEDIUM / LOW, plus a numeric score (x.x / 10) and trend arrow
- **Maintainer health** — last commit, contributor count, activity status
- **CVE exposure** — known vulnerabilities, severity, and fixed versions
- **12-month trend** — is this package getting safer or riskier over time

## How it works

Four data sources feed the pipeline every day: the **PyPI API**, **GitHub GraphQL
API**, **OSV.dev**, and **deps.dev**. The risk score is a weighted formula —
maintainer activity (40%), CVE exposure (30%), dependency depth (20%), download
trend (10%) — computed by **dbt Core** on top of **DuckDB**, then exported as
static JSON and served by a **React + React Flow** frontend on **Vercel**. The
whole pipeline runs unattended once a day via **GitHub Actions**, entirely on free
tiers.

## Repo structure

```
ingestion/          4 Python scripts pulling from PyPI, GitHub, OSV.dev, deps.dev
dbt/                dbt Core models — staging → intermediate → mart layers
scoring/            Risk scoring engine (weighted formula + trend calculation)
export/             Exports scored data to static JSON for the frontend
frontend/           React + React Flow app (Vite), deployed on Vercel
data/                Committed Parquet history files (risk score + download trends over time)
scripts/            Weekly schema health check against all 4 upstream APIs
.github/workflows/  Daily pipeline (GitHub Actions) + frontend deploy + schema monitor
documentary-site/   Engineering deep-dive site — https://documentary-site-xi.vercel.app
```

## Docs

- **[Slide Deck](https://desk-deck.vercel.app)** — a quick visual walkthrough of the project, for a fast overview before going deeper
- **[Engineering Deep Dive](https://documentary-site-xi.vercel.app)** — the full story: architecture, data model, every real trade-off, and the production incidents that actually happened, including two things I built and later removed once the evidence said they weren't worth keeping
- [`DESK_USER_GUIDE.md`](DESK_USER_GUIDE.md) — how to read the risk score, labels, and dashboard
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — full system design, pipeline steps, and design rationale
- [`DECISIONS.md`](DECISIONS.md) — every locked engineering decision, with the reasoning behind it
- [`LEARNINGS.md`](LEARNINGS.md) — what real debugging on this project taught me

## Tech stack

Python · dbt Core · DuckDB · GitHub Actions · React · React Flow · Vercel

---

*Built by Raghav*
