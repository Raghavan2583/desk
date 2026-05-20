# DESK — A Documentary Series

## Episode 7: Shipping and What Broke

---

"It's deployed" is not the same as "it's working."

This is a distinction that takes most engineers at least one production incident to fully appreciate. A system is deployed when the code is running somewhere accessible. A system is working when the full chain — data collection, transformation, scoring, export, commit, deployment, CDN, browser — functions end-to-end, every day, without manual intervention.

Getting DESK deployed took a few hours. Getting DESK working took several weeks of debugging infrastructure that looked correct and was not.

---

### Setting Up the Pipeline

GitHub Actions is the orchestration layer for DESK's daily pipeline. The setup requires: a workflow file (YAML), a GCP service account key with BigQuery access, a GitHub token for the GitHub GraphQL API, Vercel deployment credentials, and the correct Python environment.

The service account key is the most important part to handle correctly. GCP service account keys are JSON files containing a private key. They cannot be stored in the repository — that would expose the credentials publicly. GitHub Secrets stores them as environment variables, but JSON files with line breaks and special characters do not survive environment variable encoding cleanly.

The solution: base64-encode the key file before storing it in GitHub Secrets, then decode it in the pipeline:

```bash
echo "${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}" | base64 -d > "$RUNNER_TEMP/gcp-key.json"
echo "GOOGLE_APPLICATION_CREDENTIALS=$RUNNER_TEMP/gcp-key.json" >> "$GITHUB_ENV"
```

The decoded file is written to `$RUNNER_TEMP`, which is a temporary directory cleaned up after the run. The `GOOGLE_APPLICATION_CREDENTIALS` environment variable tells the BigQuery client library where to find the key. This pattern works reliably and never exposes the key in logs.

The pipeline ran for the first time. And failed. Then failed again. And again.

Seven runs before it completed successfully end-to-end.

Each failure was different. The first was the base64 encoding — the key had been stored with line breaks in the wrong format. The second was the Python environment — dbt was not installed in the same pip install step as the BigQuery client. The third was a BigQuery dataset that needed to exist before the first write. The fourth was the OSV ingest, which hung on a body stall before the timeout fix was applied. The fifth was a GitOps conflict. The sixth was the optional extras creating circular dependency edges that broke the dbt graph. The seventh run worked.

Seven is not an unusual number for the first run of a pipeline that touches four external APIs, a cloud data warehouse, a transformation framework, a scoring script, a JSON export, and a deployment platform. Each failure exposed a real problem. Each fix made the pipeline more robust. The seventh run worked because the first six runs found all the issues.

---

### The `[skip ci]` Confusion

At a certain point during development, the pipeline was generating a lot of commits. Every run committed updated graph data to the repository, which triggered another run, which committed more data, which triggered another run. To stop the loop, I added `[skip ci]` to the automated commit messages.

`[skip ci]` is a GitHub Actions convention: commits with this string in the message do not trigger workflows that listen for push events. I thought this would prevent the automated data commits from triggering the CI pipeline.

What I did not fully account for: `[skip ci]` affects push-triggered workflows. The daily refresh pipeline is schedule-triggered — it runs at 02:07 UTC on a cron schedule, not on push. So `[skip ci]` did nothing for the pipeline itself.

What it did affect: Vercel's GitHub integration. Vercel's automatic deployment feature — which watches the main branch for commits and deploys on every push — also respects `[skip ci]`. With `[skip ci]` in the automated commit messages, Vercel stopped deploying.

The data pipeline was running correctly. Fresh data was being committed to the repository every day. But Vercel was not deploying any of it. The live site was serving stale data.

Once diagnosed, the fix was straightforward: remove `[skip ci]` and add an explicit Vercel deployment step inside the pipeline itself. Instead of relying on Vercel's automatic integration, the pipeline would deploy directly using the Vercel CLI after committing the data.

But this fix introduced a different problem.

---

### The Bot Push Problem

After removing `[skip ci]` and separating the Vercel deployment into its own workflow (`deploy_frontend.yml`), the plan was: daily refresh commits data, which triggers `deploy_frontend.yml`, which deploys to Vercel.

This did not work.

GitHub has a security rule that prevents workflows from triggering other workflows when the triggering commit was made by the `github-actions[bot]` account. The reason is loop prevention — if a workflow commit could trigger another workflow, you could accidentally create an infinite chain of deployments. GitHub's solution is to simply not trigger any push-based workflows from bot commits.

The daily refresh pipeline runs as `github-actions[bot]`. Its data commits do not trigger `deploy_frontend.yml`. The deployment workflow exists and is correctly configured, but it never fires from the automated commits. It only fires when a human pushes code directly.

This meant that for every day since the pipeline was separated into two workflows, the data was refreshed but the frontend was never deployed. The live site was serving the data from the last time a human pushed code.

The data was there — in the repository, committed every morning. The site was not showing it.

The fix: add the Vercel deploy step directly inside `daily_refresh.yml`. Not as a separate workflow. Not as a triggered dependent. Inside the same job, after the data commit. Every time the pipeline runs, it deploys.

```yaml
- name: Deploy frontend to Vercel
  run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
  working-directory: frontend
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

One addition to the workflow file. The bot push limitation is bypassed because deployment no longer depends on triggering a separate workflow.

---

### The Race Condition

DESK has two workflows that both write to the repository: `daily_refresh.yml` (runs every morning) and `pypi_event_trigger.yml` (runs hourly when popular packages release new versions). Both commit updated graph data and push to main.

Without coordination, two concurrent runs on two different GitHub Actions runners would both check out the repository, both run their pipelines, both try to push to main, and one would succeed while the other failed with a rejected push.

The first time this happened, the failure looked random. The run failed, I restarted it, it worked. The second time, the same. By the third time, the pattern was clear: two workflows writing to the same branch without coordination will always race.

The fix has two parts:

**Shared concurrency group:** Both workflows are in the `desk-pipeline` concurrency group with `cancel-in-progress: false`. This means if a second run starts while the first is in progress, it queues rather than cancels. The queue ensures they run sequentially, never simultaneously.

**Rebase before push:** The commit step in each pipeline includes `git pull --rebase origin main` before `git push origin HEAD`. This handles the case where another process has pushed between the checkout and the push — the rebase incorporates the new commits and the push succeeds.

Together these two changes make concurrent pipeline runs safe. They can queue. They can rebase. They will not conflict.

---

### The Incident on May 20

The story does not end with the last fixed bug. It ends with one more.

On May 20, 2026, a check of the live site revealed that the data had not updated since May 15th. The pipeline was running daily — all runs showing `success`. The data was being committed to the repository. But the site was not showing it.

This was the bot push problem again. The fix that had been applied — adding the Vercel deploy step inside `daily_refresh.yml` — had been correct. But subsequent changes to the workflow file, made during other work, had inadvertently removed the deploy step through a combination of rebase conflicts and file edits.

The diagnosis took 15 minutes. The fix took 2 minutes. The lesson took a second occurrence to drive home completely.

The pipeline ran daily. Data was committed. The git history showed the commits. But the commit step used `github-actions[bot]`, which could not trigger `deploy_frontend.yml`. Without the explicit deploy step in `daily_refresh.yml`, Vercel never received the new data.

This incident — discovered by a manager who noticed the stale dates on the dashboard — is the sharpest possible illustration of the principle from the CI/CD lessons: **verify the full chain, not just each component**. The pipeline succeeded. The commit happened. The check should have been: does the live URL show today's data? If the answer is no, something in the chain between the commit and the browser is broken.

The protocol for diagnosing stale data on a live site:
1. `curl` the live URL directly — what does the server actually return?
2. Check the HTTP response headers — is a CDN serving a stale cached version?
3. Check the deployment platform — was the latest commit actually deployed?
4. Check the committed file — does git have the correct data?

Only after all four steps can you accurately diagnose where the chain broke. Telling a user to clear their cache before doing step 1 is a guess, not a diagnosis.

---

### The Monitoring Layer

After the race condition and the deployment failures, a third workflow was added: `schema_monitor.yml`. It runs every Monday at 08:17 UTC. It makes a minimal request to each of the four upstream APIs — PyPI, GitHub, OSV, deps.dev — and validates that the response contains the fields the ingestion scripts expect.

If PyPI changes its API response structure, the schema monitor catches it on the next Monday before the Monday night data refresh runs with broken ingestion. If OSV adds or removes fields, the monitor flags it. If deps.dev changes again — which it had done once already — the monitor fails loudly and sends a notification through GitHub's native workflow failure emails.

Proactive monitoring is cheaper than reactive debugging. Finding out an API changed via a failed pipeline run on Tuesday morning means the data is already wrong from Monday's run. Finding out via the schema monitor on Monday morning means the data has not been corrupted yet.

---

### What Shipping Actually Looks Like

When DESK finally reached a stable operating state — daily refresh running, auto-deploy working, schema monitoring in place, race conditions resolved — the workflow looked like this:

Every morning at 02:07 UTC, GitHub Actions starts the daily refresh pipeline. It ingests data from PyPI, GitHub, OSV, and local dependency parsing. dbt transforms the raw data. The scoring script computes risk scores. The export script writes JSON files. The pipeline commits the updated JSON to the repository. Then, in the same job, it deploys the updated frontend to Vercel. The live site is updated. The entire process takes 20 minutes.

If anything fails — an API is down, BigQuery has an outage, the export script hits an edge case — GitHub's native notification system sends an email. The data does not update that day, but the failure is visible immediately.

If the schema monitor detects an API change on Monday, it sends a notification before the Monday refresh runs with incorrect ingestion logic.

Getting to this state required fixing the streaming insert limit, the bot push problem, the race condition, the `[skip ci]` confusion, the schema validation gaps, and rebuilding the deps.dev integration after the API disappeared. None of these were simple problems. All of them were real.

The pipeline ran for the first time on May 10th. It worked reliably by May 20th. Ten days of debugging infrastructure — not algorithms, not data models, but the unsexy work of making a system run correctly in production, unattended, every day.

---

*Next: Episode 8 — Looking Back at the Journey. Everything DESK was, everything it became, and what it proved about building production systems alone.*
