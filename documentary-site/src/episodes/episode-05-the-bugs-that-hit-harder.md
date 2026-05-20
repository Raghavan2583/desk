# DESK — A Documentary Series

## Episode 5: The Bugs That Hit Harder

---

There is a specific kind of bug that is more dangerous than a crash.

A crash is visible. The pipeline fails. The log has an error. You know something is wrong and you go fix it. These bugs are frustrating but honest.

The dangerous kind is the bug that does not crash. The pipeline completes. The exit code is 0. The data is there. But the data is wrong. And it will stay wrong until someone is curious enough to inspect the numbers rather than trusting that a passing run means a correct result.

DESK had both kinds. The first kind — crashes and failed runs — were problems. The second kind were the ones that left a mark.

---

### The GitHub Silent Failure

This was the one that took the longest to find and had the largest impact.

GitHub's GraphQL API was handling batches of 20 repositories per query. When a batch exceeded GitHub's internal node limits, it returned HTTP 200 with an `errors` field in the JSON body. The original code checked the HTTP status code — 200 — logged the `errors` field as a warning, and continued to the next batch.

The result after the first full pipeline run: 762 of 900 packages had null maintainer data. No last commit date. No contributor count. No activity label. The maintainer health score — 40% of the total risk score — was missing for 85% of packages.

Nothing crashed. No alert fired. The pipeline printed success.

I found the problem because the risk scores looked wrong. Too many packages clustered around the neutral 5.0 mark, which happens when the maintainer score defaults to "unknown." Not impossible, but suspicious. I queried the database directly and found the null rows.

The fix was three things: reduce batch size from 50 to 20 repositories per query (fewer nodes, less likely to exceed limits), add a 2-second sleep between batches, and change the error handling from a warning log to a raised exception. If a batch produces no data, the pipeline stops. It does not silently continue.

After the fix: 888 maintainer rows, up from 138. The risk scores shifted immediately and significantly.

**The lesson: HTTP 200 is not success. Check the response body. Raise on batch-level failures. A warning that does not stop the pipeline is a bug that will silently accumulate.**

---

### The Streaming Insert Wall

BigQuery offers two ways to write data: streaming inserts (rows arrive in seconds, immediately queryable) and load jobs (batch upload, available within a minute, no size limit).

The original ingestion scripts used streaming inserts. They are the intuitive choice for a pipeline — data comes in, you write it immediately, it is available immediately.

The problem: BigQuery's free tier blocks streaming inserts entirely. And even on paid tiers, streaming inserts have a per-row limit: 10MB maximum per request. PyPI package metadata can be large — 50KB to 200KB per package when you include the full `requires_dist`, `project_urls`, and `raw_payload` fields.

Both `pypi_ingest.py` and `github_ingest.py` failed when they hit these limits. The error messages were specific enough to diagnose quickly, but the fix required rewriting both ingestion scripts to use load jobs instead.

Load jobs work differently: collect all the rows for a batch, write them as a file upload to BigQuery, commit the entire upload at once. No per-row size limit. No streaming requirement. And importantly for the free tier: no cost.

After the rewrite, load jobs became the default for all ingestion scripts. Not because streaming inserts are bad — they are appropriate for many use cases — but because for a batch pipeline processing large payloads, load jobs are the better fit. The lesson here is a configuration mismatch that should have been caught at design time: know your storage tier's constraints before writing the first insert.

**The lesson: understand your storage tier before the first write. Streaming inserts and load jobs are not interchangeable. The wrong choice is invisible until you hit a limit.**

---

### The deps.dev Disappearance

This one was not a bug. It was an external event that felt like one.

The deps.dev integration was working. Package dependency edges were being ingested. The data was in BigQuery. Then, without any notice in the changelog or deprecation announcement, the `/dependencies` endpoint for PyPI packages started returning 404. The `dependentCount` field disappeared from the package response. All 1,000 packages returned empty dependency data.

The pipeline did not fail — the ingestion script handled the 404 responses and wrote empty rows. The failure was silent. All dependency edge data was gone. Blast radius for every package was zero.

The response was to look for the data elsewhere, and it was already there: `requires_dist` in the PyPI package metadata, stored in the database from the PyPI ingestion step. The same information that deps.dev was providing — which packages depend on which — was available locally without any external API call.

Building the local parser took about four hours. It produced 5,363 dependency edges where the deps.dev integration had been producing approximately the same number before it broke. The local version has no API quota, no rate limits, no risk of disappearing overnight.

The irony: the replacement is better than the original.

**The lesson: alpha and beta APIs are experiments, not infrastructure. Never build a critical data dependency on an endpoint labeled alpha. If you must, build the schema monitoring to catch changes immediately.**

---

### The OSV Body Stall

OSV.dev would sometimes send HTTP response headers immediately and then stop. The connection was alive. The server had acknowledged the request. But the response body was not arriving. With a standard `timeout=60` — which means "fail if no response comes within 60 seconds" — the socket stayed open, waiting, because the server *had* responded. It just had not finished.

The pipeline hung twice because of this. The first time, I restarted the run and it completed. The second time, I diagnosed the pattern.

The fix is a tuple timeout: `timeout=(5, 10)` in Python's `requests` library. The first number (5) is the connection timeout — how long to wait for the server to respond at all. The second number (10) is the read timeout — how long to wait between any two bytes of the response body. If 10 seconds pass between bytes, the connection fails.

This catches the body stall. The server sends headers, then goes quiet. Ten seconds later, the read timeout fires. The request fails, the exponential backoff retries, and if the stall was transient, the next attempt succeeds.

The same timeout pattern was applied to the GitHub GraphQL ingestion script after the same body-stall behavior appeared there.

**The lesson: a single timeout value does not protect against body stalls. Use a tuple: (connect_timeout, read_timeout). The read timeout is the one that catches servers that respond but do not finish.**

---

### The Optional Extras Pollution

This was not a dramatic failure. It was a subtle incorrectness that compounded quietly.

Python's `requires_dist` field in package metadata mixes two types of dependencies: required (must be installed) and optional (installed only when the user requests a specific extra). Optional dependencies look like: `"pytest>=6.0; extra == 'dev'"` or `"pandas; extra == 'analysis'"`.

The original ingestion script treated all `requires_dist` entries as required dependencies. It had no logic to distinguish between `"requests>=2.28"` (required) and `"pytest; extra == 'test'"` (optional).

The consequence: `pytest` appeared as a dependency of every package that listed it as an optional test dependency. Packages like `flask`, `django`, `fastapi` all showed `pytest` as a dependency. The blast radius count for `pytest` was dramatically overstated. Any package that appeared frequently as an optional extra had an inflated score.

After counting: 53% of all dependency edges in the top-1,000 dataset were optional extras. More than half of the graph was noise.

The fix was a two-line check in the transformation layer: if a `requires_dist` entry contains `; extra ==`, mark it as `is_optional = TRUE` and exclude it from blast radius calculations and graph edges. Optional extras are preserved in the database for future analysis but do not contribute to the dependency graph.

**The lesson: understand the data format before trusting the data. PEP 508 `requires_dist` entries have semantics. Treating required and optional dependencies identically produces a graph that is more than half wrong.**

---

### The Search Dead End

This one was found not through inspection but through demonstration.

Before showing DESK to anyone, I ran a quick test: search for several packages by name, verify they appear and load correctly. I searched for `python-statemachine` — a package in the top 1,000 by download count.

It returned no results.

The search implementation was prefix-based: it matched packages whose names started with the search string. `python-statemachine` starts with `python-`, which happens to match dozens of packages, but the full name requires scrolling through an alphabetically sorted list to find. Searching for `statemachine` — the distinctive part of the name — returned nothing, because the name does not start with `statemachine`.

The same issue affected any package with a prefix that is more generic than its distinguishing substring.

The fix: replace prefix matching with substring matching, then rank results with prefix matches first. Searching `state` returns `python-statemachine` along with any other package containing `state` in its name, with prefix matches appearing at the top. The user types less and finds what they are looking for faster.

**The lesson: test search with real package names before any demo. Hyphens, underscores, compound names — real users search differently than the developer who built the search.**

---

### The Pattern Across All Five

Looking at these incidents together, a pattern emerges.

None of them were caused by complex code. The GitHub silent failure was one missing condition. The streaming insert wall was a configuration assumption. The deps.dev disappearance was an external change that required a pivot. The body stall was one number (timeout) that should have been two. The optional extras were a data interpretation mistake.

None of them required days to fix. Most required an hour or less once diagnosed.

What they all required was the willingness to inspect the data rather than trust the exit code. A pipeline that completes without errors is not a pipeline that produced correct results. The only way to know if the results are correct is to look at the results.

That habit — querying the database after every significant change, comparing numbers to what they should be, being suspicious of results that are merely plausible — is the thing that caught every one of these bugs before they reached a production user.

---

*Next: Episode 6 — The Face of Risk. The most accurate risk model in the world is useless if nobody can read it. This is the story of how DESK learned to communicate.*
