# FORGE — Cost Optimization & Local-First Testing Audit (reusable prompt)

**Purpose:** paste this into a Claude/Cowork session whenever you need a full infra cost pass. It's written so the agent finds real waste instead of reflexively suggesting "add more machines."

---

## Prompt to use

```
Act as the multidisciplinary team defined in .claude/rules/forge-core.md (Architect, DevOps/Platform,
Cloud Cost Specialist, DBA, SRE, QA). Run a full cost-optimization audit of FORGE.

CONTEXT
- We are in production today, with real but low traffic. Budget is tight — do not recommend
  scaling up (more machines, bigger DB tier, bigger Redis, extra regions) as a first resort.
- We are planning to grow, so flag anything that is a scaling *cliff* (breaks at 10x/100x
  traffic) even if it's cheap today — but the fix should be "make it scale-ready," not
  "provision for scale now."
- Prefer: eliminate waste > cache > batch > queue > autoscale-to-zero > add capacity, in that order.
- Do not propose reverting to `min_machines_running = 2` in fly.toml (or any other "just add
  a machine" fix) without first exhausting cheaper alternatives — e.g. tuning the Fly deploy
  strategy (`rolling` / `bluegreen`, `--ha` flag), health-check grace windows, faster app boot,
  or a temporary deploy-time machine instead of an always-on second one. Give me the cost delta
  (approx $/mo) for each option, not just "this is safer."

SCOPE — audit each of these against current FORGE usage and produce concrete findings:

1. Fly.io (apps/api, apps/web if hosted there) — fly.toml + fly.worker.toml
   - machine count/size vs actual traffic, autostart/autostop config, region count,
     deploy strategy and its actual failure mode (reconcile with the machine-swap
     connectivity gap already diagnosed), health check timing.
2. Neon Postgres — compute autosuspend, CU-hour trend, connection pool sizing
   (DB_POOL_MAX), branch count, storage growth, slow/hot queries via pg_stat_statements,
   index coverage. Build on docs/audits/NEON_COST.md and docs/audits/INFRASTRUCTURE_COST_AUDIT_2026-06.md
   instead of re-deriving from scratch — confirm those numbers are still current and diff
   from there.
3. Redis — connection count per machine, TTL strategy on cached reads, eviction policy,
   instance tier vs actual memory usage. Cross-check docs/operations/REDIS_CONNECTIONS.md.
4. Mux — encoding tier, storage of unused/orphaned assets, webhook/poll frequency,
   idle-gating of sync jobs. Cross-check docs/operations/MUX_COST_OPS.md.
5. AWS (S3/CloudFront/IAM or equivalent object storage/CDN) — bucket lifecycle rules,
   storage class for cold assets, egress patterns, least-privilege IAM (cost + security).
6. Vercel (web, admin) — build minutes, image optimization usage, function invocation
   patterns, ISR/cache headers.
7. BullMQ workers — queue concurrency vs worker size, job retention, dead-letter buildup.
8. Socket.IO — Redis adapter connection overhead, event throttling.
9. Observability/CI — logging retention cost, Sentry/OTel volume, GitHub Actions minutes.

TESTING CONSTRAINT (hard requirement, per .claude/rules/forge-testing.md and
forge-deployment-testing.md)
- Do NOT validate any proposed change against production Fly machines, the Neon production
  branch, or production Redis. Do NOT use the `staging` environment (docs/operations/STAGING.md)
  as the default either — it still costs money and should be a last resort, not routine.
- Verify every change locally first using the repo's own docker-compose.yml (Postgres + Redis
  + API + worker containers already defined there). Add docker-compose overrides/fixtures if
  something isn't currently testable locally, rather than reaching for a live server.
- Only after local docker-compose verification passes should you propose (not run) a staging
  or production validation step, and only for changes big enough to warrant it per
  forge-git-branching.md (batch, one PR, one deploy cycle — never "fix forward" in prod).

DELIVERABLE
Produce a report at docs/audits/COST_AUDIT_<YYYY-MM-DD>.md, following the structure of the
existing docs/audits/INFRASTRUCTURE_COST_AUDIT_2026-06.md:
- Executive summary (current $/mo estimate by service, if derivable from dashboards/configs)
- Findings table: area | issue | current cost impact | fix | est. savings | risk if unfixed
- Prioritized action list: quick wins (no scaling, low risk) vs structural (needs a migration
  or architecture change) vs "scale-ready but not urgent" (do later, cheaply, when traffic
  actually grows)
- For every fix that touches infra config (fly.toml, DB pool size, Redis TTLs, etc.): the
  rollback path, and confirmation it was verified via local docker-compose before being
  proposed.
- Do not implement structural/high-risk changes yet — stop at the report and wait for
  go-ahead, per forge-production-stability.md's pre-deployment gate.
```

---

## Why it's written this way

- Your own rules (`forge-performance.md`, `forge-production-stability.md`, `forge-deployment-testing.md`, `forge-git-branching.md`) already say "cheapest safe option, minimal server/deploy load, batch before merging." This prompt just forces the audit to actually apply them instead of defaulting to "scale up."
- It explicitly blocks the "just set `min_machines_running` back to 2" reflex from your last Claude session — that's a real fix for the zero-downtime gap, but it's not necessarily the cheapest one, and the audit should show the cost delta before you commit to it.
- It points at your existing audit docs (`NEON_COST.md`, `MUX_COST_OPS.md`, `REDIS_CONNECTIONS.md`, `INFRASTRUCTURE_COST_AUDIT_2026-06.md`) so the next session builds on prior work instead of re-auditing from zero.
- It hard-codes "local docker-compose first, staging only if truly needed, never prod" using the docker-compose.yml already in your repo root.

Re-run this prompt monthly or after any infra-relevant merge.
