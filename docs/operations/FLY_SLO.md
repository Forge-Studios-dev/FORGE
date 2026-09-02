# Fly.io API production SLO (F-1002)

**Related:** [DEPLOY.md](../DEPLOY.md) · [audits/EXECUTIVE_SUMMARY.md](../audits/EXECUTIVE_SUMMARY.md)

---

## Current production config (MVP cost-first — 2026-09-01)

| Setting | Value | File |
|---------|-------|------|
| `min_machines_running` | **1** (MVP/dev cost-first) | [fly.toml](../../fly.toml) |
| `auto_stop_machines` | **`stop`** (idle suspend; ~20s cold start on wake) | [fly.toml](../../fly.toml) |
| `[deploy] strategy` | **`rolling`** (bluegreen requires health checks; we use manual health only) | [fly.toml](../../fly.toml) |
| API VM | **shared-cpu-1x, 1024mb** | [fly.toml](../../fly.toml) |
| Region | **`sin`** primary + machines (CI: `--primary-region sin --regions sin`) | [fly.toml](../../fly.toml) |
| Worker VM | **shared-cpu-1x, 1024mb**; `restart.policy = 'always'`, `max_retries = 10` | [fly.worker.toml](../../fly.worker.toml) |

With `min_machines_running = 1`, `auto_stop_machines = stop`, and `strategy = rolling`, one right-sized API machine handles steady-state traffic and can suspend when idle. No Fly health checks — deploy uses rolling swap (brief blip possible on single machine).

**Rollback to HA posture** (if cold starts or deploy blips become unacceptable): restore `min_machines_running = 2`, `auto_stop_machines = false`, and optionally `memory = 2048mb` / `cpus = 2` in `fly.toml`, then `fly deploy`.

> **Historical (Wave 6, pre-2026-09-01):** `min_machines_running = 2` + `auto_stop_machines = false` + 2GB/2CPU — kept for zero-downtime rolling deploys after incident chain #151–#154. Replaced by cost-first MVP config above.

> **Note (2026-08-21): `bom` is permanently deprecated by Fly** — `flyctl deploy` now returns `Region bom is deprecated and cannot have new resources provisioned`, not a capacity error. This is not transient; do not retry `bom`. `primary_region` moved to `sin` in `fly.toml`, `fly.worker.toml`, and every workflow that pins a region. Machines and release_command VMs run in `sin`.
>
> Between 2026-08-20 and 2026-08-21 this masqueraded as a capacity outage (the two notes below describe that era) and the Release workflow's `bom`-only capacity retries silently stopped matching once Fly switched to the deprecation error, so releases failed closed without ever reaching the sin fallback tier. A migration merged 2026-08-20 (`avg_watch_percent`) went unapplied to production for ~2 days while code referencing it kept shipping via `--skip-release-command`, causing live 500s on video detail and search. Fixed by moving to `sin` outright rather than treating it as a fallback tier.
>
> **Historical (2026-07-28 note, no longer applicable):** previously, `--primary-region sin` while machines lived in `bom` broke `min_machines_running` protection for the `bom` machines (it only counts the primary region) and caused cold-start proxy timeouts. Moot now that `sin` is primary and holds all machines.
>
> **Note (2026-07-29, generalized 2026-08-21):** When Fly returns `no capacity available in sin` for the `release_command` VM, the Release workflow retries then:
> - **No TypeORM migration files in the SHA** → deploys with `--skip-release-command` (safe for config/code-only releases).
> - **Migrations present** → fails closed. Operator path: apply pending TypeORM migrations out-of-band (Neon MCP / `machine run` in a region with capacity), then:
> `flyctl deploy --remote-only --primary-region sin --regions sin --skip-release-command`
> Manual override: Actions → Release (production) → Run workflow → `skip_release_command=true` (only when schema is already current).
> Image rollback also uses `--skip-release-command` so a capacity miss cannot strand the previous image. Docs/rules-only merges on `main` **skip** the Release deploy jobs entirely (manual `workflow_dispatch` still deploys).

---

## When to use scale-to-zero (`min_machines_running = 0`)

| Use scale-to-zero | Use min = 1 (current MVP) | Use min = 2 |
|-------------------|---------------------------|-------------|
| Dev / demo Fly apps | **Cost-sensitive MVP / low traffic** (current) | Auth-heavy traffic, live streams, zero-downtime without bluegreen |
| Cost is top priority and p95 cold start acceptable | Cost-sensitive prod with brief deploy/cold-start blips OK | Requires always-on HA pair |

---

## Measuring cold start (before changing config)

```bash
# After API idle ~5+ min, time a manual liveness call:
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "%{time_total}\n" https://api.forgestudios.net/api/v1/health/live
  sleep 2
done
```

Compare Fly dashboard **Time to first byte** before/after config changes.

**Health probes:** No Fly `[[http_service.checks]]` — `/api/v1/health/live` and `/health/ready` are **manual or deploy-smoke only** (no continuous platform or app polling). Synthetic monitoring GitHub workflow is `workflow_dispatch` only. Machines may auto-stop when idle (`auto_stop_machines = stop`).

**Redis eviction (ops):** BullMQ requires `maxmemory-policy noeviction`. If Redis Cloud still uses `volatile-lru`, queue keys can be dropped — see [REDIS_CONNECTIONS.md](./REDIS_CONNECTIONS.md).

---

## Worker note

The worker app (`forge-studios-worker`) has no public HTTP edge service. It exposes `GET /health` on its internal PORT for **manual** and **deploy-time** diagnostics only (no Fly `[checks]` loop). Queue depth is monitored via API Prometheus metrics (`forge_bullmq_jobs_*`) when `METRICS_ENABLED=true` — see [OBSERVABILITY.md](../OBSERVABILITY.md).

`release.yml`'s `deploy-worker` job force-starts the worker machine after deploy (`if: always()`) to reset Fly's exhausted-retries counter — without this, a machine that crash-looped past `max_retries = 10` on a prior bad deploy stays stopped even after a good deploy ships. See [CI_CD.md](../CI_CD.md) for the full step list.

### Worker `--ha=false` (M-D5): accepted SPOF

The worker is deployed with `flyctl deploy -c fly.worker.toml -a forge-studios-worker --remote-only --ha=false` — a **single** machine, not the Fly-default paired-machine HA topology.

Rationale (accepted trade-off, not a bug):

- BullMQ jobs are durable in Redis (Redis Cloud, not in the worker's memory). If the machine goes down, jobs stay in their queues and resume on restart.
- `restart.policy = 'always'` + `max_retries = 10` in `fly.worker.toml` plus the post-deploy force-start in `release.yml` keep the single machine self-healing across crashes and bad deploys.
- Running a paired HA worker would double compute cost and, more importantly, needs per-worker idempotency review across all BullMQ processors before it's safe (some workers assume single-consumer semantics — e.g. reminder scheduling, view-count flush).

Blast radius while the single machine is down:

- **Blocked:** background job progress — VOD transcode, push dispatch, engagement reconciliation, view-count flush, stream reminders.
- **Not blocked:** all API request handling (Fly API is separate, 1 machine + auto-start) and Socket.IO real-time (chat/reactions run on the API tier).

Escalation trigger to move off `--ha=false`:

- BullMQ queue-depth alerts (`forge_bullmq_jobs_waiting`) sustained above threshold for > 30 min during a worker outage window in > 1 quarter, OR
- Any worker path becomes user-visible on the request-hot path (e.g. real-time notification delivery is moved onto the worker tier).

When that trigger fires: harden per-worker idempotency, then flip to Fly's default HA pair and remove `--ha=false` from `release.yml`'s `deploy-worker` step.

Rollback Fly config: `fly releases rollback -a forge-studios-api`
