# Operations runbooks

Deferred audit items: [DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md) · Neon monitoring: [NEON_COST.md](../audits/NEON_COST.md)

| Runbook | Purpose |
|---------|---------|
| [CHANNEL_SUNSET.md](./CHANNEL_SUNSET.md) | Enable `community_channels_deprecated` flag (staging → prod) |
| [STRIPE_PRODUCTION_ENABLEMENT.md](./STRIPE_PRODUCTION_ENABLEMENT.md) | Enable live Stripe billing + Connect (F-1101 / CEOS-P05-T026) |
| [MUX_COST_OPS.md](./MUX_COST_OPS.md) | Control Mux variable COGS (F-1001) |
| [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) | Neon PITR, rollback, RPO/RTO (F-901) |
| [MIGRATION_ROLLBACK.md](./MIGRATION_ROLLBACK.md) | Per-migration revert vs PITR decision matrix (CEOS-P16-T028) |
| [FLY_SLO.md](./FLY_SLO.md) | API cold start vs `min_machines_running` (F-1002) |
| [STAGING.md](./STAGING.md) | Staging environment bootstrap (F-902) |
| [REDIS_CONNECTIONS.md](./REDIS_CONNECTIONS.md) | Dual Redis clients (ioredis + node-redis) (F-303) |

Deploy and CI: [DEPLOY.md](../DEPLOY.md) · [CI_CD.md](../CI_CD.md) · [OBSERVABILITY.md](../OBSERVABILITY.md)
