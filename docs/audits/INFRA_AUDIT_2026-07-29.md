# FORGE — Infrastructure Audit (Fresh, 2026-07-29)

**Scope:** [`new_dataprompt.md`](../../new_dataprompt.md) (SRE / FinOps / high server-usage RCA) + merge against July 2026 enterprise audits.  
**Method:** Live Fly CLI + code/config inventory. Neon / AWS / Mux / Vercel dashboards **not** available this session (credentials unset / AWS token invalid).  
**Branch:** `fix/production-hardening-audit-2026-07-26`

---

## Executive summary

Production is **healthy but expensive at idle**: 2× API + 1× worker, all `shared-cpu-2x:2048MB`, both API machines warm (`auto_stop_machines = false`). Health checks pass. No restart loops observed.

The dominant **variable** load (until WIP deploys) is Mux live-sync polling at 45s/90s plus Neon pool reconnect churn (`CREATE EXTENSION` on new connections). Working-tree hardening moves sync to webhook-first + 5m/15m backup, raises idle timeout alignment, and sets `installExtensions: false`. That is the highest-leverage remediations for usage alerts.

**Confidence:** Fly inventory High; Redis/Neon/Mux/AWS cost numbers Low (blocked on credentials).

---

## Infrastructure inventory (live + config)

| Service | Live state (2026-07-29) | Config |
|---------|-------------------------|--------|
| Fly API `forge-studios-api` | 2 machines `bom`, both `started`, checks passing, `shared-cpu-2x:2048MB`, version 253 | [`fly.toml`](../../fly.toml): `min_machines_running=2`, `auto_stop=false`, health `/api/v1/health/live` 15s |
| Fly worker `forge-studios-worker` | 1 machine `bom`, `started`, check passing, `shared-cpu-2x:2048MB`, version 225 | [`fly.worker.toml`](../../fly.worker.toml): `WORKER_ONLY=true`, `VIDEO_TRANSCODE_PROVIDER=mux`, restart always |
| Neon Postgres | Not queried (no `NEON_API_KEY`) | Pool default max 5 Neon; idle 120s; pooled URL required in prod |
| Redis | Not queried (no live `INFO`) | Dual ioredis + node-redis; ~12–20 conn/API machine; require `noeviction` |
| Mux | Not queried | Worker default Mux; WIP reduces poll storm |
| AWS S3/CF | CLI token invalid | Lifecycle/versioning in `setup-aws-forge.sh` — **not applied live until script re-run** |
| Vercel web/admin | No token | — |

**Fixed compute floor:** ~6 GB RAM / 6 shared CPUs always on ≈ constant bill even at zero traffic (intentional HA tradeoff per [`FLY_SLO.md`](../operations/FLY_SLO.md)).

---

## Root cause analysis — high server usage alerts

| Rank | Cause | Evidence | Status |
|------|-------|----------|--------|
| 1 | Always-on 2 API + worker | Live machines + `auto_stop=false` | Accepted cost for HA; optional bluegreen later |
| 2 | Mux sync poll 45s/90s (prod image) | Pre-WIP defaults in deployed image | **WIP on branch** → 5m live/idle, 15m dormant |
| 3 | Abandoned IDLE rooms blocking dormancy | Pre-WIP counted all IDLE mux rooms | **WIP** windowed candidates |
| 4 | Neon reconnect + `CREATE EXTENSION` | COST_AUDIT #3; TypeORM driver | Idle 120s shipped; **WIP** `installExtensions: false` |
| 5 | Redis × queues × machines | `REDIS_CONNECTIONS.md`, ~17 queues | Monitor; noeviction required |
| 6 | High worker concurrency on 2 CPU | analytics 5 + push 3 + chat 3 + … | Scale-ready; tune when queue depth lags |
| 7 | API timers × 2 machines | viewer 30s, views 60s | **WIP** early-exit when no live |

---

## Merge vs prior audits (Critical / High)

| ID | Finding | Prior status | 2026-07-29 |
|----|---------|--------------|------------|
| C1 | `main` branch protection | ✅ tracker | ✅ closed |
| C2 | `CommunitiesService` god object | ⬜ | Open → Phase 1B |
| C3 | Billing⇄Entitlements cycle | ✅ | ✅ closed |
| C4 | Course SSR/sitemap | ✅ | ✅ closed |
| C5 | Mobile TextEditingController leak | ✅ | ✅ closed |
| C6 | Manual flagship QA | ⬜ | Checklist Phase 1C |
| H-* (23) | See tracker | Mostly open | Remediation Phases 2+ |
| COST #3 | Neon idle timeout | ✅ #157 | ✅ |
| COST #6 | S3 multipart lifecycle | Script done | Needs live AWS apply |
| Continuation | wipe/throttler/ipHash/S3 versioning script | ✅ | ✅ |

Deferred (product triggers): F-1101 Stripe Connect, F-1302 search sidecar, 100K load test — Phase 5.

---

## Access gaps (do not invent numbers)

- Neon CU-hours / `pg_stat_statements`
- Redis `INFO` / CLIENT LIST
- Mux minutes stored/delivered
- AWS Cost Explorer / S3 object inventory
- Vercel build minutes

Re-run with credentials to fill cost tables.

---

## Risk register (infra)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Prod still on old Mux poll intervals until deploy | High | Ship Phase 1A; deploy when authorized |
| Worker SPOF (`--ha=false`) | Medium | Documented; scale when queue lag |
| Static AWS keys / unpinned Actions `@master` | High | Phase 2 pin + OIDC/rotation runbook |
| S3 versioning not live | Medium | Re-run `setup-aws-forge.sh` with valid AWS |

---

## Phased remediation (this program)

1. Finish WIP hardening + C2 + C6 checklist  
2. All High (backend, devops, security, clients, product surfaces)  
3. All Medium  
4. All Low  
5. Deferred backlog features  
6. Verification / `ci:local` / tracker closeout  

Tracker: [`IMPLEMENTATION_TRACKER_2026-07-26.md`](./IMPLEMENTATION_TRACKER_2026-07-26.md)

---

## Validation checklist

- [x] Fly API: 2 machines, checks passing, bom  
- [x] Fly worker: 1 machine, check passing, bom  
- [x] Code remediations Critical/High/Medium/Low tracked in IMPLEMENTATION_TRACKER  
- [ ] Neon query-stats post-deploy (needs creds)  
- [ ] Redis CLIENT LIST within budget (needs access)  
- [ ] Mux monthly checklist (needs dashboard)  
- [ ] AWS S3 versioning applied live  
- [ ] Post-deploy: confirm Mux sync intervals via logs/metrics  

## Post-remediation verification (2026-07-29 code pass)

Completed on branch `fix/production-hardening-audit-2026-07-26` without production deploy:

- CommunitiesService split + 156 community tests previously green  
- Entitlements analytics extraction + reports index migration authored  
- Gateway broadcast listener extraction; gateway specs updated  
- Recommendations trending Redis cache + unit specs  
- DevOps pin/CODEOWNERS/dockerignore/HEALTHCHECK/CSRF/JWT purpose  
- Client High batch (a11y, podcasts, Playwright stubs, mobile Sentry helper)  
- Phase 5 deferred status + k6 harness stub  

**Still requires operator:** Fly deploy to realize Mux poll interval savings; live Neon/Mux/AWS credentialed audits; C6 checklist click-through on staging.
