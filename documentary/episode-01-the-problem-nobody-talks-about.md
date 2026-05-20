# DESK — A Documentary Series

## Episode 1: The Problem Nobody Talks About

---

There is a question that nobody in software asks until it is too late.

It is not "does our code have bugs?" — every engineer knows it does. It is not "do we have tests?" — most teams at least pretend to. The question nobody asks is simpler and much more dangerous: *who is maintaining the code we depend on?*

Not our code. Their code. The code we downloaded, pinned to a version, and shipped to production without reading a single line of it.

---

### The Invisible Chain

I work with Python. Most serious Python projects — web backends, data pipelines, ML workflows — carry a `requirements.txt` or a `pyproject.toml` with dozens of entries. These are the packages the project directly depends on. Behind each of those packages are more packages, which depend on more packages still. By the time you actually run your application, you are trusting the work of hundreds of developers you have never met, many of whom you cannot name, some of whom have stopped writing code altogether.

This is not a new observation. Every senior engineer knows this in the abstract. The uncomfortable part is what nobody actually does about it.

There are tools for security scanning. Snyk will tell you if a known CVE exists in one of your dependencies. Dependabot will open a pull request when a new version is released. GitHub shows you a security alert when an advisory is published. These are all useful tools. They all solve a version of the problem.

But they solve a different problem than the one I kept thinking about.

Snyk tells you about *your* code — the specific packages in *your* project. Dependabot watches *your* repository. None of these tools answer a question that I kept coming back to:

**Which packages, across the entire Python ecosystem, represent the highest risk right now?**

Not for my project. For everyone. Which packages are used by hundreds of other packages, maintained by one person who last committed code eight months ago, with three unpatched critical vulnerabilities sitting open?

That is a different question. That is an ecosystem question. And when I looked for a tool that answered it, I found nothing.

---

### The Gap

I started thinking about this seriously after reading about the `xz` incident — a widely-used compression library that was nearly backdoored through a two-year social engineering attack on its sole maintainer. The maintainer was burned out. Nobody noticed. The package had hundreds of millions of downloads.

The terrifying part was not the attack itself. Attacks happen. The terrifying part was that before the attack was discovered, there was no tool you could point at the Python ecosystem and ask: "Show me the packages where one person's burnout could create a cascading failure across thousands of production systems."

That answer existed in the data. PyPI has download counts. GitHub has commit history. OSV has CVE records. The dependency graph — who depends on whom — is publicly available. All of this data was sitting there, unconnected, waiting for something to join it up.

The word that kept appearing in my notes was *blast radius*. If a package goes unmaintained, or gets compromised, or silently breaks — how many other packages does it pull down with it? That number is the most important number in dependency risk, and nobody was computing it at the ecosystem level.

That was the gap. That was what I decided to build.

---

### The Idea Takes Shape

The first version of the idea was too big. I wanted to cover every package manager — PyPI, npm, Maven, Cargo. I wanted company-level exposure mapping: "your company uses 43 packages currently rated HIGH risk." I wanted real-time alerting.

I pulled all of that back. Not because those things are not valuable — they are. Because trying to build everything at once is how projects die before they ship. I needed one thing to prove the concept, do it well, and make it real.

So I drew a boundary: PyPI only. Top 1,000 packages by monthly download count. These 1,000 packages cover roughly 80% of real-world Python dependency usage. If you are running a Python application in production, the overwhelming majority of your transitive dependencies come from this set.

The core output would be a risk score. Not just a number — a number that explained itself. What is the score, why is it that score, what is the trend, and what is the blast radius if this package goes bad?

The visual I kept coming back to was a knowledge graph. Not a dashboard. Not a table. A graph, because the insight I was chasing was relational: package A depends on package B which depends on package C, and if C disappears, what breaks? You cannot see that in a spreadsheet. You can see it when packages are nodes and dependencies are edges.

I called it DESK. DEpendency riSK. The name came later than the idea, but it fit.

---

### Before the First Line of Code

Before I wrote a single line of Python or SQL, I spent time on the design. Not because I enjoy writing documents — I do not. Because the worst outcome is building something fast that solves the wrong problem.

The questions I had to answer before touching a keyboard:

*What data sources will feed this?* PyPI's JSON API for package metadata. GitHub's GraphQL API for maintainer activity. OSV.dev for CVE records. deps.dev for dependency edges.

*How will I store and transform it?* BigQuery for storage — I had an existing GCP account, 10GB free per month, native dbt support. dbt Core for transformation — free, industry standard, runs anywhere.

*What does the risk score actually measure?* This took the longest. I settled on four factors with explicit weights: maintainer activity (40%), CVE severity (30%), dependency depth (20%), download trend (10%). The weighting was deliberate. Maintainer health is the factor nobody else weights highly, and it is the most predictive of future risk. A package with no CVEs today but an abandoned maintainer is a time bomb. I wanted DESK to say so.

*How does the frontend work?* React with React Flow for the graph visualization. Vercel for hosting. Static JSON export from BigQuery so the frontend has no database dependency — just files served over a CDN.

*How does the whole system stay live?* GitHub Actions on a schedule. Daily refresh at 02:07 UTC. Commit updated data to the repo. Auto-deploy to Vercel.

I wrote all of this down before opening a code editor. I am glad I did. The design decisions I made in that phase shaped every piece of code that followed, and changing them mid-build would have been expensive.

---

### The First Commit

The first commit to the DESK repository was a README with one paragraph and a blank Python file.

There was no code yet. No data. No frontend. Just a problem statement and a design that lived in notes.

What there was — what I think matters more than the code — was a clear answer to the question: *what is this, and why does it need to exist?*

DESK maps the dependency chain before it breaks, not after. It answers the question that no existing tool answers: which packages threaten the most systems right now? It turns publicly available but disconnected data — PyPI metadata, GitHub commit history, CVE records, dependency edges — into a single risk score per package, updated daily, displayed as an interactive graph.

That answer did not change as the project grew. The code changed constantly. The design evolved. Bugs appeared and were fixed. APIs disappeared overnight. The CI/CD pipeline broke in creative new ways.

But the problem never changed. And having a clear answer to "what is this?" meant that every decision along the way had something to be tested against.

That clarity is what let this ship.

---

*Next: Episode 2 — Designing Before Building. Before any code, every major decision had to be made — and written down — with a reason that would hold up six weeks later.*
