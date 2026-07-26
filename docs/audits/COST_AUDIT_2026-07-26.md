# FORGE — Cost Optimization & Local-First Testing Audit

**Audit date:** 2026-07-26
**Run via:** `docs/audits/COST_AUDIT_PROMPT.md`
**Prior work:** [NEON_COST.md](./NEON_COST.md) · [INFRASTRUCTURE_COST_AUDIT_2026-06.md](./INFRASTRUCTURE_COST_AUDIT_2026-06.md) · [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md)

---

## Executive summary

No new infra was added this audit. One config-drift bug was found and fixed (Fly API machine count silently dropped from the documented baseline of 2 to 1 — see below), and one real query-volume waste item was found via live `pg_stat_statements` data. Everything else audited is either already well-optimized from the June audits or outside this session's credential access (Mux, AWS, Vercel dashboards — flagged, not guessed at).

**Access available this session:** `fly` CLI (authenticated), `docker`/`docker compose`, live admin `query-stats` endpoint, repo code/config. **Not available:** Neon API key, Mux dashboard/API key, AWS credentials, Vercel token — those sections are code-review-only below and should be re-run with credentials for real numbers.

| Service | Current state | This audit's confidence |
|---|---|---|
| Fly.io (API) | 2 machines configured; **autostop reclaims the idle one automatically** (see finding #1) — not a flat 2× cost | High — live-verified |
| Neon | `DB_POOL_MAX=5`, autosuspend 300s already tuned (Audit #3, June) | High — live `query-stats` pulled |
| Redis | 4 connections/machine observed, within documented ≤8 budget | High — live-verified |
| Mux | No dashboard access this session | Low — code-review only |
| AWS S3/CloudFront | No credentials this session | Low — code-review only |
| Vercel | No token this session | Low — code-review only |
| BullMQ | Retention caps set on all 15+ processors; concurrency defaults to 1 everywhere | High — code-verified |
| Socket.IO | Redis adapter present, matches documented connection budget | High — code-verified |
| Observability/CI | Sentry 10% trace sample, no DB/Redis service containers in CI | High — code-verified |

---

## Re-run confirmation (2026-07-26, ~10h after initial audit)

Re-pulled live state after the incident-chain fixes (#151–#154) and this report (#155) were all merged and deployed, to confirm the findings below still hold against current production rather than a stale snapshot:

- **Fly machines**: `fly status` shows the same pattern predicted in finding #1 — machine `891243f65d7e08` `started`/passing, machine `874dd7b046d128` `stopped` (autostop reclaimed it again on its own). Confirms this isn't a one-off; it's the steady-state behavior, so the "not a flat 2× cost" read in finding #1 holds.
- **Deploy stability**: last 2 production releases (`30171588865`, `30172414794` — the real routing fix and this audit's own docs merge) both **succeeded with no rollback**, versus the 3 failures immediately before them in the same run history. The `#153`/`#154` fix is durable, not a fluke.
- **Neon connection churn (finding #3)**: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` call count is now **1,981** (up from 1,906 at first audit, ~10h earlier) — averaging roughly **+7.5 calls/hour**, consistent with ongoing connection churn at the same rate. Confirms this is a live, continuing pattern worth fixing, not noise from a single burst.
- **Redis connections**: still 4 per sampled machine, unchanged, within budget.

No findings changed. Fresh numbers folded into the table/findings below rather than duplicating the report.

---

## Findings

| # | Area | Issue | Cost impact | Fix | Est. savings | Risk if unfixed |
|---|------|-------|--------------|-----|---------------|------------------|
| 1 | Fly.io | `fly.toml` declares `min_machines_running = 2`, matching the connection budget already documented in `NEON_COST.md` (2 API + 1 worker = ~15 Neon pool slots) — but only **1 machine was actually running** in prod (config drift, cause unknown — likely a manual `fly scale count 1` or a partial rollback at some point). This caused every rolling deploy to have no redundant machine during the swap, producing the connection-gap smoke-test failures diagnosed and fixed this session (`#153`). Restored to 2 via `fly scale count 2`. | **Not a new cost** — restores documented baseline. Live-observed: with `auto_stop_machines=true`, Fly reclaims the idle 2nd machine on its own (`fly status` showed machine 2 `stopped, exit_code=130, requested_stop=true` ~30 min after being started) and restarts it when needed. So actual cost is closer to "1 machine + occasional 2nd," not flat 2×. | Keep at 2 (documented, already restored). **Do not lower back to 1** — that's what caused the incident. | N/A (bug fix, not scale-up) | High — reintroduces the deploy-swap connection gap that caused 3 production incidents this session (#151, #152, #153 chain) |
| 2 | Fly.io deploy strategy | No `[deploy] strategy` set in `fly.toml` (defaults to `rolling`, in-place). `deploy-worker` in `release.yml` explicitly passes `--ha=false` (worker has no public traffic, fine); `deploy-api` passes no `--ha` flag, so it inherits flyctl's default HA behavior against whatever `min_machines_running` is set to. | Currently fine now that machine count is fixed (finding #1). But `rolling` still briefly takes one machine out of rotation per deploy — the health-check interval fix (`#153`, 60s→15s) narrows this, doesn't eliminate it. | **If deploy-time reliability needs to be even tighter** (not urgent — current state is stable): switch to `strategy = 'bluegreen'` in `fly.toml`. Bluegreen boots the new machine(s) fully healthy *before* removing the old one(s), giving true zero-downtime without needing an always-on 2nd machine — the 2nd machine would only exist for the ~1–2 min deploy window instead of continuously. | Est. **could allow dropping `min_machines_running` to 1** with bluegreen absorbing the deploy-time redundancy need — cost delta requires Fly dashboard confirmation of actual $/machine/mo (not available this session); directionally this is the cheaper path than 2 always-on-ish machines if deploy frequency is low. | Low — this is a "nice to have," current rolling+2-machines setup is already stable post-#153 |
| 3 | Neon (Postgres) | Live `pg_stat_statements` (pulled via `/admin/database/query-stats`) shows `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` called **1,906 times**. This isn't application code — it's TypeORM's postgres driver re-checking the extension on every *new* physical connection. `DB_POOL_IDLE_TIMEOUT_MS` defaults to 30s for Neon (`parse-database-config.ts`), which is shorter than the cadence of several background jobs (mux sync 45–90s, stream reminder 5m, subscription maintenance hourly) — so the pool is very likely opening a fresh connection for each job run instead of reusing a held-open one, each incurring a wasted extension-check round-trip plus TLS handshake overhead. | Small direct query cost (this call is sub-ms), but real cost is the **connection churn itself** — each Neon reconnect has non-trivial latency and, on serverless Postgres, connection setup contributes to compute activity. This works against the Audit #3 goal of minimizing wake events. | Raise `DB_POOL_IDLE_TIMEOUT_MS` for Neon from 30s to something like 90–120s — still well under Neon's 300s `suspend_timeout_seconds`, so true overnight autosuspend is unaffected, but connections survive across one background-job cycle instead of closing and reopening every time. | Modest — fewer reconnects, faster job execution (skip TLS handshake), no compute-tier cost change expected. Confirm via `query-stats` reset + 24h re-check post-deploy. | Low — status quo works, this is pure waste-trim, not a reliability issue |
| 4 | Redis | Dual-client architecture (ioredis + node-redis for Socket.IO adapter) already documented as an intentional tradeoff (`REDIS_CONNECTIONS.md`). Live check: 4 connections observed on the sampled machine, within the documented ≤8 budget. | None found | None needed | — | — |
| 5 | BullMQ | All 15 `@Processor` classes use default concurrency (1). All queues have `removeOnComplete`/`removeOnFail` age+count caps set (no unbounded retention found). | None found at current traffic | Scale-readiness note only: if job volume grows, concurrency=1 per queue will start showing up as queue-depth lag before it shows up as a cost problem — cheap fix then is `concurrency: N` per `@Processor`, not more machines. | — | Low — flagged for the "scale-ready but not urgent" bucket |
| 6 | AWS S3 | `scripts/setup-aws-forge.sh` (last IaC touchpoint for the media bucket) sets public-access-block, CORS, and a CloudFront OAC + least-privilege IAM policy — all good. **No S3 lifecycle rule is configured anywhere in the script or repo** (no `put-bucket-lifecycle-configuration` call). | Unknown without AWS console access this session — cold/orphaned upload objects (e.g. abandoned multipart sessions, per `MUX_COST_OPS.md`'s own "Orphan S3" checklist item) have no automatic expiration or storage-class transition. | Add a bucket lifecycle rule: expire incomplete multipart uploads after ~7 days (matches the BullMQ `removeOnFail: 7 * 24 * 3600` pattern used elsewhere), and transition/expire orphaned `uploads/` temp-prefix objects. This is exactly what `MUX_COST_OPS.md` already flags as a manual monthly check (#5) — automating it removes the manual step. | Unknown $ — needs AWS console access to see actual object count/age in the bucket first. | Medium — flagged as a real gap, not verified further without credentials |
| 7 | Vercel | `vercel whoami` failed (invalid token in this session) — could not check build-minute usage, ISR cache headers, or function invocation patterns directly. | Unknown | Re-run this section with a valid `VERCEL_TOKEN` | Unknown | Low — Vercel's hobby/pro tier overage is usually self-evident from billing alerts; not flagged as urgent |
| 8 | Mux | No dashboard/API access this session. Code-level guardrails already good: idempotent VOD ingest via stable `jobId` (prevents duplicate-encode cost from webhook retries), no FFmpeg workers enabled in production, entitlements hide playback URLs for gated content. | Unknown | Re-run `MUX_COST_OPS.md`'s monthly checklist with dashboard access | Unknown | Low — existing guardrails cover the highest-risk cost driver (duplicate ingest) |
| 9 | Observability/CI | Sentry `tracesSampleRate` defaults to 0.1 (10%), capped at 1.0 — reasonable. CodeQL runs weekly (`cron: '0 6 * * 1'`) + on-demand, not on every push. CI does **not** spin up Postgres/Redis service containers (matches `forge-testing.md`). | None found | None needed | — | — |

---

## Prioritized action list

### Quick wins (no scaling, low risk, do anytime)
- **#3** — Raise Neon pool idle timeout (30s → ~90–120s) to cut reconnect churn. One-line config change, verify locally against docker-compose Postgres by watching connection count during a simulated job burst, then confirm via `query-stats` 24h after deploy.
- **#6** — Add S3 lifecycle rule for incomplete multipart uploads (needs AWS credentials to inspect current object inventory first).

### Structural (needs a migration or bigger change)
- **#2** — Bluegreen deploy strategy, if the goal is to eventually run `min_machines_running = 1` steady-state while keeping zero-downtime deploys. Not urgent — current rolling + 2-machine setup (post-#153) is stable. Requires a `fly.toml` `[deploy] strategy = 'bluegreen'` change, tested against a real deploy cycle (can't be fully validated via docker-compose since it's Fly-orchestration-specific — would need a low-traffic-window production deploy to observe).

### Scale-ready but not urgent (do later, cheaply, when traffic grows)
- **#5** — BullMQ per-queue concurrency tuning, only once `forge_bullmq_jobs_waiting` metrics show real queue-depth lag.

### Needs follow-up with credentials (not actionable this session)
- **#7** Vercel token refresh + build-minute review.
- **#8** Mux dashboard monthly checklist (`MUX_COST_OPS.md`).
- **#6** AWS console object inventory before finalizing the lifecycle rule's exact expiration window.

---

## Rollback paths (for anything implemented from this report)

- **Finding #1 (machine count restore)** — already implemented and merged this session (part of the `#153`/`#154` incident-response chain, not this audit). Rollback: `fly scale count 1 -a forge-studios-api` — **do not do this**, it's what caused the incident.
- **Finding #3 (Neon idle timeout)** — rollback is reverting `DB_POOL_IDLE_TIMEOUT_MS` (or the code default) back to 30s; single env var / config change, no migration, no data risk.
- **Finding #2 (bluegreen)** — rollback is reverting `fly.toml`'s `[deploy] strategy` line; no data risk, but should be tested on a real deploy since Fly's orchestration behavior isn't reproducible in docker-compose.

**Nothing in this report has been implemented except finding #1, which was already shipped this session as part of the production incident response** (documented in git history: `fly scale count 2`, merged via the `#153`/`#154` PR chain). Findings #2, #3, #6 are proposals only, per `forge-production-stability.md`'s pre-deployment gate — awaiting go-ahead.

---

## What this audit could not verify

Being explicit about this rather than guessing, per the audit's own instructions: Neon CU-hour trend, Mux minutes stored/delivered, AWS actual storage/egress volume, and Vercel build-minute usage all require dashboard or API credentials not present in this session. The June audits (`NEON_COST.md`, `INFRASTRUCTURE_COST_AUDIT_2026-06.md`) have real numbers for Neon as of mid-June; re-running `scripts/neon-consumption-report.sh --days 30` with `NEON_API_KEY` set would refresh that specific number cheaply.
