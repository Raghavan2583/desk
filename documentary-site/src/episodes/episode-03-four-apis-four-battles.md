# DESK — A Documentary Series

## Episode 3: Four APIs, Four Battles

---

Every API has a public face and a private personality.

The public face is the documentation: clean endpoints, example responses, a rate limit section that sounds reasonable. The private personality only shows itself when you are three hours into an ingestion run at 2am and the pipeline has stopped responding and you do not know why.

DESK pulls data from four sources: PyPI, GitHub, OSV.dev, and deps.dev. Each of them had something the documentation did not mention. Here is what each fight looked like.

---

### Battle One: PyPI — The Clean One (With a Catch)

PyPI's JSON API is, by any standard, a pleasant API to work with. One endpoint, `pypi.org/pypi/{package}/json`, returns everything: name, latest version, summary, author, dependencies, project URLs. The response is consistent. The rate limits are generous. The documentation is accurate.

The catch was not in PyPI itself. It was in what PyPI does not reliably provide: a link to the package's GitHub repository.

Maintainer health — the 40% weighting in the risk formula — requires a GitHub URL for each package. PyPI stores `project_urls`, a dictionary of links that the package author has chosen to include. Some packages include a GitHub link labeled "Source" or "Repository." Others include a homepage link that happens to point to GitHub. Others include nothing useful. A small but meaningful percentage provide no external links at all.

For the packages with no GitHub link, I built a fallback: the GitHub Search API. Take the package name, search GitHub repositories, take the top result. It works — most of the time. The cost is rate limiting: GitHub Search allows roughly 30 requests per minute for authenticated users, so this fallback cannot run on all packages simultaneously. It runs where needed, with a 2.1-second wait between requests.

The elegant part of this solution: once a GitHub URL is discovered, it is written to the raw database table. The next time the pipeline runs, the URL is already there. The expensive search-and-discover step only ever runs once per package. After that, it is a database read.

This is a principle worth naming: *expensive lookups should happen once and be cached*. The architecture should make that easy.

---

### Battle Two: GitHub — The Silent Failure

GitHub's GraphQL API was the right technical choice from day one — batching 20 repository queries per API call instead of 1,000 individual REST calls. The implementation uses field aliases:

```graphql
query {
  repo_0: repository(owner: "psf", name: "requests") {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 1) {
            nodes { committedDate }
          }
        }
      }
    }
  }
  repo_1: repository(owner: "numpy", name: "numpy") { ... }
  # ... 18 more repositories
}
```

One HTTP call. Twenty repositories. Clean, efficient, exactly what the design called for.

The problem was what happened when this call failed.

GraphQL has a behavior that trips up almost everyone who encounters it for the first time: a failed GraphQL request returns HTTP 200. Not 400, not 500. 200. The error information lives in an `errors` field in the JSON response body.

The original code checked the HTTP status code. 200 meant success. The `errors` field was logged as a warning and the loop continued. This seemed reasonable — maybe some repositories had a minor issue, but the batch would still produce data for the others.

It did not.

When a batch of 20 repositories hit GitHub's "Resource limits exceeded" error — which happens when the query touches too many nodes — the entire batch fails. All 20 repositories return empty data. But the code was logging a warning and marking them as complete.

The result: after the first full pipeline run, 762 of 900 packages had null maintainer data. Null commit dates. Null contributor counts. The maintainer health score — 40% of the total risk score — was missing for 85% of packages.

There was no pipeline failure. No alert. No indication anything was wrong. The runs completed successfully. The data was silently wrong.

The fix required three changes: reduce the batch size from 50 to 20 (fewer nodes per query, less likely to hit the limit), add a 2-second sleep between batches (to avoid sustained high query rates), and — the most important change — replace the warning log with a raised exception. If a batch fails, the batch fails loudly. The pipeline stops. The data does not silently miss 85% of packages.

Coverage went from 138 maintainer rows to 888 maintainer rows after this fix.

The lesson: **a warning that does not stop the pipeline is not a warning. It is a silence.** Log as warning only when the partial result is acceptable. If the result of ignoring an error is that 85% of your data is wrong, the error should stop everything.

---

### Battle Three: OSV — The Timeout Trap

OSV.dev is the Open Source Vulnerability database — a free, open-source project that aggregates CVE data for PyPI, npm, and other ecosystems. It provides a batch query endpoint that accepts multiple package names at once, which is exactly what a pipeline processing 1,000 packages needs.

The first problem was a data problem. The `querybatch` endpoint is efficient but minimal: it returns only CVE IDs and modification timestamps. The severity data — CRITICAL, HIGH, MEDIUM, LOW — and the CVSS score are not in the batch response. They live in individual vulnerability records that must be fetched separately.

The solution was a two-phase approach. Phase 1: querybatch collects all CVE IDs for all 1,000 packages. Phase 2: deduplicate the CVE IDs (many packages share the same CVE — a vulnerability in a shared dependency appears for every package that depends on it), then fetch the full record for each unique CVE ID. This turns a potential 3,000-request problem into a 100-request problem.

The deduplication step is the clever part. Without it, fetching CVE details is O(packages × CVEs per package). With it, it is O(unique CVEs in the ecosystem). For widely shared CVEs — a critical vulnerability in a popular logging library, for example — the savings are dramatic.

The second problem was a timeout problem, and it was subtler.

OSV sometimes sends HTTP response headers immediately and then stalls on the response body. The connection is alive. The server is responding. But the actual data is not arriving. With a standard timeout like `timeout=60` (meaning "fail if no response within 60 seconds"), the socket stays open indefinitely, because the server already responded — it just has not finished sending the body.

The pipeline hung twice before I diagnosed this. The fix is a tuple timeout: `timeout=(5, 10)`. In Python's `requests` library, this means "fail if no connection within 5 seconds, fail if more than 10 seconds pass between any two bytes of the response body." The body stall is caught. The pipeline moves on.

There was also a semantic issue: OSV uses the label "MODERATE" where NIST and most other systems use "MEDIUM." Without an explicit mapping — `if severity == "MODERATE": severity = "MEDIUM"` — every MODERATE CVE scored as zero in the risk formula. I discovered this when a package with three known "MODERATE" vulnerabilities showed no CVE risk at all.

Small bug. Significant impact. The kind of thing that only surfaces when you inspect the data rather than assuming the pipeline is correct because it ran without errors.

---

### Battle Four: deps.dev — The API That Disappeared

deps.dev is Google's open-source dependency graph service. It tracks which packages depend on which other packages across multiple ecosystems, including PyPI. The plan was to use it to build the dependency edge data — the connections between packages that make the blast radius calculation possible.

The ingestion script was written. The API calls were tested. The data was flowing.

Then the endpoint stopped working.

deps.dev uses a versioned API — at the time of development, it was labeled v3alpha. Alpha means experimental. Experimental means it can change without notice. What happened: Google removed the `/dependencies` endpoint for PyPI packages and removed the `dependentCount` field from the package response. Both returned 404. All 1,000 packages returned 0 dependency edges and no dependent counts.

There was no deprecation notice. No migration guide. No warning in the changelog. The endpoint simply stopped responding.

At this point, the dependency edge data was gone, the blast radius calculation was broken, and the 20% of the risk score that depended on depth data was returning zeros.

The response was not to find another API. It was to ask a different question: where else does this data exist?

It exists in PyPI itself. Every package's JSON API response includes a `requires_dist` field — the list of packages this package depends on, in PEP 508 format. These are strings like `"requests>=2.28.0"` or `"pandas; extra == 'analysis'"`. They describe exactly what the deps.dev API was providing.

I built a local parser. Read `requires_dist` from the database (already stored from the PyPI ingestion step). Parse each requirement string with a regex to extract the package name. Normalize the name according to PEP 503 (lowercase, collapse hyphens and underscores and dots into a single hyphen). Check if the normalized name exists in the top-1,000 set. If yes, it is an edge.

The result: 5,363 dependency edges derived from package metadata already in the database. Zero API calls. Zero rate limits. Zero risk of the data source disappearing overnight.

The alpha API removal was an incident. The fix was better than the original design.

---

### The Scheduler Queue

Across all four ingestion scripts, there is a shared concept: the scheduler queue. It is a BigQuery table with one row per package and four status-tracking fields — one per data source.

The state machine is simple: `pending` → `running` → `complete` or `error`.

Every script starts by marking a batch of packages as `running`, which prevents duplicate processing if two runs overlap. Every package is processed individually — if one package fails (say, a GitHub repository URL that 404s), that package is marked as `error` and the batch continues. The batch does not abort because one package in fifty had a bad URL.

The retry counter is incremented on each error. After enough failures, a package can be identified as consistently broken and excluded from future runs — a dead letter pattern. This was built into the schema in the first version, with the intent of using it post-MVP.

The state machine is not complicated. But it means that every pipeline run is safe to restart, every failure is recorded, and every package's ingest status is visible without guessing.

---

### What Four API Battles Taught

After building and debugging four ingestion scripts, four patterns stood out clearly:

**Verify the data, not just the run.** A pipeline that runs without errors is not a pipeline that produced correct data. After every major change, query the results. Count the rows. Check for unexpected nulls. The GitHub silent failure would have shipped to production if I had only checked the pipeline exit code.

**Alpha APIs require monitoring, not trust.** If a data source is in alpha or beta, assume the schema will change and build a schema validation layer that catches the change before the pipeline ingests garbage. The deps.dev incident was recoverable because I noticed it. It would have been caught earlier with proactive monitoring.

**The fastest API is the one you do not call.** The deps.dev replacement — parsing `requires_dist` locally — is faster, cheaper, and more reliable than the original API-based approach. Before reaching for a new API, check whether the data already exists somewhere you already have access to.

**Raise, do not warn, on batch failures.** If a batch-level error produces no valid data, the error should stop the pipeline. A warning that logs and continues is a bug that will silently accumulate in production.

---

*Next: Episode 4 — Turning Raw Data into Intelligence. Getting data into BigQuery is only the first half. The harder question is what to do with it once it is there.*
