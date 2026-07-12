# Fly.io API production SLO (F-1002)

**Related:** [DEPLOY.md](../DEPLOY.md) · [audits/EXECUTIVE_SUMMARY.md](../audits/EXECUTIVE_SUMMARY.md)

---

## Current production config

| Setting | Value | File |
|---------|-------|------|
| `min_machines_running` | **2** (Wave 6 — rolling deploy / zero-downtime swap) | [fly.toml](../../fly.toml) |
| `auto_stop_machines` | `true` | [fly.toml](../../fly.toml) |
| Region | `bom` in [fly.toml](../../fly.toml); production release overrides with `--primary-region sin --regions bom` (see [CI_CD.md](../CI_CD.md)) | [fly.toml](../../fly.toml) |
| Worker | Separate app, no HTTP; `restart.policy = 'always'`, `max_retries = 10` | [fly.worker.toml](../../fly.worker.toml) |

With `min_machines_running = 2`, two API machines stay warm — Fly can swap machines during deploy without a brief outage. Cost: ~2× baseline API machine RAM/CPU vs `min = 1`. Previous F-1002 used `min = 1` for cost; Wave 6 raised this for HA during rolling deploys.

---

## When to use scale-to-zero (`min_machines_running = 0`)

| Use scale-to-zero | Use min = 1 | Use min = 2 |
|-------------------|-------------|-------------|
| Dev / demo Fly apps | Low-traffic preview | **Production consumer API** (current) |
| Cost is top priority and p95 cold start acceptable | Cost-sensitive prod with brief deploy blips OK | Auth-heavy traffic, live streams, zero-downtime deploys |

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

`release.yml`'s `deploy-worker` job force-starts the worker machine after deploy (`if: always()`) to reset Fly's exhausted-retries counter — without this, a machine that crash-looped past `max_retries = 10` on a prior bad deploy stays stopped even after a good deploy ships. See [CI_CD.md](../CI_CD.md) for the full step list.

Rollback Fly config: `fly releases rollback -a forge-studios-api`
