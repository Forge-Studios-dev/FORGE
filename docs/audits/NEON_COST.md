# Neon database — cost & monitoring

**Date:** 2026-06-12 · **Status:** Idle-compute audit + fixes applied

---

## Summary

June 2026 audit #1 addressed query polling (Mux on HTTP, frontend polls, worker schedulers). **June 2026 audit #2** (this pass) targets **24/7 compute burn with near-zero query load**:

- Root cause: `suspend_timeout_seconds=0` (autosuspend off) + background jobs waking DB every 30–90s
- Fixes: enable autosuspend (300s), cap max CU, Redis leader election on API intervals, deep-idle mux sync, query-efficiency hardening

**Forge Neon IDs (no secrets):**

| Resource | ID |
|----------|-----|
| Org | `org-divine-pine-40106564` |
| Project | `orange-math-53675581` |
| Endpoint | `ep-shiny-poetry-aoxjsrec` |
| Branch | `production` (`br-misty-water-ao98jfuv`) |

---

## Before metrics (May 29 – Jun 12, 2026)

| Metric | Value |
|--------|-------|
| Daily CU-hours (Jun 5–11) | Flat **~12 CU-hr/day** (43,200 CU-sec) |
| Total CU-hours (14d) | **149.6 CU-hr** |
| Est. compute cost (Launch @ $0.106/CU-hr) | **~$15.86** → **~$38/mo** if flat continues |
| DB storage | **~34 MB** total, **~12 MB** neondb |
| Peak pooler connections | **~6** |
| Row activity | One burst (~675 inserts), then idle |
| Branches | **1** (no stale preview branches) |
| Autosuspend | **Off** (`suspend_timeout_seconds=0`) |

### After targets (24–48h post-deploy)

| Metric | Target |
|--------|--------|
| Daily CU-hours (idle days) | **< 2** |
| Est. monthly compute | **~$5–15** (live traffic dependent) |
| Active connections | ≤ 6 peaks (unchanged) |
| Endpoint state | Cycles `active` ↔ `idle` when platform idle |

---

## Connection budget (production)

| Process | Machines | Pool max | Max slots |
|---------|----------|----------|-----------|
| API | 2 | 5 | 10 |
| Worker | 1 | 5 | 5 |
| **Total** | | | **~15** |

- Use Neon **pooled** URL (`-pooler` host) — enforced in production
- Sync worker pool settings: `bash scripts/sync-fly-worker-secrets.sh`
- Production default is `DB_POOL_MAX=5` per machine; raise to 10 if p95 latency degrades

---

## Background jobs (DB impact)

| Job | Frequency | Owner | Notes |
|-----|-----------|-------|-------|
| Stream viewer flush | 30s (live only) | API | Leader-elected (one replica) |
| View count flush | 60s | API | Leader-elected (one replica) |
| Mux live sync | 45s live / 90s idle / **15m dormant** | Worker | Redis dormant gate skips DB |
| Stream reminder | 5m | Worker | |
| Subscription maintenance | Hourly | Worker | |
| Engagement reconciliation | Daily | Worker | SQL batch (not O(users)) |
| Analytics retention | Daily | Worker | |
| Snapshot retention | Daily 04:00 UTC | Worker | |

---

## Monitoring

### Neon API report (monthly)

```bash
export NEON_API_KEY='napi_...'   # never commit
export NEON_ORG_ID='org-divine-pine-40106564'
export NEON_PROJECT_ID='orange-math-53675581'
bash scripts/neon-consumption-report.sh --days 30
```

**Alert:** daily CU-hr > **6** with no live traffic.

### Postgres query stats

- Migration enables `pg_stat_statements`
- `GET /admin/database/query-stats?limit=50` — ranked by total time
- `POST /admin/database/query-stats/reset` — baseline after deploy

```bash
curl "https://api.forgestudios.net/api/v1/admin/database/query-stats?limit=50" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### Post-deploy checklist (24–48h)

- [ ] Re-run `scripts/neon-consumption-report.sh` — daily CU-hr down
- [ ] Neon console: endpoint cycles `active` ↔ `idle`
- [ ] `query-stats` — no unexpected top queries
- [ ] Live go-live / end still works (webhooks + mux sync)

---

## Ops recommendations

1. **Verify autosuspend** after any Neon console change: `suspend_timeout_seconds >= 300`
2. Auto-suspend dev/staging Neon branches after idle; delete preview branches after PR merge
3. Use local Docker Postgres for daily dev (not shared Neon)
4. **Rotate Neon API keys** if exposed in chat/logs
5. Live cost details: [../LIVE.md](../LIVE.md) · DR: [../operations/DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md)

Prior audit: [INFRASTRUCTURE_COST_AUDIT_2026-06.md](./INFRASTRUCTURE_COST_AUDIT_2026-06.md)

---

## Shipped fixes (2026-06-12 idle-compute audit)

| Change | Impact |
|--------|--------|
| Neon autosuspend **300s** + max CU **2** (API) | Compute can suspend when idle |
| Redis leader election on view-count + viewer flush | One API replica runs intervals |
| Mux sync **dormant mode** (15m, Redis gate) | Worker skips DB when platform idle |
| Engagement follow reconciliation SQL batch | O(users) → O(mismatches) |
| Chat replay 5s bucket + 120s window | Fewer replay API calls |
| TopBar notifications poll off when socket connected | Fewer unread COUNT queries |
| Admin live chat poll 30s → 60s | Lower admin DB reads |
| `scripts/neon-consumption-report.sh` | Monthly CU-hour / cost report |

**Ops applied (2026-06-12):** endpoint `suspend_timeout_seconds=300`, `autoscaling_limit_max_cu=2`, project defaults updated.

### Live validation snapshot (2026-06-12, Neon API)

14-day report (`scripts/neon-consumption-report.sh --days 14`):

| Period | CU-hr/day | Notes |
|--------|-----------|-------|
| May 29 – Jun 4 | 4.5 – 11.9 | Ramp-up after project create |
| Jun 5 – Jun 11 | **~12.0 flat** | Autosuspend off (`suspend_timeout=0`) |
| **Total 14d** | **141.5 CU-hr** | Est. **~$15.00** compute |

Endpoint state after ops fix: `suspend_timeout_seconds=300`, `max_cu=2`, `state=active`.

Jun 12 hourly (first day with autosuspend enabled ~16:24 UTC):

| Hour (UTC) | CU-hr |
|------------|-------|
| 00:00 – 15:00 | 0.50 each (unchanged baseline) |
| 16:00 | **0.24** (partial hour — first drop after autosuspend) |

**Interpretation:** Ops fix is applied; full savings need **code deploy** (dormant mux sync, leader election) so worker/API stop waking DB every 30–90s. Re-run report **48h after deploy**; target **< 2 CU-hr/day** on idle days.

**48h validation:** re-run `bash scripts/neon-consumption-report.sh --days 3` after API/worker deploy; paste `query-stats` output to compare top queries.
