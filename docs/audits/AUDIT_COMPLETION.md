# Audit completion checklist

**Completed:** 2026-06-04

---

## Documentation deliverables

| Item | Status |
|------|--------|
| `docs/audits/README.md` index | Done |
| Phases 01–14 reports | Done (15 files, ~1735 lines) |
| `docs/README.md` link | Done |
| `FORGE_PROJECT_MASTER.md` §19 link | Done |

---

## Plan validation

| Check | Result |
|-------|--------|
| All 14 phase files on disk | 15 files in `docs/audits/` |
| `express-rate-limit` unused in `src/` | Confirmed — **removed** from `@forge/api` |
| `ENABLE_VIDEO_WORKER` prod guard | Documented in `DEPLOY.md`, `CI_CD.md`; prod requires `VIDEO_TRANSCODE_PROVIDER=mux` |
| API Jest suite | **117 passed** (31 suites) after remediations |
| Live billing data | Not used (qualitative cost analysis only) |

---

## Week 1–2 remediations implemented (from executive summary)

| ID | Fix | Status | Code |
|----|-----|--------|------|
| F-501 | JWT user snapshot Redis cache (60s TTL) | **Done** | `auth-user-cache.service.ts`, `jwt.strategy.ts` |
| F-502 | Batch entitlements on live stream list | **Done** | `entitlements.service.ts` `checkAccessMany`, `streaming.service.ts` |
| F-301 | Remove `express-rate-limit` | **Done** | `apps/api/package.json` |
| F-501 bust | Cache bust on `logoutAll` | **Done** | `auth.service.ts` |

| F-602 | List `limit` capped at 50 | **Done** | `pagination.util.ts`, admin/search/engagement/reports |
| F-805 | Admin security headers | **Done** | `apps/admin/next.config.mjs` |
| F-803 | Sentry PII default documented | **Done** | `apps/api/.env.example` recommends `false` |
| F-801 | CI npm audit (high+, non-blocking) | **Done** | `.github/workflows/ci.yml` `security-audit` job |
| F-1001 | Mux cost runbook | **Done** | `docs/operations/MUX_COST_OPS.md` |
| F-901 | DR runbook | **Done** | `docs/operations/DISASTER_RECOVERY.md` |
| Auth cache bust on admin user/creator updates | **Done** | `admin.service.ts`, `admin.controller.ts` |

## Wave 2 (Week 3–4) — PR `fix/audit-wave-2`

| ID | Fix | Status |
|----|-----|--------|
| F-1002 | Fly SLO doc + `min_machines_running = 1` | **Done** — [FLY_SLO.md](../operations/FLY_SLO.md), [fly.toml](../../fly.toml) |
| F-903 | BullMQ Prometheus gauges + alerts | **Done** — `bullmq-metrics.ts`, [prometheus-alerts.yml](../../infra/observability/prometheus-alerts.yml) |
| F-902 | Staging bootstrap | **Done** — [STAGING.md](../operations/STAGING.md), [deploy-staging.yml](../../.github/workflows/deploy-staging.yml) |

## Wave 3 — PR `fix/audit-wave-3`

| ID | Fix | Status |
|----|-----|--------|
| F-504 | Analytics retention job | **Done** — `analytics-retention` BullMQ daily on worker |
| F-802 | CSRF for cookie refresh | **Done** — `forge_csrf` + `X-Forge-CSRF` (production); web client updated |
| F-302 | Mobile Socket.IO client v3 | **Done** — `socket_io_client: ^3.0.2` (server 4.7.x) |
| F-801 | CodeQL | **Done** — `.github/workflows/codeql.yml` |
| F-1201 | API coverage in CI | **Done** — non-blocking `test:cov` + artifact (threshold gate next) |

**Remaining top fixes** (backlog): F-1101 Stripe Phase 2, F-503 community N+1, F-505 tier cache, F-1201 enforce 60% gate, F-1202 mobile tests.

---

## Finding cross-reference

Executive [14_EXECUTIVE_SUMMARY.md](./14_EXECUTIVE_SUMMARY.md) ranks top 20; phase files use matching `F-XXX` IDs.
