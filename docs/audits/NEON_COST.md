# Neon database — cost & monitoring

**Date:** 2026-06-17 · **Status:** Audit #3 — cache hardening + post-PR#79 validation

---

## Summary

June 2026 audit #1 addressed query polling (Mux on HTTP, frontend polls, worker schedulers). **Audit #2** (2026-06-12) targeted **24/7 compute burn with near-zero query load**: autosuspend off + background jobs waking DB every 30–90s. **Audit #3** (2026-06-16) adds **Redis read caches** on remaining hot paths and **dormant gates** on low-frequency workers.

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
| Stream viewer flush | 30s Redis (live only) | API | Leader-elected; Postgres reconcile **10m when live, 30m when idle** (skip DB if Redis live set empty) |
| View count flush | 60s | API | Leader-elected; Redis-first, no DB when empty |
| Mux live sync | **5m live/idle / 15m dormant** | Worker | Redis dormant gate skips DB |
| Stream reminder | Delayed job + **30m backup** | Worker | Dormant gate skips backup scan |
| Scheduled publish | Delayed job at `scheduledPublishAt` + **15m backup** | Worker | Was a 1-minute poll (blocked Neon autosuspend). Select `id, userId` only. |
| Subscription maintenance | Hourly | Worker | Dormant gate on expiring scan; always runs `expireDueSubscriptions` |
| Engagement reconciliation | Daily | Worker | SQL batch (not O(users)) |
| Analytics retention | Daily | Worker | |
| Snapshot retention | Daily 04:00 UTC | Worker | |
| Synthetic `/health/*` | Manual only | GitHub `workflow_dispatch` | No cron. Optional diagnostic smoke. |

---

## Monitoring

### Neon API report (monthly)

```bash
export NEON_API_KEY='napi_...'   # never commit
export NEON_ORG_ID='org-divine-pine-40106564'
export NEON_PROJECT_ID='orange-math-53675581'
bash scripts/neon-consumption-report.sh --days 30
```

Script reference: [SCRIPTS.md](../SCRIPTS.md)

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

- [x] Re-run `scripts/neon-consumption-report.sh` — daily CU-hr down (~12 → ~6 post-PR#79)
- [ ] Neon console: endpoint cycles `active` ↔ `idle` (verify during overnight idle window)
- [ ] `query-stats` — reset baseline after Audit #3 deploy; compare top queries
- [x] Live go-live / end still works (webhooks + mux sync) — health OK 2026-06-16
- [x] **Audit #3 deployed** — Release `27631934106` (2026-06-16) after merge PR #80

### Post-deploy checklist (resource audit 2026-08-30)

After shipping delayed scheduled-publish + idle reconcile + **no continuous health probes**:

- [ ] `GET /admin/database/query-stats` — scheduled-publish full-row `SELECT` should drop from ~1,440/day toward the 15m backup (~96/day) plus delayed jobs
- [ ] Neon console: compute `active` ↔ `idle` overnight (`suspend_timeout_seconds=300`)
- [ ] `scripts/neon-consumption-report.sh --days 7` — idle-day CU-hr vs the ~5 CU-hr/day August baseline
- [ ] Scheduled videos still appear in feed/search at/after `scheduledPublishAt`
- [ ] Manual: `GET /api/v1/health/live` and `GET /api/v1/health/ready` still 200 when you curl them; Fly has no continuous `[[http_service.checks]]`

---

## Audit #3 — cache hardening (2026-06-16)

### Root cause analysis

| Root cause | Component | Status |
|------------|-----------|--------|
| Autosuspend disabled | Neon console | **Fixed** — `suspend_timeout_seconds=300` |
| Periodic DB wake 30–90s | API intervals + mux worker | **Fixed** — PR #79 deployed (`cd7cde1`, Release 2026-06-12) |
| Duplicate API interval runners | 2 API replicas | **Fixed** — leader election |
| Uncached `GET /streams/:id` (15s web lobby poll) | `streaming.service.ts` | **Fixed** — `stream:detail:{id}` Redis cache (25s TTL) |
| Chat moderation 2× DB per message | `stream-chat.service.ts` | **Fixed** — moderation status cache |
| Analytics snapshot chat COUNT | `stream-analytics.service.ts` | **Fixed** — Redis minute bucket counter |
| Notifications unread COUNT poll | `notifications.service.ts` | **Fixed** — `notif:unread:{userId}` cache (45s) |
| 5m / hourly worker probes when idle | stream-reminder, subscription-maintenance | **Fixed** — platform dormant gate |
| Fly `min_machines_running=2` + worker 24/7 | Fly.io | **Documented** — keeps pools warm; defer lowering without approval |

### Before / after metrics

| Metric | Before (Jun 5–11) | After PR #79 (Jun 13–15) | After Audit #3 (target) |
|--------|-------------------|--------------------------|-------------------------|
| Daily CU-hr (idle days) | **~12.0** flat | **~6.0** | **< 2** (needs overnight idle + Audit #3 deploy) |
| 14d total CU-hr | 135.65 (Jun 2–15) | — | Re-measure 48h post-deploy |
| Est. monthly compute | ~$38/mo | ~$18/mo | **$5–15** |
| Autosuspend | Off (`0`) | **300s** | 300s |
| Max CU | uncapped | **2** | 2 |
| Peak pooler connections | ~6 | ~6 | ≤ 6 |
| Endpoint state | always active | active (warm Fly keeps waking) | cycles idle overnight |

**PR #79 deploy confirmed:** Release workflow `27429799502` → `cd7cde1` (2026-06-12).

### Shipped fixes (Audit #3 — branch `fix/neon-cost-audit-3`)

| Change | Impact |
|--------|--------|
| `stream:detail:{id}` Redis cache (25s) + bust on lifecycle | Cuts DB reads from live lobby 15s poll |
| Chat moderation Redis cache (`ban` / `timeout` / `ok`) | Removes 2 DB queries per chat message |
| `stream:chat:1m:{id}:{bucket}` counter | Replaces snapshot `COUNT` on `stream_messages` |
| `notif:unread:{userId}` cache (45s) | Fewer unread COUNT queries when socket offline |
| Stream reminder dormant gate | Skips 5m DB scan when platform idle |
| Subscription expiring scan dormant gate | Skips hourly heavy scan; still expires due subs |
| `configuration.ts` poolMax default **5** for Neon | Aligns with `parse-database-config.ts` |
| Mux sync busts stream detail cache on status change | Prevents stale stream metadata |

### Query audit (code review — EXPLAIN via admin `query-stats` post-deploy)

**Top expected hot queries** (watch after `query-stats` reset):

1. `SELECT` streams by id + user join — **mitigated** by stream detail cache
2. `COUNT` notifications unread — **mitigated** by unread cache
3. `SELECT` stream_messages moderation — **mitigated** by mod cache
4. `SELECT` streams live/upcoming lists — already cached (20s) from Audit #2
5. Entitlement checks — already cached (60s socket + entitlements service)

**Indexes:** notification composite index exists (migration `1795000000000`). No new indexes added — add only if `EXPLAIN` shows seq scans after Audit #3 deploy.

```bash
# Baseline after Audit #3 deploy
curl -X POST https://api.forgestudios.net/api/v1/admin/database/query-stats/reset \
  -H "Authorization: Bearer $ADMIN_JWT"
# Wait 24h, then:
curl "https://api.forgestudios.net/api/v1/admin/database/query-stats?limit=50" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

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
