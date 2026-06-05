# Audit completion checklist

**Last updated:** 2026-06-04  
**Waves 1–3:** Merged to `main` (PR #57 + follow-ups)  
**Wave 4:** Complete on branch `fix/audit-wave-4`

---

## Documentation deliverables

| Item | Status |
|------|--------|
| `docs/audits/README.md` index | Done |
| Phases 01–14 reports | Done (15 files) |
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

## Wave 4 — Remaining backlog (complete)

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

**Doc reconcile (Step 0):** Phase files updated to reflect Waves 1–4 shipped state.

---

## Deferred / out of scope

| ID | Item | Notes |
|----|------|-------|
| F-1101 | Stripe Phase 2 | Deferred by product choice |
| F-1302 | Search sidecar (Meilisearch) | Trigger when FTS SLO fails |
| Load test | 100K entitlements simulation | Separate perf epic (Month 3) |
| F-1001 code | Mux webhook idempotency code audit | Ops runbook sufficient for now |

---

## Validation

| Check | Result |
|-------|--------|
| API Jest suite | Run `npm test --workspace=@forge/api` on branch |
| API coverage gate | Run `npm run test:cov --workspace=@forge/api` |
| Mobile tests | Run `flutter test` in `apps/mobile` |
| Git workflow | Single PR `fix/audit-wave-4` → merge to `main` (no direct push) |

---

## Finding cross-reference

Executive [14_EXECUTIVE_SUMMARY.md](./14_EXECUTIVE_SUMMARY.md) ranks top 20; phase files use matching `F-XXX` IDs.
