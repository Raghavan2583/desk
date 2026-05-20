# DESK — A Documentary Series

## Episode 8: Looking Back at the Journey

---

Build the same system twice. The second time will be half the code and twice as good.

I have only built DESK once. But I know exactly what I would do differently if I built it again, because the project taught me — in the most concrete way possible — the difference between decisions that aged well and decisions that did not. This is the honest accounting.

---

### What DESK Is Now

DESK is a live system. It tracks 1,000 PyPI packages. It runs a data refresh every morning at 02:07 UTC. It ingests from four data sources, transforms through three dbt layers, computes a four-factor risk score, exports 1,002 JSON files, and deploys an updated frontend to Vercel — all in under 20 minutes, unattended, every day.

The frontend shows a dependency graph for any of the 1,000 tracked packages. It shows the blast radius (how many packages break if this one fails), the risk score with a factor breakdown, the CVE list with patch status, the maintainer health, the 12-month risk trend, and an actionable recommendation. The homepage shows the ecosystem's highest-risk packages before the user types a single character.

The data is fresh. The pipeline is stable. The system requires no manual intervention on normal days.

That is the outcome. The journey to it was not smooth.

---

### The Decisions I Am Proud Of

**GraphQL from day one.** I could have started with REST and deferred GraphQL for later. I would have paid the cost of that deferral when the pipeline needed to be rewritten. Starting with GraphQL meant the GitHub ingestion was efficient from the first run — 50 API calls for 1,000 packages, not 1,000 API calls.

**Exponential backoff built fully in the MVP.** This was a 10-line utility. It is not impressive code. But it meant the pipeline never failed silently under rate limiting. Every retry was handled, jittered, capped. Not building it and retrofitting it later would have meant touching every ingestion script at once.

**Knowledge graph over dashboard.** The graph is not just a visualization choice — it is the architecture. The insight that dependency risk is relational, not just per-package, is only visible in a graph. A dashboard would have been faster to build and wrong for the problem.

**Designing before coding.** The 12 decisions made before the first line of code was written saved more time than the design phase cost. When a question came up during development — "what should the risk formula look like?" or "how do we handle packages with no GitHub link?" — the answer was already written down with its reasoning.

**The three-layer dbt architecture.** Raw tables are append-only truth. Staging deduplicates. Intermediate computes aggregations. Marts are the final consumption layer. This structure made every transformation testable, readable, and debuggable. When something was wrong in the data, the layering told me exactly which layer to look at.

---

### The Decisions I Would Make Differently

**Validate all APIs in week one, before building the ingestion scripts.** I found out that deps.dev's `/dependencies` endpoint returned 404 when the ingestion script that depended on it was already built and integrated into the pipeline. A 30-minute validation pass — make a request to each endpoint, check the response format, verify the fields I need exist — would have found this before it was a problem.

**Schema validation from the first commit, not after the first failure.** The `validation.py` utility that validates API responses against JSON schema was added after the silent GitHub failure, not before it. If validation had been in place from the start, the 762 null maintainer rows would have failed loudly on the first run rather than silently producing wrong data.

**End-to-end testing before claiming anything works.** After a pipeline run, the verification should be: check the live URL. Does it show today's data? Not: did the pipeline exit with code 0? The exit code tells you whether the code ran without crashing. The live URL tells you whether the system is working. These are not the same question.

**Simpler deployment from the start.** The Vercel deployment story went through three iterations: manual CLI → Vercel's GitHub integration (broken by `[skip ci]`) → separate workflow (broken by bot push rule) → deploy step inside the daily pipeline. The third iteration is the correct one. If I had thought through the full chain — pipeline commits, GitHub bot rule, separate workflow trigger — the right architecture would have been obvious. Instead it took three incidents and three rewrites.

---

### The 12 Incidents

Over the lifetime of DESK, there were twelve incidents worth naming:

1. **Silent GraphQL batch failures** — 762 of 900 packages with null maintainer data. Fixed by raising on error instead of warning.
2. **Streaming insert limits** — BigQuery free tier blocks streaming, large rows break the limit. Fixed by switching to load jobs.
3. **deps.dev API removal** — Alpha endpoint disappeared without notice. Fixed by parsing `requires_dist` locally.
4. **OSV body stall** — Single timeout did not catch body stalls. Fixed by tuple timeout.
5. **OSV MODERATE→MEDIUM mapping** — All MODERATE CVEs scored as zero. Fixed by explicit severity mapping.
6. **Optional extras pollution** — 53% of dependency edges were optional extras. Fixed by filtering in dbt.
7. **Search prefix limitation** — Substring package names were unfindable. Fixed by substring matching.
8. **Homepage communicates nothing** — Blank search box gives users no value before interaction. Fixed by homepage-as-dashboard.
9. **`[skip ci]` blocking Vercel** — Automated commits blocked deployment. Fixed by removing `[skip ci]`.
10. **Bot push not triggering deploy workflow** — GitHub security rule prevents bot commits from triggering workflows. Fixed by deploying inside the daily pipeline.
11. **Race condition on git push** — Two concurrent workflows both writing to main. Fixed by shared concurrency group + rebase before push.
12. **Data freeze on May 20** — Same bot push problem, recurring after workflow changes removed the deploy step. Fixed by restoring the deploy step.

Not every incident was a bug in the code. Some were external changes (deps.dev). Some were misunderstandings of platform behavior (`[skip ci]`, bot push). Some were data model assumptions that turned out to be wrong (optional extras). But every incident was a real problem that produced incorrect results or a broken system, and every fix made the system more robust than before.

---

### The Number That Surprised Me Most

Fifty-three percent.

Before filtering optional extras from the dependency graph, 53% of all edges in the dataset were optional dependencies — packages listed in `requires_dist` with `; extra ==` conditions. Development dependencies, documentation dependencies, testing dependencies, optional feature dependencies.

That means more than half the graph was noise. Blast radius counts were wrong for almost every package. Risk scores based on depth were systematically inflated. The graph showed relationships that were not actually dependencies.

I discovered this by looking at the data — specifically, by noticing that `pytest` appeared as a dependency of nearly every major package. That is not correct. `pytest` is a development dependency that nobody ships to production as a hard requirement. Once I found one obviously wrong edge, I counted all of them.

The fix required one additional column in the staging model and a filter in the intermediate model. The code change was small. The impact on data accuracy was large.

This is the kind of thing that only surfaces when you look at the data with skepticism rather than trust. A pipeline that runs without errors produces data. It does not guarantee correct data. Looking at the data — not just the exit codes, not just the row counts, but the actual values — is the only way to find this class of problem.

---

### What DESK Proves

DESK is a solo project. It was designed, built, debugged, and shipped by one person. It touches four external APIs, a cloud data warehouse, a transformation framework, a risk scoring algorithm, an interactive graph frontend, and a CI/CD pipeline. It runs unattended every day.

This was achievable not because the problem was simple — it was not — but because the right tools eliminated entire categories of infrastructure work. BigQuery handles storage, querying, and access control. dbt handles SQL transformation with testing and documentation built in. GitHub Actions handles scheduling, secret management, and environment setup. Vercel handles global static hosting with zero configuration. React Flow handles graph rendering.

The engineering work — the thinking, the debugging, the design decisions — still required significant effort. But the infrastructure was not built from scratch. The right tools were chosen for the right reasons, and the combination made a solo production-grade data system achievable in months rather than years.

This matters because the perception in the industry is that "production-grade" implies a team. A data engineer for the pipeline. A backend engineer for the API. A frontend engineer for the UI. An SRE for the deployment infrastructure. DESK challenges that assumption. With the right architecture and the right tools, one engineer can build and operate a system that legitimately belongs in that category.

---

### Where DESK Goes

The MVP scope was intentionally tight: PyPI only, top 1,000 packages, four data sources. Everything else was explicitly deferred.

What comes next, in rough order of value:

**Company exposure mapping.** The question "which packages in the ecosystem are risky?" becomes more urgent when the question is "which risky packages does *my company* depend on?" This requires accepting a company's `requirements.txt` and showing which of the 1,000 tracked packages are in their dependency tree, ranked by risk.

**npm ecosystem.** Python is one ecosystem. JavaScript is larger. The same pipeline architecture — ingest, transform, score, export — applies. The data sources differ (npm registry instead of PyPI, GitHub is the same, OSV covers npm), but the model is transferable.

**Alerting.** DESK currently shows risk scores on demand. A more valuable product would proactively notify when a package's risk score crosses a threshold — a previously LOW package becomes HIGH, a maintainer goes silent, a critical CVE is published. The data for this exists. The alerting layer does not.

**Priority-based refresh.** The scheduler queue has a `priority` column built in but unused. High-blast-radius packages that release new versions should trigger immediate re-scoring, not wait for the daily refresh. The hourly event trigger does this for a curated list of 48 packages. Expanding this to the full 1,000 based on computed priority is the next step.

---

### The Journey

I started DESK with a question: why does no tool watch the ecosystem rather than just your project?

I ended with an answer: one does now.

Between the question and the answer was a design phase that made decisions that survived implementation pressure, an ingestion layer that battled four APIs and won three and rebuilt one, a transformation layer that turned raw data into a risk signal, a scoring formula that weighted maintainer health as the leading indicator that other tools ignore, a frontend that made risk readable to people who do not write code, a CI/CD pipeline that broke in twelve ways and came back stronger each time, and a deployment that is now stable enough to run unattended.

The bugs were real. The wrong assumptions were real. The incidents that happened in front of managers were real. The debugging sessions at 2am were real.

So is the live system tracking 1,000 packages at `https://frontend-sand-seven-57.vercel.app`, refreshed daily, answering a question that no other tool answered before.

That is what building looks like. Not a clean line from idea to finished product. A series of decisions, each with a reason, each tested against reality, each either holding or failing and being replaced with something better.

The question nobody was asking — *who is watching the packages your system depends on?* — still does not have a widely-known answer in the industry.

DESK is one answer. Built alone. Running daily. Watching 1,000 packages so that the people who depend on them do not have to watch in the dark.

---

*End of the DESK Documentary Series.*

---

**DESK** — DEpendency riSK  
Live at: https://frontend-sand-seven-57.vercel.app  
Pipeline: GitHub Actions · 02:07 UTC daily  
Stack: Python · BigQuery · dbt · React · Vercel  
Scope: PyPI top 1,000 · 4 data sources · daily refresh  
Built: 2026
