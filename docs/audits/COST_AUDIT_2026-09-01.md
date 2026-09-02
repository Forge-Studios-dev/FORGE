# FORGE — Fly.io + Neon Cost Optimization Audit

**Audit date:** 2026-09-01  
**Scope:** MVP cost-first infrastructure pass (Fly.io + Neon + background workers)  
**Prior work:** [NEON_COST.md](./NEON_COST.md) · [COST_AUDIT_2026-07-26.md](./COST_AUDIT_2026-07-26.md) · [FLY_SLO.md](../operations/FLY_SLO.md)

---

## Executive summary

This audit implemented a **cost-first MVP posture** on production Fly apps. Prior audits (June–August 2026) already eliminated most application-level waste (health-check loops, synthetic cron, polling, dormant gates, Redis caches). The remaining cost drivers were **always-on over-provisioned Fly machines** keeping Neon connection pools warm.

**Changes shipped:** 2→1 API machine, auto-stop enabled, VMs right-sized to 1GB/1CPU, bluegreen deploys, `DB_POOL_MAX=3`, three non-essential worker schedulers disabled via env flags, BullMQ metrics scrape cache, socket reconnection cap.

**48h follow-up:** Re-run `scripts/neon-consumption-report.sh --days 3` and `GET /admin/database/query-stats` to confirm Neon CU-hr drop overnight.

---

## Root causes

### Why Fly.io usage was high

| Cause | Detail |
|-------|--------|
| Two always-warm API machines | `min_machines_running = 2`, `auto_stop_machines = false` |
| Over-provisioned VMs | `shared-cpu-2x:2048MB` on API + worker |
| Always-on worker | Required for BullMQ, but same 2GB/2CPU sizing |

### Why Neon usage was high

| Cause | Detail |
|-------|--------|
| Warm Fly processes 24/7 | Up to ~15 pool slots (2×5 API + 1×5 worker) prevented autosuspend |
| Periodic background jobs | Hourly/daily workers on always-on worker (mitigated by dormant gates from prior audits) |
| Connection churn | Partially fixed in #157 (`DB_POOL_IDLE_TIMEOUT_MS=120s`, `installExtensions: false`) |

### What was unnecessarily running

- **Was:** Fly platform probes every 30s on API `/health/live` and worker `/health` — **removed 2026-09-01**
- **Not** CI synthetic cron (already `workflow_dispatch` only)
- **Not** frontend health loops (socket-gated polling already in place)
- **Was:** second API machine always running with no MVP traffic need
- **Was:** email digest, stream clip export, shorts watch-percent schedulers on worker (disabled for MVP)

---

## Health checks

| Location | Path | Frequency | DB? | Action |
|----------|------|-----------|-----|--------|
| Fly API | `/api/v1/health/live` | **Removed** (was 30s) | No | **REMOVED** — manual/deploy only |
| Fly worker | `/health` (bare HTTP in `main.ts`) | **Removed** (was 30s) | No | **REMOVED** — manual/deploy only |
| Nest `HealthController` | `/health`, `/health/ready` | Manual / deploy smoke only | ready=yes | **KEPT** |
| CI deploy | live + ready | On deploy | ready=yes | **KEPT** |
| Admin settings | `/health/ready` | Manual button | yes | **KEPT** |
| Application loops | — | None found | — | N/A |

No application-level continuous `/health` polling was found or added.

---

## Fly.io — before / after

| Metric | Before (2026-09-01 pre-change) | After (deployed) |
|--------|-------------------------------|------------------|
| API machines | 2 × started | **1** × started (`683d61df300d48`) |
| API VM | shared-cpu-2x:2048MB | **shared-cpu-1x:1024MB** |
| Worker machines | 1 × started | 1 × started |
| Worker VM | shared-cpu-2x:2048MB | **shared-cpu-1x:1024MB** |
| `min_machines_running` | 2 | **1** |
| `auto_stop_machines` | false | **stop** |
| Deploy strategy | rolling | **bluegreen** |
| Health check interval | 30s `/health/live` | **None** (manual/deploy only) |

**Post-deploy note:** Bluegreen deploy temporarily created 2 green machines; `fly scale count 1` was run to align with `min_machines_running = 1`. After future bluegreen deploys, verify machine count with `fly machine list -a forge-studios-api`.

**Smoke (post-deploy):** `/api/v1/health/live` → 200 (~0.3s). Worker `GET /health` → `{"status":"ok"}`.

---

## Neon — before / after

| Metric | Before | After |
|--------|--------|-------|
| `DB_POOL_MAX` (API) | 5 | **3** |
| `DB_POOL_MAX` (worker) | 5 | **3** |
| Max connection budget | ~15 (2+1 machines × 5) | **~6** (1+1 × 3) |
| `DB_POOL_IDLE_TIMEOUT_MS` | 120000 | 120000 (unchanged) |
| Pooled URL enforcement | yes | yes (unchanged) |

**48h validation pending:** Neon CU-hr trend (`scripts/neon-consumption-report.sh`), endpoint `active` ↔ `idle` overnight, `query-stats` top queries.

---

## Application

| Area | Change |
|------|--------|
| Duplicate API polling | None needed — already socket-gated |
| Background workers disabled (worker only) | `DISABLE_EMAIL_DIGEST`, `DISABLE_STREAM_CLIP_EXPORT`, `DISABLE_SHORTS_WATCH_PERCENT` |
| BullMQ metrics | 30s refresh cache in `BullmqMetricsService` (fewer Redis `getJobCounts` per Grafana scrape) |
| Socket.IO client | `reconnectionAttempts` capped at 20 (was `Infinity`) |
| MQTT | Not used |
| Logging | Infra probe paths already excluded from pino access logs |

---

## Files changed

| File | Change |
|------|--------|
| [fly.toml](../../fly.toml) | `min_machines_running=1`, `auto_stop_machines=stop`, `strategy=bluegreen`, VM 1024mb/1CPU |
| [fly.worker.toml](../../fly.worker.toml) | VM 1024mb/1CPU |
| [docs/operations/FLY_SLO.md](../operations/FLY_SLO.md) | MVP cost-first posture + rollback notes |
| [docs/audits/NEON_COST.md](./NEON_COST.md) | Connection budget 6 slots, pool max 3 |
| [apps/api/.env.production.example](../../apps/api/.env.production.example) | `DB_POOL_MAX=3`, worker DISABLE flag docs |
| [scripts/sync-fly-worker-secrets.sh](../../scripts/sync-fly-worker-secrets.sh) | Default pool fallback 3 |
| [apps/api/src/common/metrics/bullmq-metrics.service.ts](../../apps/api/src/common/metrics/bullmq-metrics.service.ts) | 30s metrics refresh cache |
| [apps/web/src/lib/socket.ts](../../apps/web/src/lib/socket.ts) | Reconnection cap 20 |

**Fly secrets applied (not in git):**

- `forge-studios-api`: `DB_POOL_MAX=3`
- `forge-studios-worker`: `DB_POOL_MAX=3`, `DISABLE_EMAIL_DIGEST=true`, `DISABLE_STREAM_CLIP_EXPORT=true`, `DISABLE_SHORTS_WATCH_PERCENT=true`

---

## Intentionally kept

- Fly platform health checks (API + worker) — routing, deploy gates, recovery
- BullMQ worker app — VOD ingest, push, scheduled publish, mux sync, subscription maintenance
- Redis + Socket.IO — real-time features
- Hourly subscription expire, daily reconciliation/retention/purge — data integrity / compliance
- Mux sync dormant gate — webhook-first with 15m backup when idle
- Leader-elected API intervals (view count, stream viewer flush)

---

## Remaining risks

| Risk | Mitigation |
|------|------------|
| Cold start ~20s after idle | Accept for MVP; measure with FLY_SLO cold-start script |
| OOM on 1024mb | Monitor Fly metrics; step up to 1536mb if needed |
| Auto-stop limited by 30s health probes | Monitor; consider `min_machines_running=0` if machine never suspends |
| Bluegreen may leave 2 machines | Run `fly machine list` after deploy; `fly scale count 1` if needed |
| Disabled worker features | Re-enable flags when email digest / clips / shorts analytics are needed |

---

## Rollback

```bash
# Fly HA posture (pre-2026-09-01)
# Edit fly.toml: min_machines_running=2, auto_stop_machines=false, memory=2048mb, cpus=2
fly deploy --remote-only --primary-region sin --regions sin
fly scale count 2 -a forge-studios-api

# Neon pool
fly secrets set DB_POOL_MAX=5 -a forge-studios-api
fly secrets unset DISABLE_EMAIL_DIGEST DISABLE_STREAM_CLIP_EXPORT DISABLE_SHORTS_WATCH_PERCENT -a forge-studios-worker
fly secrets set DB_POOL_MAX=5 -a forge-studios-worker
```

---

## Estimated savings direction

| Service | Direction |
|---------|-----------|
| Fly.io | ~60–70% compute (2→1 API machine + half RAM/CPU per VM) |
| Neon | Meaningful CU-hr reduction if endpoint idles overnight (confirm in 48h) |

**Baseline captured pre-change:**

- API: 2 × `shared-cpu-2x:2048MB` started
- Worker: 1 × `shared-cpu-2x:2048MB` started
- `DB_POOL_MAX=5` on both apps
