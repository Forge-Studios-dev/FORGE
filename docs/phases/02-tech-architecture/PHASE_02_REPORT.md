# Phase 02 — Technical Architecture (Fresh close · 2026-08-29)

**Status:** Complete (scoped P0/P1)  
**Readiness:** 9 / 10  
**Recommendation:** Closed. XL god-service / forwardRef work stays deferred. Proceed to Phase 03 when ready.

---

## Objective

Harden monorepo contracts: module boundary docs, env validation consistency, AdminUser typing — without XL god-service splits.

---

## Findings (fresh) → disposition

| ID | Severity | Status | Notes |
| --- | --- | --- | --- |
| A1 QueuesModule “single site” doc | High (doc) | **CLOSED** | Map corrected: central + feature re-register |
| A2/A4 LMS + Workers gates | — | Already closed | |
| B1 Flutter ForgeTokens.of | — | Already closed | |
| C1 shared-types video/User | — | Already closed | |
| C3 AdminUser.role string | Med | **CLOSED** | `User['role']` from shared-types |
| D1 API Config validation | Med | **CLOSED** (pre-existing) | `validateProductionEnv` in `main.ts` |
| D2/D3/D4 Client env gaps | Med | **CLOSED** | Schema + hot-path `env` wiring |
| F1/F2 forwardRef / god services | High | **Deferred** | XL; AccessControlFacade later |
| E1 Dual ThemeProviders | Med | Accepted | Separate storage keys |

---

## Changes this pass

| Slice | Change |
| --- | --- |
| Web `env.ts` | `NEXT_PUBLIC_APP_URL`, `BILLING_ENABLED`, `LIVEKIT_URL` |
| Admin `env.ts` | `NEXT_PUBLIC_WEB_URL` + Sentry sample/PII keys |
| Hot paths | site, Membership, settings memberships, studio tiers, live, voice room, CommunityEngage, AdminShell, search, users/[id], reports/[id] |
| AdminUser | `role: User['role']` |
| MODULE_BOUNDARY_MAP | LMS Articles/Qa/StudyGroups; Queues wording; prod config note |

---

## Deferred (not Phase 02 redo)

- `AccessControlFacade` / videos+entitlements+engagement splits  
- Communities forwardRef mesh  
- Community shared-types big-bang  
- Full QueuesModule consolidation  
- WORKER_ONLY ConfigService unification  

---

## Acceptance

- [x] MODULE_BOUNDARY_MAP matches AppModule LMS gates + queue reality  
- [x] Dual-theme architecture documented (unchanged; Flutter of(context) already shipped)  
- [x] Client env schema covers live public keys; hot paths use `env`  
- [x] API production env validation documented as already wired  
- [x] AdminUser role typed to shared-types  

## Next

Phase 03 — Database Architecture (fresh gap pass, then implement).
