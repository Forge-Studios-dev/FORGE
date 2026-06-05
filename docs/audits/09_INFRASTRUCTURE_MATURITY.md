# Phase 9 — Infrastructure Maturity Report

**Audit date:** 2026-06-04

---

## Maturity scores (1–10)

| Area | Score | Notes |
|------|-------|-------|
| **CI/CD** | 8 | Path-filtered `ci.yml`; `release.yml` orchestrates Fly + Vercel; manual deploy workflows |
| **Observability** | 7 | API metrics, Grafana assets, Sentry; worker/mobile/front gaps |
| **Secrets management** | 7 | Fly/Vercel/GH secrets; sync scripts; no secrets in git |
| **Disaster recovery** | 5 | DR runbook added; Neon PITR drill still recommended |
| **Environments** | 6 | Staging bootstrap documented + `deploy-staging.yml` |

**Overall infra maturity:** 7/10 — deploy pipeline + staging; DR drill remains.

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

**Gaps:**
- Worker not in metrics verification
- E2E auth tests need optional GH secrets
- Staging not fully automated end-to-end

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

**Gaps:**
- Worker: no HTTP health — process-only monitoring
- Mobile: no crash reporting wired in CI
- Neon/Redis/S3: no vendor dashboards documented in-repo
- Queue depth alerts not enforced in release

---

## Backups & DR

| Asset | Documented backup | Gap |
|-------|-------------------|-----|
| Neon Postgres | Not in repo | **PITR / restore drill needed** |
| Redis | Local compose AOF only | Redis Cloud backup policy not documented |
| S3 media | Not in repo | Lifecycle rules not documented |
| Mux assets | Vendor-managed | Deletion/archival policy not documented |

**Rollback (present):**
- Fly: `fly releases rollback` — `docs/DEPLOY.md`
- Vercel: promote previous deployment

---

## Findings

### F-901: No disaster recovery runbook

| Field | Value |
|-------|-------|
| **Severity** | High (reliability) |
| **Evidence** | `docs/DEPLOY.md` has rollback, not DB restore |
| **Recommendation** | Document Neon PITR steps, RPO/RTO targets, annual drill |
| **Expected impact** | Business continuity |

### F-902: No staging environment

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | Workflows target production URLs only |
| **Recommendation** | Fly staging app + Neon branch + Vercel preview |
| **Expected impact** | Fewer prod incidents; safer load tests |

### F-903: Worker observability gap

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | `release.yml` smokes API metrics, not worker queues |
| **Recommendation** | Grafana alerts on BullMQ depth; Sentry on worker |
| **Expected impact** | Faster incident response on video backlog |
