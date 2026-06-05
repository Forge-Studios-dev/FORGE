# Audit completion checklist

**Status:** **AUDIT CLOSED**  
**Closed:** 2026-06-05  
**Waves 1–4:** Merged to `main` (PRs #57–#61)  
**Wave 5:** Closure — doc reconcile, Sentry PII ops, Mux idempotency test/doc

---

## Documentation deliverables

| Item | Status |
|------|--------|
| `docs/audits/README.md` index | Done |
| Phases 01–14 reports | Done (reconciled Wave 5) |
| `DEFERRED_BACKLOG.md` | Done |
| `docs/README.md` link | Done |
| `FORGE_PROJECT_MASTER.md` §19 link | Done |

---

## Wave 1 — Performance & quick wins (merged)

| ID | Fix | Status |
|----|-----|--------|
| F-501 | JWT user Redis cache (60s TTL) | **Done** |
| F-502 | Batch entitlements on live stream list | **Done** |
| F-301 | Remove `express-rate-limit` | **Done** |
| F-602 | List `limit` capped at 50 | **Done** |
| F-805 | Admin security headers | **Done** |
| F-801 | CI npm audit (high+, non-blocking) | **Done** |
| F-1001 | Mux cost runbook | **Done** — `docs/operations/MUX_COST_OPS.md` |
| F-901 | DR runbook | **Done** — `docs/operations/DISASTER_RECOVERY.md` |

---

## Wave 2 — Ops & cost (merged)

| ID | Fix | Status |
|----|-----|--------|
| F-1002 | Fly SLO + `min_machines_running = 1` | **Done** |
| F-903 | BullMQ Prometheus gauges + alerts | **Done** |
| F-902 | Staging bootstrap | **Done** — `STAGING.md`, `deploy-staging.yml` |

---

## Wave 3 — Security & hygiene (merged)

| ID | Fix | Status |
|----|-----|--------|
| F-504 | Analytics retention job | **Done** |
| F-802 | CSRF for cookie refresh | **Done** |
| F-302 | Mobile Socket.IO client v3 | **Done** |
| F-801 | CodeQL workflow | **Done** |
| F-1201 | API coverage artifact in CI | **Done** (threshold gate in Wave 4) |

---

## Wave 4 — Remaining backlog (merged)

| ID | Fix | Status | Evidence |
|----|-----|--------|----------|
| F-503 | Community channel N+1 batch | **Done** | `communities.service.ts`, `checkChannelAccessMany` |
| F-505 | Tier metadata Redis cache (300s) | **Done** | `entitlements.service.ts` `getTierById` |
| F-1301 | Viewer:creator access cache (60s) | **Done** | `ent:access:{viewerId}:{creatorId}` |
| F-303 | Redis dual-client documentation | **Done** | `docs/operations/REDIS_CONNECTIONS.md` |
| F-601 | API versioning policy | **Done** | `docs/API_SCHEMAS.md` § API versioning |
| F-1201 | Jest `coverageThreshold` enforced in CI | **Done** | `apps/api/package.json`, `ci.yml` |
| F-1202 | Mobile unit tests + `flutter test` in CI | **Done** | `test/unit/video_model_test.dart` |
| F-1102 | Mobile VOD playback parity (`accessDenied` UI) | **Done** | `video.dart`, `watch_screen.dart` |

---

## Wave 5 — Closure

| ID | Fix | Status | Evidence |
|----|-----|--------|----------|
| — | Phase doc reconcile (02–04, 05 F-504, 09–10, 14) | **Done** | Resolution blocks; stale scale-to-zero / Socket.IO v2 removed |
| F-803 | Sentry PII=false in prod ops scripts + docs | **Done** | `set-sentry-secrets-fly.sh`, `set-sentry-vercel-env.sh`, `OBSERVABILITY.md`, web/admin `.env.example` |
| F-1001 | Mux ingest idempotency doc + unit test | **Done** | `muxVodIngestJobId()`, `mux-vod.constants.spec.ts`, `MUX_COST_OPS.md` |
| — | Formal closure artifacts | **Done** | This file, `README.md`, `DEFERRED_BACKLOG.md`, `FORGE_PROJECT_MASTER.md` §19 |

---

## Deferred (not blocking closure)

See [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md):

| ID | Item |
|----|------|
| F-1101 | Stripe Phase 2 |
| F-1302 | Search sidecar |
| Load test | 100K entitlements simulation |
| Ops | Neon annual restore drill |

**Re-audit:** 2026-09-04 or 50K MAU — whichever is sooner.

---

## Validation (Wave 5)

| Check | Result |
|-------|--------|
| API Jest suite | `npm test --workspace=@forge/api` |
| API coverage gate | `npm run test:cov --workspace=@forge/api` |
| Mobile tests | `flutter test` in `apps/mobile` |
| Stale audit grep | No `min_machines_running = 0` or `socket_io_client ^2` in reconciled phase files |
| Git workflow | Single PR `fix/audit-closure` → merge to `main` |

---

## Finding cross-reference

Executive [14_EXECUTIVE_SUMMARY.md](./14_EXECUTIVE_SUMMARY.md) ranks top 20; phase files use matching `F-XXX` IDs.
