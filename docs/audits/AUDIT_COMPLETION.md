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

## Wave 4 — PR `fix/audit-wave-4`

| ID | Fix | Status |
|----|-----|--------|
| F-1101 | Stripe Phase 2 (checkout, webhooks, cancel) | **Done** — `billing/*`, web `MembershipPanel` |
| — | Redis-backed `ThrottlerStorage` (cross-replica) | **Done** — `redis-throttler.storage.ts` |
| — | Mux signed playback for gated content | **Done** — `mux-signing.service.ts` |
| — | Audit migration (report indexes, Stripe columns) | **Done** — `1760000000000-audit-remediation.ts` |
| F-503 | Community channel N+1 (batch membership) | **Done** — `communities.service.ts` |

## Wave 5 — PR `fix/audit-wave-5`

| ID | Fix | Status |
|----|-----|--------|
| F-505 | Redis cache for `getTierById` / `meetsTierRequirement` (TTL + bust on tier edits) | **Done** — `entitlements.service.ts` |
| F-1301 | Redis cache for `checkAccess` results per viewer:creator (TTL + bust on follow/sub changes) | **Done** — `entitlements.service.ts`, `engagement.service.ts` |

## Wave 6 — PR `fix/audit-wave-6`

| ID | Fix | Status |
|----|-----|--------|
| F-1201 | Jest coverage gate (conservative first thresholds) | **Done** — `apps/api/package.json` |
| F-1202 | Baseline Flutter tests for Video JSON parse + `accessDenied` contract | **Done** — `apps/mobile/test/video_model_test.dart` |

## Wave 7 — PR `fix/audit-wave-7`

| ID | Fix | Status |
|----|-----|--------|
| F-1102 | Mobile access denied UX + signed playback passthrough | **Done** — `watch_screen.dart`, `live_watch_screen.dart`, `video.dart` |

## Wave 8 — PR `fix/audit-wave-8`

| ID | Fix | Status |
|----|-----|--------|
| F-601 | API versioning policy docs | **Done** — `docs/API_VERSIONING.md` |
| F-303 | Redis dual-client operations docs | **Done** — `docs/operations/REDIS.md` |

---

## Finding cross-reference

Executive [14_EXECUTIVE_SUMMARY.md](./14_EXECUTIVE_SUMMARY.md) ranks top 20; phase files use matching `F-XXX` IDs.

