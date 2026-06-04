# Fly.io API production SLO (F-1002)

**Related:** [DEPLOY.md](../DEPLOY.md) · [10_COST_OPTIMIZATION.md](../audits/10_COST_OPTIMIZATION.md)

---

## Current production config

| Setting | Value | File |
|---------|-------|------|
| `min_machines_running` | **1** | [fly.toml](../../fly.toml) |
| `auto_stop_machines` | `true` | [fly.toml](../../fly.toml) |
| Region | `bom` | [fly.toml](../../fly.toml) |
| Worker | Separate app, no HTTP | [fly.worker.toml](../../fly.worker.toml) |

With `min_machines_running = 1`, one API machine stays warm — avoids cold-start p95 spikes on first request after idle. Cost: baseline ~1× machine RAM/CPU vs scale-to-zero.

---

## When to use scale-to-zero (`min_machines_running = 0`)

| Use scale-to-zero | Use min = 1 |
|-------------------|-------------|
| Dev / demo Fly apps | Production consumer API |
| Cost is top priority and p95 cold start acceptable | Auth-heavy traffic (JWT cache still helps DB) |
| Very low traffic preview apps | Live streams, uploads, realtime |

---

## Measuring cold start (before changing config)

```bash
# After API idle ~5+ min, time liveness:
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "%{time_total}\n" https://api.forgestudios.net/api/v1/health/live
  sleep 2
done
```

Compare Fly dashboard **Time to first byte** before/after config changes.

---

## Worker note

The worker app (`forge-studios-worker`) does not expose HTTP. Queue depth is monitored via API Prometheus metrics (`forge_bullmq_jobs_*`) when `METRICS_ENABLED=true` — see [OBSERVABILITY.md](../OBSERVABILITY.md).

Rollback Fly config: `fly releases rollback -a forge-studios-api`
