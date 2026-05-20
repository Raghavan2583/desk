# DESK — A Documentary Series

## Episode 4: Turning Raw Data into Intelligence

---

Raw data is not intelligence. It is potential.

After four ingestion scripts run against four APIs, what you have is a set of database tables full of JSON blobs, timestamps, and API responses. That data can answer questions about any individual package — when did this repo last get a commit? How many CVEs does this package have? But it cannot answer the question DESK was built to answer: *how risky is this package, relative to everything else, right now?*

Turning raw API responses into a risk score involves three layers of work: cleaning and deduplicating the raw data, computing derived metrics, and running a weighted formula that produces a number humans can act on. This is where dbt and the scoring engine come in.

---

### Three Layers, One Truth

dbt structures data transformation into layers. The convention I followed was: raw tables store everything the APIs return (append-only, never modified), staging models deduplicate and clean, intermediate models compute aggregations, and mart models produce the final consumption-ready tables.

The layering is not bureaucracy. It is a discipline that prevents a specific class of bug: the one where you transform raw data differently in two places, produce two different results, and spend an afternoon figuring out which one is correct.

With three layers, there is one place where deduplication happens (staging), one place where aggregations are computed (intermediate), and one place where everything is joined for final consumption (marts). When a bug appears, you know which layer to look at based on what kind of bug it is.

**Staging** (5 models): Each staging model takes one raw table and produces one deduplicated, clean view of the current state. For example, `stg_github_maintainers` takes `raw_github_maintainers` — which has multiple rows per repository because the pipeline runs daily — and keeps only the most recent row per GitHub URL. It also computes a derived field: `activity_label`. If the repository's last commit was within 30 days, it is ACTIVE. Within 90 days: SLOW. Within a year: STALE. Beyond a year, or if the repository is archived: ABANDONED. This label is used downstream in the risk score and displayed directly in the UI.

**Intermediate** (3 models): This is where aggregations happen. `int_cve_summary_per_package` groups all CVEs by package and counts how many are CRITICAL, HIGH, MEDIUM, and LOW. `int_dependency_metrics` computes blast radius (how many top-1,000 packages depend on this one) and maximum dependency depth. `int_packages_resolved` joins PyPI metadata with timing data to produce one clean row per package.

**Marts** (3 models): The final shape consumed by the scoring script. `dim_packages` is one row per package with all the metadata. `dim_maintainers` is one row per GitHub repository. `fact_dependencies` is one row per dependency edge.

---

### The JOIN That Matters

There is one SQL decision in the transformation layer that is worth explaining explicitly because getting it wrong silently produces incorrect results.

In `int_dependency_metrics`, two data sources are combined: the dependency edges (which packages depend on which) and the dependent counts (how many packages depend on each package). The natural instinct is a LEFT JOIN from the dependency edges table, bringing in the dependent counts where available.

This is wrong for DESK's data.

Consider a package like `certifi` — the certificate bundle. It is listed as a dependency by many other packages, so it has a high dependent count. But `certifi` itself has no dependencies. Its row in the dependency edges table does not exist.

A LEFT JOIN from the edges table would give `certifi` a null dependent count. The blast radius calculation would be wrong. The 20% of the risk score that comes from depth would be wrong for every package that is a pure dependency (all downstream, no upstream).

The correct join is FULL OUTER JOIN. It keeps every row from both tables, matching where possible and filling nulls where not. Packages with no outgoing edges (like `certifi`) get their correct dependent count. Packages with no incoming edges get their correct depth. The math works.

This is a bug that would not have caused a pipeline error. It would have produced subtly wrong risk scores for a class of packages without any obvious signal. The fix is one word in a SQL query. Finding it requires knowing what the data should look like.

---

### The Optional Extras Problem

Before the scoring script ran for the first time, there was a data problem hiding in the dependency edges that needed to be caught at the transformation layer.

Python's packaging format — PEP 508 — allows packages to declare optional dependencies. These are listed in `requires_dist` with a condition like `; extra == 'dev'` or `; extra == 'docs'`. They mean: install this additional package only if the user requests the `dev` or `docs` extra when installing.

The original ingestion script treated all `requires_dist` entries equally — required or optional, they all became edges in the graph. This produced a surprising result: 53% of all dependency edges in the top-1,000 were optional extras.

The practical consequence: packages like `flask` showed `pytest` as a dependency, because `pytest` is listed as a development dependency. The blast radius count for packages like `pytest` was dramatically overstated, because it appeared to be required by every package that listed it as an optional test dependency.

The fix was implemented in the dbt staging model for dependencies: parse each `requires_dist` entry and check whether it contains `; extra ==`. If it does, mark `is_optional = TRUE`. In the intermediate model for dependency metrics, only `is_optional = FALSE` edges are counted toward the blast radius.

Optional extras are still stored in the database — they are real data and may be useful for future analysis. But they are not treated as hard dependencies in the risk calculation, because they are not hard dependencies. They are optional installs.

53% of edges being noise is a large number. It means the entire graph was wrong before this fix. Blast radius numbers were inflated for almost every package. The risk scores based on depth were systematically overstated. And none of this would have been obvious from looking at the pipeline output — the numbers would have looked plausible, just wrong.

---

### The Risk Score Formula

The scoring script is the layer where everything comes together. It reads from the mart tables — packages, maintainers, CVE summaries, dependency metrics — and for each of the 1,000 packages, computes four components and combines them into one number.

**Maintainer component (40% of total):**

The core question is: how many days since the last commit to this repository?

| Days since last commit | Base score |
|---|---|
| ≤ 30 days | 0.0 |
| ≤ 90 days | 2.0 |
| ≤ 180 days | 4.0 |
| ≤ 365 days | 6.0 |
| ≤ 730 days | 8.0 |
| > 730 days | 10.0 |

Two adjustments on top: +2.0 if the repository is archived (formally abandoned), +1.0 if there are no commits in the past 90 days even though the repository exists. Capped at 10.0.

If there is no GitHub link — the package has no tracked repository — the score is 5.0, a neutral "unknown." Not the worst, not the best.

**CVE component (30% of total):**

```
cve_raw = critical × 3.0 + high × 2.0 + medium × 1.0 + low × 0.5
cve_score = min(10.0, cve_raw)
```

Weighted by severity. A package with two critical CVEs gets 6.0 before the minimum cap. A package with ten low-severity CVEs gets 5.0. The weighting reflects that a critical vulnerability is not simply "worse" than a low one — it is worse by a specific factor.

**Depth component (20% of total):**

This is the blast radius score. How many of the top-1,000 packages depend on this one?

| Dependents | Score |
|---|---|
| 0 | 0.0 |
| ≤ 10 | 2.0 |
| ≤ 50 | 4.0 |
| ≤ 100 | 6.0 |
| ≤ 200 | 8.0 |
| > 200 | 10.0 |

The rationale: a package that 300 other packages depend on is not just a risk to itself. It is a risk multiplier. If it breaks — from a CVE, from an abandoned maintainer, from a breaking API change — it breaks everything downstream. The depth score reflects this multiplier effect.

**Download trend component (10% of total):**

Compare current monthly downloads to the six-month-ago baseline. A package whose download count is dropping significantly is either being replaced by something better or losing users as its ecosystem contracts.

| Change vs. 6-month baseline | Score |
|---|---|
| > 20% increase | 0.0 |
| > 0% | 2.0 |
| > -10% | 4.0 |
| > -30% | 6.0 |
| > -50% | 8.0 |
| ≤ -50% | 10.0 |

**Final score:**

```python
risk_score = round(
    0.4 * maintainer_score +
    0.3 * cve_score +
    0.2 * depth_score +
    0.1 * download_score,
    1
)
```

The output is a number between 0.0 and 10.0, rounded to one decimal place. The label is derived from the score: ≤ 2.9 is LOW, ≤ 4.9 is MEDIUM, ≤ 7.4 is HIGH, above 7.4 is CRITICAL.

---

### History and Trend

The scoring script writes to two tables. `fact_risk_scores` is truncated and replaced on every run — it always represents the current state of all 1,000 packages. `fact_risk_score_history` is append-only — every run adds a new row per package with the score and a timestamp.

The history table serves two purposes. First, trend detection: by comparing the current score to the score from 25–35 days ago, the system can detect whether risk is rising or falling. A package whose score has increased by 0.5 or more since last month is labeled RISING. A package whose score has dropped by 0.5 or more is labeled FALLING. Everything else is STABLE.

Second, audit trail: if a user asks "why did this package's risk change?", the history table has the answer. You can trace exactly when the score moved and, combined with the component breakdown, understand which factor drove the change.

There is one subtlety in the trend calculation: version detection. If the `RISK_SCORE_VERSION` environment variable changes — meaning the formula itself was updated — all trend_direction values are set to STABLE. Comparing a score computed with one formula to a score computed with a different formula would produce false trend signals. The version gate prevents this.

---

### What the Pipeline Produces

After ingestion, dbt transformation, and scoring, the export script reads from BigQuery and writes three JSON files to the frontend's public directory:

- `graph.json` — all 1,000 nodes and 2,547 edges, loaded once per session
- `index.json` — a lightweight package list for search autocomplete
- `package/{name}.json` — one file per package, loaded on demand when a user searches for or clicks on a package

These files are the bridge between the data pipeline and the visualization. The frontend has no database connection. It reads JSON files. The pipeline writes JSON files. The boundary is clean.

---

*Next: Episode 5 — The Bugs That Hit Harder. Every incident in this project taught something that no tutorial would have.*
