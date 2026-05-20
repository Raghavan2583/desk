# DESK — A Documentary Series

## Episode 2: Designing Before Building

---

The most dangerous moment in any engineering project is when you have a working idea and an empty editor.

The temptation is immediate and almost physical: *start writing code*. You know what you want to build. You are excited. The shape of the thing is clear in your head. Sitting and thinking about it longer feels like procrastination.

It is not procrastination. It is the difference between building something and then redesigning it under pressure — and getting the design right before any code depends on it.

DESK was built design-first. Every major decision was made before the first ingestion script was written, and every decision was documented with its reason. This is what that process looked like.

---

### The First Decision: What Kind of Data Structure

The most fundamental question was not "what data do I collect?" It was "how do I model what I collect?"

The obvious answer is a dashboard. Packages in rows. Scores in columns. Sort by risk. Done. Every dependency security tool I looked at used this model, which is precisely why none of them could answer the question I was trying to answer.

A dashboard shows facts. A graph shows relationships. And the thing that makes dependency risk dangerous is not a fact about a single package — it is the relationship between packages. Package A depends on B. B depends on C. C is maintained by one person who last committed in 2022. How many things break if C disappears?

You cannot see that in a dashboard. You can see it when packages are nodes, dependencies are edges, and the graph reveals the chain.

So the first decision, written into the design notes as D001, was: **knowledge graph over dashboard**. Entity-relationship model — packages, maintainers, CVEs, dependency edges — not flat tables. The graph is not a visualization choice. It is an architectural choice. Everything downstream depends on it.

---

### Choosing the Scope

The second decision was harder: what do I actually track?

My first instinct was everything. PyPI, npm, Maven, Cargo. The full picture. Then I looked at the engineering work required to ingest four completely different package registries with four completely different data models and four completely different API behaviors, and I made a different decision.

PyPI only. Python packages. Top 1,000 by monthly download count.

The reasoning: top 1,000 Python packages cover approximately 80% of real-world Python dependency usage. If you are running a Python application in production, most of your transitive dependencies come from this set. It is a meaningful scope, not a toy dataset, and it is achievable for a solo project without sacrificing depth for breadth.

This decision — D002 and D003 in the design log — also had a second rationale. My target context was Indian product companies: Swiggy, Razorpay, Zepto, Meesho. These teams run Python backends. PyPI is their ecosystem. Starting with the ecosystem most relevant to the initial audience is not a limitation. It is a focus.

---

### The Tech Stack: Every Choice With a Reason

I have seen projects collapse under the weight of technology choices made for the wrong reasons. A tool chosen because it is popular, not because it fits. A service chosen because it sounds impressive, not because it is free at the scale needed. I had a rule for DESK: every tool in the stack had to answer four questions before it was locked.

**Why this over the alternatives? What does it cost at scale? What is the free path to the same outcome? What is the exit strategy if this fails?**

Here is how the stack was decided:

**BigQuery (storage):** I had an existing GCP account. BigQuery's free tier gives 10GB storage and 1TB of queries per month — more than enough for 1,000 packages. It has a native dbt adapter. The exit strategy, if GCP billing ever became a concern, is Postgres with the same dbt models. Chosen.

**dbt Core (transformation):** Free. Industry standard. Runs inside GitHub Actions without any additional infrastructure. The alternative was writing SQL transformation scripts manually, which would be harder to test and harder to read six months later. dbt also enforces a three-layer model — raw, staging, marts — that keeps the data pipeline readable. Chosen.

**GitHub Actions (orchestration):** 2,000 free minutes per month. Secret management built in. No additional servers to maintain. The alternative was a cloud scheduler pointing at a Cloud Run instance, which adds cost and operational complexity. For a daily pipeline that runs in 20 minutes, GitHub Actions is the right fit. Chosen.

**React + React Flow (frontend):** React Flow is purpose-built for interactive node/edge graph visualization. The alternative was D3.js — powerful, but requiring extensive custom code to achieve what React Flow provides out of the box. The goal was a production-quality graph visualization, not a charting exercise. Chosen.

**Vercel (hosting):** Always-on, free tier sufficient for static file serving, zero cold starts. The frontend is pure static files — JSON data + React bundle. No server required. Vercel is the cheapest and simplest path to a globally fast static site. Chosen.

---

### Why GraphQL From Day One

This one deserves its own paragraph.

GitHub's REST API requires one HTTP call per repository. To check the maintainer activity of 1,000 packages — each of which has a GitHub repository — that is 1,000 HTTP calls. At GitHub's rate limits, that means waiting. A lot of waiting.

GitHub's GraphQL API allows batching. You can pack 20 repository queries into a single API call using field aliases. 1,000 packages becomes 50 API calls instead of 1,000. That is a 20x reduction in API calls, a proportional reduction in rate limit pressure, and a pipeline that runs in minutes instead of hours.

The temptation with a new project is to start simple: use REST, see if it works, upgrade to GraphQL later if needed. I rejected this. Retrofitting a pipeline from REST to GraphQL after the ingestion layer is built means rewriting the data model, the parsing logic, the error handling, and the tests. It is not an upgrade. It is a rewrite.

GraphQL from day one was decision D009. It cost more upfront. It saved a rewrite later.

---

### The Risk Formula

This was the decision I spent the most time on, because it is the decision users actually see.

Risk is not one thing. A package can be dangerous because it has critical vulnerabilities. It can be dangerous because its maintainer has gone silent. It can be dangerous because 400 other packages depend on it, and if it breaks, so do they. It can be dangerous because its download count is dropping, suggesting the ecosystem is moving away from it.

I needed a formula that captured all of this, weighted by what actually mattered most, and explained itself clearly.

The formula I settled on:

```
risk_score = 0.4 × maintainer_health
           + 0.3 × cve_severity
           + 0.2 × blast_radius
           + 0.1 × download_trend
```

The 40% weighting on maintainer health was deliberate. Every other tool weights CVEs highest, because CVEs are concrete and measurable. I weighted maintainer health highest because it is the leading indicator that other tools ignore. A package with no CVEs today but an abandoned maintainer is a future CVE waiting to happen. DESK needed to say so before it happened.

The 30% CVE weighting is not dismissed — critical vulnerabilities matter. But a package with a known CVE and an active maintainer who is working on a fix is a very different risk from a package with a known CVE and a maintainer who has not committed in two years.

The output format was also deliberate: a label (CRITICAL / HIGH / MEDIUM / LOW) for executives and non-technical readers, a numeric score (X.X / 10) for engineers who want precision, and a trend arrow showing whether risk is rising or falling over time.

---

### The Skeletons Built In From Day One

There were three pieces of infrastructure I built into the first version that I knew I would not use until later but would be expensive to retrofit:

**Token rotation.** GitHub imposes API rate limits per token. One token handles 1,000 packages comfortably, but a second token would double the headroom. I built a `token_pool.py` utility that reads from an environment variable `GITHUB_TOKENS='["token1", "token2"]'`. In the MVP, it always returns the first token. Adding a second token later requires changing one environment variable, not touching the code.

**Priority queue.** The scheduler queue has a `priority` column. In the MVP, everything has priority 1. Post-MVP, newly published packages and packages with rising CVE counts can be promoted to priority 2 and refreshed more frequently. The column is there. The logic to use it is not. Adding it later is a configuration change, not a schema migration.

**Exponential backoff.** Every HTTP call in every ingestion script goes through a `retry_with_backoff()` utility: retries on 429 and 5xx, doubles the wait time on each retry, adds random jitter so concurrent requests do not all retry at the same moment. This cost ten lines of code to build. Not building it and then having the pipeline fail silently under rate limiting would cost far more.

These skeletons are a design principle: build the extension points for the things you know you will need, even if you do not need them yet. The cost of building them early is low. The cost of retrofitting them after the rest of the system depends on their absence is high.

---

### What the Design Phase Produced

By the time the design phase was finished, the DECISIONS.md file had 12 locked decisions, each with its rationale. Blueprint — the design system I used to think through architecture — had answered every open question before Striker — the build phase — started.

The design did not answer every technical question. That is not what design is for. There were unknowns that only became apparent when code hit real APIs for the first time. But the design answered the questions that are expensive to change mid-build: data model, tech stack, scoring formula, refresh architecture.

The first line of real code was written knowing exactly what it was building, why, and what it connected to. That is not a small thing.

---

*Next: Episode 3 — Four APIs, Four Battles. Every data source had a hidden trap. None of them advertised it in the documentation.*
