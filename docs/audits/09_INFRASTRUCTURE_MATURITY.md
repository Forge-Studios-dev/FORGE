# Phase 9 — Infrastructure Maturity Report

**Audit date:** 2026-06-04 · **Reconciled:** 2026-06-05 (Wave 5 closure)

---

## Maturity scores (1–10)

| Area | Score | Notes |
|------|-------|-------|
| **CI/CD** | 8 | Path-filtered `ci.yml`; `release.yml`; CodeQL; coverage gate |
| **Observability** | 8 | API metrics, Grafana + BullMQ gauges, Sentry PII=false ops default |
| **Secrets management** | 7 | Fly/Vercel/GH secrets; sync scripts; no secrets in git |
| **Disaster recovery** | 7 | [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md); annual drill in [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) |
| **Environments** | 8 | Staging bootstrap + `deploy-staging.yml` — [STAGING.md](../operations/STAGING.md) |

**Overall infra maturity:** 8/10 — deploy pipeline, staging, DR runbook; Neon restore drill on ops cadence.

---

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push `main` | API (PG+Redis services), web, admin, mobile analyze, packages |
| `release.yml` | After green CI on `main` | API → worker → web + admin prod deploy |
| `deploy-fly.yml` | Manual | Emergency API deploy |
| `deploy-vercel.yml` | Manual | Emergency frontend deploy |
| `deploy-auth-secrets.yml` | Manual | Auth/Firebase/SMTP → Fly |

**Strengths:**
- Concurrency cancel on CI
- Post-deploy smoke: `smoke-api.sh`, `verify-metrics-scrape.sh`
- Production environment in GitHub for secret override

**Remaining gaps:**
- Worker not in release metrics verification (queue depth via Grafana instead)
- E2E auth tests need optional GH secrets

---

## Hosting

| Component | Platform | Config |
|-----------|----------|--------|
| API | Fly `forge-studios-api` | `fly.toml` — 2 CPU, 2GB, BOM region |
| Worker | Fly `forge-studios-worker` | `fly.worker.toml` — no HTTP service |
| Web | Vercel | `apps/web/vercel.json` |
| Admin | Vercel | `apps/admin/vercel.json` |
| DB | Neon | Pooled `DATABASE_URL` |
| Redis | Redis Cloud | `REDIS_URL` |

**Fly API scaling:** `min_machines_running = 1` (F-1002) — see [FLY_SLO.md](../operations/FLY_SLO.md).

---

## Docker & local

- `docker-compose.yml` — Postgres 16, Redis 7, mailpit, optional pgbouncer, api, worker, web, admin
- `docker-compose.prod.yml` — nginx reference (not primary prod path)
- Dockerfiles: `apps/api/Dockerfile`, `Dockerfile.worker`, web/admin Dockerfiles for optional self-host

---

## Monitoring & logging

| Signal | Status |
|--------|--------|
| Structured logs | nestjs-pino, correlation ID |
| Metrics | `GET /metrics` + Prom scrape token |
| Grafana | `infra/observability/`, import scripts |
| Sentry | API + web + admin (optional DSN) |
| OTel | Opt-in OTLP endpoint |
| Health | `/health/live` (cheap), `/ready` (DB, Redis, queues) |

**Remaining gaps:**
- Worker: no HTTP health — process-only monitoring
- Mobile: no crash reporting wired in CI
- Neon/Redis/S3: no vendor dashboards documented in-repo

---

## Backups & DR

| Asset | Documented backup | Gap |
|-------|-------------------|-----|
| Neon Postgres | [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md) | **Annual restore drill** — [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) |
| Redis | Local compose AOF only | Redis Cloud backup policy not documented |
| S3 media | Not in repo | Lifecycle rules not documented |
| Mux assets | Vendor-managed | Deletion/archival policy not documented |

**Rollback (present):**
- Fly: `fly releases rollback` — `docs/DEPLOY.md`
- Vercel: promote previous deployment

---

## Findings

### F-901: No disaster recovery runbook — **Resolved (Wave 1)**

| Field | Value |
|-------|-------|
| **Resolution** | [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md) — Neon PITR steps, RPO/RTO |
| **Ops cadence** | Annual restore drill — [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md) |

### F-902: No staging environment — **Resolved (Wave 2)**

| Field | Value |
|-------|-------|
| **Resolution** | [STAGING.md](../operations/STAGING.md), `.github/workflows/deploy-staging.yml` |
| **Expected impact** | Safer pre-prod validation |

### F-903: Worker observability gap — **Resolved (Wave 2)**

| Field | Value |
|-------|-------|
| **Resolution** | BullMQ Prometheus gauges + Grafana alert rules (`forge_bullmq_jobs_waiting`) |
| **Expected impact** | Faster incident response on video backlog |
