# FORGE — Infrastructure Audit (Fresh, 2026-07-29)

**Scope:** [`new_dataprompt.md`](../../new_dataprompt.md) (SRE / FinOps / high server-usage RCA) + merge against July 2026 enterprise audits.  
**Method:** Live Fly CLI + code/config inventory. Neon / AWS / Mux / Vercel dashboards **not** available this session (credentials unset / AWS token invalid).  
**Branch:** `fix/production-hardening-audit-2026-07-26` → merged via PR #161; Wave 4 prod verify 2026-07-29.

> **Addendum (2026-07-29 Wave 4):** Mux 5m/15m + `installExtensions: false` are **live in prod** (worker logs: backup every 300s → 900s dormant). Migration `1840000000000` recorded. Automated Release can still hit intermittent `bom` `release_command` capacity — operator path + docs-only skip in [`FLY_SLO.md`](../operations/FLY_SLO.md).

---

## Executive summary

Production is **healthy but expensive at idle**: 2× API + 1× worker, all `shared-cpu-2x:2048MB`, both API machines warm (`auto_stop_machines = false`). Health checks pass. No restart loops observed.

Dominant **variable** idle load was Mux live-sync polling (old 45s/90s) plus Neon pool reconnect churn (`CREATE EXTENSION` on new connections). **Shipped and verified in prod:** webhook-first Mux backup at 5m live/idle / 15m dormant, idle timeout alignment, and `installExtensions: false`. Remaining FinOps unknowns need Mux/AWS/Redis credentialed dashboards.

**Confidence:** Fly inventory High; Redis/Neon/Mux/AWS cost dollar figures Low (blocked on credentials).

---

## Infrastructure inventory (live + config)

| Service | Live state (2026-07-29 Wave 4) | Config |
|---------|-------------------------------|--------|
| Fly API `forge-studios-api` | 2 machines `bom`, both `started`, checks passing, `shared-cpu-2x:2048MB` | [`fly.toml`](../../fly.toml): `min_machines_running=2`, `auto_stop=false`, health `/api/v1/health/live` 15s |
| Fly worker `forge-studios-worker` | 1 machine `bom`, `started`, check passing; Mux scheduler **300s→900s dormant** | [`fly.worker.toml`](../../fly.worker.toml): `WORKER_ONLY=true`, `VIDEO_TRANSCODE_PROVIDER=mux`, restart always |
| Neon Postgres | ~40MB DB; migration `1840000000000` recorded; no slow app-query hotspots | Pool default max 5 Neon; idle 120s; pooled URL required in prod |
| Redis | Not queried (no live `INFO`) | Dual ioredis + node-redis; ~12–20 conn/API machine; require `noeviction` |
| Mux | Backup poll intervals verified via worker logs | Worker owns Bull schedulers |
| AWS S3/CF | CLI token invalid this session | Lifecycle/versioning in `setup-aws-forge.sh` — **re-run when AWS creds valid** |
| Vercel web/admin | Deployed via Deploy Web & Admin workflow (Wave 4) | — |

**Fixed compute floor:** ~6 GB RAM / 6 shared CPUs always on ≈ constant bill even at zero traffic (intentional HA tradeoff per [`FLY_SLO.md`](../operations/FLY_SLO.md)).

---

## Root cause analysis — high server usage alerts

| Rank | Cause | Evidence | Status |
|------|-------|----------|--------|
| 1 | Always-on 2 API + worker | Live machines + `auto_stop=false` | Accepted cost for HA; optional bluegreen later |
| 2 | Mux sync poll (was 45s/90s) | Pre-hardening prod image | ✅ **Prod** 5m live/idle, 15m dormant |
| 3 | Abandoned IDLE rooms blocking dormancy | Pre-hardening counted all IDLE mux rooms | ✅ Windowed candidates shipped |
| 4 | Neon reconnect + `CREATE EXTENSION` | COST_AUDIT #3; TypeORM driver | ✅ Idle 120s + `installExtensions: false` |
| 5 | Redis × queues × machines | `REDIS_CONNECTIONS.md`, ~17 queues | Monitor; noeviction required |
| 6 | High worker concurrency on 2 CPU | analytics 5 + push 3 + chat 3 + … | Scale-ready; tune when queue depth lags |
| 7 | API timers × 2 machines | viewer 30s, views 60s | ✅ Early-exit when no live shipped |

---

## Merge vs prior audits (Critical / High)

| ID | Finding | Prior status | 2026-07-29 |
|----|---------|--------------|------------|
| C1 | `main` branch protection | ✅ tracker | ✅ closed |
| C2 | `CommunitiesService` god object | Open | ⚠️ Partial — Access/Analytics/ChannelLegacy extracted; facade remains |
| C3 | Billing⇄Entitlements cycle | ✅ | ✅ closed |
| C4 | Course SSR/sitemap | ✅ | ✅ closed |
| C5 | Mobile TextEditingController leak | ✅ | ✅ closed |
| C6 | Manual flagship QA | Open | ⚠️ Checklist only; live click-through operator-owned |
| H-* | See tracker | Mixed | Mostly ✅ / ⚠️ partial; H-F4/H-M4/H-Q3 deferred |
| COST #3 | Neon idle timeout | ✅ #157 | ✅ |
| COST #6 | S3 multipart lifecycle | Script done | Needs live AWS apply |
| Continuation | wipe/throttler/ipHash/S3 versioning script | ✅ | ✅ |

Deferred (product triggers): F-1101 Stripe Connect, F-1302 search sidecar, 100K load test — Phase 5.

---

## Access gaps (do not invent numbers)

- Neon CU-hours / `pg_stat_statements` trend over billing window
- Redis `INFO` / CLIENT LIST
- Mux minutes stored/delivered (dollar cost)
- AWS Cost Explorer / S3 object inventory
- Vercel build minutes

Re-run with credentials to fill cost tables.

---

## Risk register (infra)

| Risk | Severity | Mitigation |
|------|----------|------------|
| BOM `release_command` capacity misses | Medium | Fail-closed Release + docs-only skip + [`FLY_SLO.md`](../operations/FLY_SLO.md) operator path |
| Worker SPOF (`--ha=false`) | Medium | Documented; scale when queue lag |
| Static AWS keys | Medium | OIDC/rotation runbook (`AWS_CREDENTIAL_ROTATION.md`) |
| S3 versioning not confirmed live | Medium | Re-run `setup-aws-forge.sh` with valid AWS |

---

## Validation checklist

- [x] Fly API: 2 machines, checks passing, bom  
- [x] Fly worker: 1 machine, check passing, bom  
- [x] Code remediations Critical/High/Medium/Low tracked in IMPLEMENTATION_TRACKER  
- [x] Post-deploy: Mux sync intervals via worker logs (300s → 900s dormant)  
- [x] Migration `1840000000000` recorded on Neon  
- [ ] Neon query-stats trend over billing window (needs longer CU history)  
- [ ] Redis CLIENT LIST within budget (needs access)  
- [ ] Mux monthly dollar checklist (needs dashboard)  
- [ ] AWS S3 versioning applied live  

## Post-remediation verification (2026-07-29)

- CommunitiesService split + community tests green
- Entitlements analytics extraction + reports index migration applied
- Mux 5m/15m + `installExtensions: false` **live in prod** (PR #161 + Wave 4 deploy)
- Live Neon: ~40MB DB, no slow app queries
- Live Fly: API 2× bom healthy; worker 1× bom healthy; Mux scheduler verified
- See [FRESH_AUDIT_2026-07-29_MASTER.md](./FRESH_AUDIT_2026-07-29_MASTER.md) · [IMPLEMENTATION_TRACKER_2026-07-26.md](./IMPLEMENTATION_TRACKER_2026-07-26.md)
- Gateway broadcast listener extraction; Recommendations Redis cache; DevOps pins/CODEOWNERS
- Client High batch (a11y, podcasts, Playwright stubs, mobile Sentry helper)
- Phase 5 deferred status + k6 harness stub  

**Still operator-owned (not blocking Wave 4):** credentialed Mux/AWS FinOps tables; C6 flagship click-through on staging; F-1101 / F-1302 when product triggers fire.
