# DESK — Demo Script
# Audience: Superiors | Time: ~8 minutes
# URL: https://frontend-sand-seven-57.vercel.app
# Last updated: 2026-05-06

## Opening (30 sec)

> "DESK answers one question: if a package fails tomorrow, how many projects go
> down with it — and did anyone see it coming? Let me show you."

---

## Act 1 — Blast Radius (2 min)
**Package: `typing-extensions`**

Search → `typing-extensions`

> "This package is the backbone of Python's type system. Blast radius: **149** —
> meaning 149 of the top 1,000 most-downloaded Python packages depend on it.
> Before DESK, that number didn't exist anywhere. Nobody had it."

Point to risk score — **LOW 2.1**

> "Risk is LOW. Why? Committed to 2 days ago, active contributors, no known CVEs.
> High blast radius doesn't automatically mean high risk. DESK separates the two."

Point to graph — right column = who depends on it, left column = what it depends on.

> "The dependency web, at a glance."

---

## Act 2 — The Contrast (2 min)
**Package: `tqdm`**

Search → `tqdm`

> "Compare with tqdm — the progress bar library in every ML project."

Point to: MEDIUM risk, blast=19, days since last commit=91, activity=STALE

> "Blast radius is smaller. But last commit was 91 days ago. Activity is STALE.
> This is exactly the signal DESK surfaces before it becomes an incident.
> You wouldn't see this on the PyPI page."

> "Without DESK: you find out when it silently breaks in production.
> With DESK: you see the trend moving before it becomes your problem."

---

## Act 3 — Score Components (1.5 min)
**Package: `grpcio`**

Search → `grpcio`

> "grpcio — Google's RPC framework. Blast radius 69. MEDIUM risk at 4.4."

Point to score breakdown: maintainer / CVE / depth / downloads

> "Four signals, weighted into one score: maintainer health, known CVEs,
> dependency depth, and download trend. grpcio is MEDIUM — active maintenance,
> some CVE exposure. On the watchlist, not the critical list."

---

## Act 4 — Accuracy (1.5 min)
**Package: `hypothesis`**

Search → `hypothesis`

> "One thing we obsessed over was accuracy. A naive approach would pull every
> line from a package's dependency spec — including optional extras like dev
> tools and test runners."

Point to Depends On: **sortedcontainers**, **exceptiongroup** only

> "DESK filters those out. Hypothesis only truly requires these two packages.
> Optional extras don't count toward blast radius or risk score. The graph
> reflects what actually breaks — not what a developer might optionally install."

---

## Close (30 sec)

> "1,000 packages. Refreshed daily. Four signals per package. One number that
> didn't exist before: blast radius. The question DESK answers is: which packages
> are the single points of failure for the Python ecosystem? Now we have that
> answer."

---

## Key Numbers (have ready)
- Total packages indexed : 1,000
- CRITICAL risk packages  : 38
- Highest blast radius    : typing-extensions at 149
- Pipeline refresh        : daily at 02:07 UTC

## Packages to Avoid in Live Demo
requests, numpy, django, flask — maintainer data still loading for this cohort,
maintainer card will appear blank. Blast radius numbers are accurate.
If asked: "Popular packages like requests are indexed — blast radius is correct —
maintainer health data is still completing for the highest-traffic repos."
