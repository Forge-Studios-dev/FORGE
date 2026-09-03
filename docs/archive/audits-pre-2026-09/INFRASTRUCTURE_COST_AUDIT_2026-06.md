# FORGE — Infrastructure, Cost & Performance Audit

**Audit date:** 2026-06-10  
**Status:** Optimizations shipped (Phases 0–2)  
**Prior work:** [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) · [NEON_COST.md](./NEON_COST.md)

---

## Executive summary

FORGE is a production-viable modular monolith. June 2026 hardening addressed the worst idle-DB polling. This audit shipped incremental optimizations targeting Mux sync idle-gate, Redis caching on live lists and analytics, consolidated web polling, SQL poll aggregation, socket entitlement cache, async replay fan-out, and reduced Neon connection pool defaults.

**Expected incremental savings:** 15–35% infra compute/query volume on top of prior Neon fixes.

---

## Phase 0 — Baseline collection (ops runbook)

Run after each major deploy or monthly. No code required.

### 1. Postgres (`pg_stat_statements`)

```bash
# Reset baseline (admin JWT required)
curl -X POST https://api.forgestudios.net/api/v1/admin/database/query-stats/reset \
  -H "Authorization: Bearer $ADMIN_JWT"

# After 24h, top queries
curl "https://api.forgestudios.net/api/v1/admin/database/query-stats?limit=50" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

**Watch:** `/streams/live`, `/streams/:id`, entitlement lookups, poll vote queries.

### 2. Neon console

- Compute hours (week-over-week)
- Active connections (target ≤ 15 with `DB_POOL_MAX=5`)
- Storage growth (analytics_events, stream_analytics_snapshots)

### 3. Fly.io dashboard

- API machine memory/CPU (`forge-studios-api`)
- Worker queue depth via Prometheus `forge_bullmq_jobs_waiting` when `METRICS_ENABLED=true`
- Cold-start probe: [FLY_SLO.md](../operations/FLY_SLO.md)

### 4. Mux dashboard

Monthly checklist: [MUX_COST_OPS.md](../operations/MUX_COST_OPS.md)

### 5. Redis

```bash
fly ssh console -a forge-studios-api -C 'redis-cli -u $REDIS_URL CLIENT LIST | wc -l'
```

Target: ≤ 8 connections per API machine. See [REDIS_CONNECTIONS.md](../operations/REDIS_CONNECTIONS.md).

---

## Shipped optimizations (2026-06-10)

| ID | Change | Files |
|----|--------|-------|
| P1.1 | Idle-gate `stream-mux-sync` when no live/idle work | `mux-live-sync.service.ts` |
| P1.2 | Redis cache `GET /streams/live` + `/upcoming` (20s TTL) | `streaming.service.ts` |
| P1.3 | Web shared `useLiveStreamsQuery` + socket invalidation | `useLiveStreamsQuery.ts`, live pages |
| P1.4 | Poll vote SQL `GROUP BY` aggregation | `stream-live.service.ts` |
| P1.5 | `DB_POOL_MAX=5` default for Neon production | `.env.production.example`, `sync-fly-worker-secrets.sh` |
| P2.1 | Socket entitlement Redis cache (60s TTL) | `events.gateway.ts`, `streaming.service.ts` |
| P2.2 | Async replay fan-out via `premium-content-notify` queue | `streaming.service.ts`, worker |
| P2.3 | Creator analytics Redis cache (30s TTL) | `stream-analytics.service.ts` |
| P2.4 | Notifications composite index + cursor pagination | migration `1795000000000`, `notifications.service.ts` |
| P2.5 | Cap `getExpiringSubscriptions` at 500 rows | `entitlements.service.ts` |
| P2.6 | Adaptive mux-sync: 45s live / 90s idle | `stream-mux-sync.scheduler.ts`, worker |
| Polish | `LiveStreamsSocketSync` single socket subscription | `providers.tsx` |
| Polish | Admin live poll 60s; analytics cache bust on snapshot | admin + `stream-analytics.service.ts` |
| Polish | Stream list cache bust on create/grant; RSVP/caption caps | `streaming.service.ts`, `stream-live.service.ts` |
| Polish | Webhook replay enqueue fail-open; host health poll 45s | `streaming.service.ts`, `StreamHostDashboard.tsx` |

---

## Post-deploy validation (24–48h)

- [ ] Neon compute hours vs prior week
- [ ] `GET /admin/database/query-stats` — `/streams/live` rank drops
- [ ] `forge_bullmq_jobs_waiting{queue="stream-mux-sync"}` stable
- [ ] Mux API call volume down (dashboard)
- [ ] Live stream go-live / end still works via webhooks + sync reconciliation
- [ ] Socket viewer counts accurate across 2 API replicas
- [ ] p95 API latency unchanged or improved

### Automated tests

```bash
cd apps/api && npx jest --testPathPattern="streaming|stream-chat|mux-live|stream-live|entitlements|feed"
```

### Rollback

- Fly: `fly releases rollback -a forge-studios-api`
- Emergency: `DISABLE_STREAM_MUX_SYNC=true`
- Cache stale: delete Redis keys `streams:list:*`, `stream:analytics:*`
- Pool: restore `DB_POOL_MAX=10` via `scripts/sync-fly-worker-secrets.sh`

---

## Remaining deferred items

See [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md): Stripe F-1101, search sidecar F-1302, load test at 50K MAU, Fly `min_machines_running` evaluation.

**Re-audit:** 2026-09-04 or 50K MAU — whichever is sooner.
