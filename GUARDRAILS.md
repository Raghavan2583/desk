# DESK — Project Guardrails
# These add to global GUARDRAILS.md. Never contradict global rules.
# Rule: NEVER exceed 80 lines.

## API Safety
NEVER call any external API without rate limit handling and exponential backoff in place.
NEVER call GitHub API using REST for bulk package operations — GraphQL only.
NEVER store API tokens, GCP service account keys, or credentials in code or config files.
NEVER commit a .env file — .gitignore must list .env before first commit. Operator verifies.
NEVER make more than 4,500 GitHub GraphQL calls per hour per token (leave 500 headroom).
NEVER call PyPI, OSV, or deps.dev APIs in a tight loop — always paginate with delays.
NEVER skip validating API responses — malformed data must be caught before BigQuery write.

## Data Safety
NEVER store raw API responses permanently — transform and discard raw layer on schedule.
NEVER expose BigQuery credentials, project ID, or dataset names in frontend bundles.
NEVER let the risk scoring pipeline run on unvalidated or incomplete package data.
NEVER write directly to desk_prod dataset during development — use desk_dev only.
NEVER let a dbt model run in production without schema tests passing first.

## Frontend Safety
NEVER render user-provided package names without sanitisation — XSS risk.
NEVER deploy frontend without testing against: a valid package, an invalid package, a package with 0 dependents.
NEVER expose internal API endpoints or BigQuery structure in frontend JavaScript.

## Free Tier Guardrails
NEVER exceed BigQuery free tier without alerting Coach first:
  - Storage: 10GB cap
  - Queries: 1TB/month cap
NEVER exceed GitHub Actions free tier: 2,000 minutes/month.
NEVER add a paid service or cloud resource without Coach approval and free alternative shown.
NEVER schedule pipeline runs more frequent than every 6 hours without Coach approval.

## Scope Guardrails
NEVER add npm or any non-PyPI ecosystem without Coach approval and DECISIONS.md update.
NEVER build user accounts, authentication, or notifications in MVP.
NEVER add a feature not in ROADMAP.md without Dhoni escalating to Coach first.
NEVER expand beyond 1,000 packages in MVP without Coach approval.
NEVER change the risk score formula without creating a new versioned entry in DECISIONS.md.

## CI/CD Guardrails
NEVER use [skip ci] in any DESK commit message — it blocks Vercel deployments.
  DESK workflows use schedule/workflow_dispatch only, so [skip ci] does nothing
  for GitHub Actions here but silently kills the Vercel auto-deploy every time.
NEVER add a workflow that writes to the repository without joining the
  desk-pipeline concurrency group — parallel writes cause git push conflicts.
  Exception: read-only monitoring workflows (schema_monitor.yml) are exempt.
NEVER add a git push step without git pull --rebase origin main before it.
NEVER treat a GraphQL HTTP 200 as success without inspecting the errors field.
  Partial field errors → log as warning. Batch-level failures (resource limits,
  rate limits) → raise immediately. Silent warnings create invisible data gaps.
NEVER increase BATCH_SIZE above 20 without running a test batch first and
  confirming no "Resource limits exceeded" in the response.

## Quality Guardrails
NEVER ship risk scores without validating output against at least 5 known packages:
  Required test packages: requests, numpy, pandas, log4j-equivalent in Python, a deprecated package.
NEVER deploy a pipeline change without full run on desk_dev first.
NEVER approve a dbt model without at least one not_null and one unique test per key column.
NEVER let a session end with a failed pipeline run unresolved and unlogged.
