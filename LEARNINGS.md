# DESK — Personal Learnings
# Date: 2026-05-07
# What I learned by doing, not by reading theory.

## 1. A system is a chain. Debug the whole chain, not the last link.

When data was wrong on the live site, the assumption was browser cache.
It was actually Vercel never deploying. The full chain was:
  BigQuery → dbt → export → git commit → deployment platform → CDN → browser
Each handoff is a potential break. Next time: curl the live URL first.
Check what the server is actually serving before guessing at the cause.

## 2. [skip ci] does not do what you think it does.

It skips push-triggered GitHub Actions AND Vercel auto-deployments.
It does nothing for schedule or workflow_dispatch triggered pipelines.
We added it to prevent CI loops — but our pipeline wasn't push-triggered.
It only ever blocked Vercel. The live site showed stale data for every run.
Lesson: know exactly what a tag suppresses. "It probably helps" is not enough.

## 3. Silent warnings are production bugs in disguise.

GitHub GraphQL returned "Resource limits exceeded" as HTTP 200 with an
errors field. The code logged it as a warning and moved on silently.
762 of 900 packages had null maintainer data. No alert. No failure. Nothing.
The fix was one line: raise instead of warn on batch-level failures.
Lesson: if an error doesn't stop the pipeline, it will hide in production.

## 4. Two workers, one target, no coordination = race condition.

Two GitHub Actions workflows were writing to the same files and pushing to
the same branch. They had no shared concurrency group. They raced each other.
One push won. The other failed. Seemed like a flaky pipeline — it wasn't.
Lesson: any two processes writing to the same resource need coordination.
In CI: shared concurrency groups. In code: locks, queues, transactions.

## 5. Re-triggering a failing pipeline makes it worse, not better.

cancel-in-progress: false means every trigger queues behind the last.
Triggering 3 times = 3 runs, each 20-40 minutes apart, each potentially failing.
Pushing a fix while a run is in progress means the fix hits the NEXT queued run.
Lesson: one trigger → wait for result → diagnose → fix → trigger once more.

## 6. Precision beats automation volume.

GitHub integration would deploy on every commit — code fixes, notes, handoffs.
A workflow step deploys only when the pipeline produces real data.
The right automation triggers at the right time, not at every opportunity.
Lesson: more automation is not always better. Targeted automation is.

## The bigger idea

These are all the same lesson in different clothes:
  Understand your system end to end before you build it.
  Visibility at every handoff prevents invisible failures.
  Simple, targeted solutions beat clever, broad ones.

This is system design — learned by breaking things, not by reading about them.
