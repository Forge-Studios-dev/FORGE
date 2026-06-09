# Neon database — cost & monitoring

**Date:** 2026-06-09 · **Status:** Critical fixes applied

---

## Summary

Neon billing was elevated by idle DB polling, Mux sync on HTTP read paths, stacked frontend polls, and duplicate API/worker flush timers — not connection leaks or web/admin DB access (clients never connect to Postgres directly).

**Fixes shipped:** Redis live-stream index gate, Mux sync via `stream-mux-sync` worker only, DB-only live reads, worker-only schedulers, pool idle timeout, frontend poll reduction.

Expected idle savings: **40–70% compute**, **60–85%** live-related queries.

---

## Connection budget (production)

| Process | Machines | Pool max | Max slots |
|---------|----------|----------|-----------|
| API | 2 | 5 | 10 |
| Worker | 1 | 5 | 5 |
| **Total** | | | **~15** |

- Use Neon **pooled** URL (`-pooler` host) — enforced in production
- Sync worker pool settings: `bash scripts/sync-fly-worker-secrets.sh`
- Production default is `DB_POOL_MAX=5` per machine (trial from 2026-06-10 audit); raise to 10 if p95 latency degrades

---

## Background jobs (DB impact)

| Job | Frequency | Owner |
|-----|-----------|-------|
| Stream viewer flush | 30s (live only) | API |
| Mux live sync | 45s live / 90s idle (adaptive) | Worker |
| Stream reminder | 5m | Worker |
| Analytics retention | Daily | Worker |
| Snapshot retention | Daily 04:00 UTC | Worker |

---

## Monitoring

- Migration enables `pg_stat_statements`
- `GET /admin/database/query-stats?limit=50` — ranked by total time
- `POST /admin/database/query-stats/reset` — baseline after deploy

**Post-deploy (24h):** Neon compute hours, active connections, top queries on `/streams/live` and `/streams/:id`.

---

## Ops recommendations

1. Auto-suspend dev/staging Neon branches after idle
2. Delete stale preview branches after PR merge
3. Use local Docker Postgres for daily dev (not shared Neon)
4. Live cost details: [../LIVE.md](../LIVE.md) · DR: [../operations/DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md)
