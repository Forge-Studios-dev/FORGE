# FORGE — Operations runbooks

Operational guides referenced by the [enterprise audit](../audits/README.md) (**closed** 2026-06-05). Deferred items: [DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md).

| Runbook | Purpose |
|---------|---------|
| [MUX_COST_OPS.md](./MUX_COST_OPS.md) | Control Mux variable COGS (F-1001) |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | Neon PITR, rollback, RPO/RTO (F-901) |
| [FLY_SLO.md](./FLY_SLO.md) | API cold start vs `min_machines_running` (F-1002) |
| [STAGING.md](./STAGING.md) | Staging environment bootstrap (F-902) |
| [REDIS_CONNECTIONS.md](./REDIS_CONNECTIONS.md) | Dual Redis clients (ioredis + node-redis) (F-303) |

Deploy and CI: [DEPLOY.md](../DEPLOY.md) · [CI_CD.md](../CI_CD.md) · [OBSERVABILITY.md](../OBSERVABILITY.md)
