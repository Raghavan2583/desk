# DESK — DEpendency riSK
### Project Overview for Review

---

## What is DESK?

DESK is a knowledge graph that maps open-source software dependency risk across the Python ecosystem.

A user types any Python package name and immediately sees:
- How many other packages depend on it (blast radius)
- A risk score — numeric, labelled, with a trend direction
- Maintainer health — is a human actively watching this package?
- CVE exposure — known vulnerabilities and severity
- A 12-month risk trend — is this getting safer or more dangerous?

The insight comes from the **connections**, not just the data. DESK reveals the chain before it breaks — not after.

---

## The Problem

Every product company today runs on open-source packages maintained by volunteers. When a package goes unmaintained, gets abandoned, or gets deliberately compromised — nobody sees it coming in advance.

The tools that exist today (Snyk, Dependabot, OSV) tell you about **your** dependencies. They answer: *"Is my app safe?"*

Nobody has built a tool that watches the **entire ecosystem** and answers: *"Which packages threaten the most applications?"*

That is the gap DESK fills.

A single unmaintained package like `log4j` can sit silently in thousands of dependency chains across hundreds of companies. The damage happens because nobody was watching the chain — only the endpoints.

---

## How DESK Works

DESK pulls data from four public sources every day:

| Source | What it provides |
|---|---|
| PyPI API | Package metadata, version history, download counts |
| GitHub GraphQL API | Maintainer activity, commit frequency, repo health |
| OSV.dev | CVE vulnerabilities per package, severity |
| deps.dev | Dependency graph edges, transitive depth |

This data is stored in **BigQuery**, transformed using **dbt**, and the final risk score is computed using a weighted formula:

> **Risk Score = Maintainer Activity (40%) + CVE Count (30%) + Dependency Depth (20%) + Download Trend (10%)**

Maintainer health carries the highest weight because that is the gap existing tools ignore. CVEs alone are already tracked by others. A package with zero CVEs but an inactive maintainer for 18 months is a ticking clock.

The output is a **React frontend** with an interactive graph, risk score card, maintainer card, and trend line — deployed on Vercel.

---

## MVP Scope

### What we are building

- Python ecosystem (PyPI) — top 1,000 packages by download count
- 5 outputs per package: blast radius graph, risk score card, maintainer card, 12-month trend line, blast radius count
- Event-driven refresh on new PyPI releases + 24-hour GitHub maintainer check
- Fully automated pipeline: zero manual intervention after deployment
- Public frontend on Vercel — no login, no accounts, no friction

### What we are explicitly not building yet

- npm, Maven, NuGet, CRAN — post-MVP, one ecosystem at a time
- Company exposure mapping — which orgs are downstream of a risky package
- User accounts or authentication
- Alerts or notifications
- Mobile frontend
- "What breaks first" — propagation ranking by dependency depth
- Replacement package suggestions

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Storage | BigQuery (GCP) | Existing account, free tier sufficient for MVP, native dbt support |
| Transform | dbt Core | Industry standard, free, runs on GitHub Actions |
| Scheduler | GitHub Actions | Free tier (2,000 min/month), no extra infrastructure |
| Frontend | React + React Flow | Purpose-built for graph visualisation, free, professional output |
| Hosting | Vercel | Always on, no cold starts, free tier sufficient |
| APIs | PyPI, GitHub GraphQL, OSV.dev, deps.dev | All free public APIs |

**Total infrastructure cost at MVP: $0/month.**

---

## Build Plan

### Phase 1 — Design *(in progress)*
Blueprint designs the complete data model, ingestion pipeline, dbt layer structure, risk scoring formula, and API contract. Zero open questions before building starts.

### Phase 2 — Develop
Striker builds in 12 strict increments — each tested and Guardian-approved before the next begins. Nothing merges without explicit quality sign-off.

Key increments:
1. BigQuery schema and dataset setup
2–5. Four ingestion scripts (PyPI, GitHub, OSV, deps.dev)
6–8. dbt models (staging → intermediate → mart)
9. Risk scoring engine with trend calculation
10. JSON graph export for frontend
11. React frontend with graph visualisation
12. GitHub Actions workflows (daily refresh + event trigger)

### Phase 3 — Deploy
Operator configures GCP, GitHub secrets, and Vercel. Initial data load of 1,000 packages. End-to-end verification on 3 test packages before go-live.

### Phase 4 — Operate
Pipeline runs unattended. Health monitored each session. Learnings from real usage feed back into the next design cycle.

---

## Known Limitations and Future Fixes

These are real constraints we know about. None of them block the MVP. All of them are worth planning for before we scale.

---

**Limitation 1 — Data freshness depends on the event feeds**

If PyPI's event feed is delayed or misses a release, our graph is stale and we won't know it. A compromised package could show as safe for hours.

*Future fix: Add a lightweight weekly full-scan as a safety net — not every 6 hours, just weekly. Catches anything the event feeds missed.*

---

**Limitation 2 — We only watch what we already know**

We start with the top 1,000 packages. The next log4j could be package number 1,001 — obscure, deeply embedded, and completely outside our watch list.

*Future fix: Track download velocity. If a previously small package suddenly sees 10x downloads, pull it into the watch list automatically. The ecosystem signals what's becoming critical before it officially is.*

---

**Limitation 3 — GitHub API rate limits will constrain scale**

As user searches increase and on-demand fetches grow, GitHub's free tier will start to choke. The current architecture handles MVP load comfortably — it will not handle 10,000 packages or heavy concurrent usage without adjustment.

*Future fix: Aggressive caching layer. If a package was searched 10 minutes ago, serve the cached result. Most packages don't change minute to minute. Pair this with a token rotation pool for high-volume periods.*

---

**Limitation 4 — Risk scores can be gamed**

A malicious actor maintaining a package could fake activity — push empty commits, keep the repo looking alive — while planning a supply chain attack. Our current formula counts commit frequency, not commit quality.

*Future fix: Score commit quality, not just frequency. One real dependency fix outweighs 50 empty commits. Harder to fake, more signal-accurate.*

---

**Limitation 5 — If DESK becomes trusted, it becomes a target**

If this platform becomes the go-to source for OSS risk, attackers will try to manipulate scores — surfacing a safe package as risky to drive migration, or hiding a dangerous one.

*Future fix: Open-source the scoring algorithm. If anyone can see exactly how scores are calculated, score manipulation becomes visible and verifiable. Transparency is the defence.*

---

## Why This Project

- **Gap in the market**: no tool watches ecosystem-wide chain risk, only app-specific exposure
- **Real problem**: supply chain attacks are rising — SolarWinds, XZ Utils, PyTorch — all followed the same unmaintained-maintainer pattern
- **Defensible approach**: graph model reveals connections flat tools cannot; weighted scoring prioritises the human risk factor others ignore
- **Zero cost to run**: entire MVP on free tiers — GCP, GitHub Actions, Vercel, all public APIs
- **Built to scale**: skeleton for token rotation, priority queues, and exponential backoff wired from day one

---

*DESK — Built by Raghav | 2026*
