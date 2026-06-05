# Phase 12 — Code Quality Scorecard

**Audit date:** 2026-06-04

---

## Scores (1–10)

| Dimension | Score | Evidence |
|-----------|-------|----------|
| **Folder structure** | 9 | Feature modules under `apps/api/src/modules/`; web App Router; mobile `lib/features/` |
| **Design patterns** | 8 | Guards, DTOs, mappers, shared-types contracts |
| **Test coverage** | 6 | ~33 API specs; coverage gate on critical modules; mobile unit tests started |
| **Duplication** | 7 | Two Next apps share stack; some entitlement logic repeated at call sites |
| **Complexity** | 7 | Feed cursor logic non-trivial but tested; streaming service manageable |
| **Technical debt** | 7 | Socket.IO aligned; coverage gate enforced; Stripe still deferred |

**Overall code quality:** 7.5/10 — strong backend structure; mobile/admin test depth still thin.

---

## Test inventory

| Area | Framework | Count | CI |
|------|-----------|-------|-----|
| API | Jest | 30 `*.spec.ts` | ✅ `ci.yml` |
| shared-types | Jest | 4 specs | ✅ |
| Web | Playwright | 3–4 e2e specs | ✅ smoke (partial auth needs secrets) |
| Admin | — | 0 | lint + build only |
| Mobile | flutter_test | 1 unit spec (`video_model_test.dart`) | ✅ analyze + `flutter test` |
| design-system | — | 0 | build only |

**API test themes:** auth, entitlements, Mux, playback, permissions, redis utils, production config validation.

**Untested modules (examples):** feed, engagement (limited), admin controller, notifications, gateway, billing, mail, most workers.

**Jest config:** `passWithNoTests: true` in `apps/api/package.json` — allows green CI with zero tests in a workspace.

---

## Technical debt register

| Item | Severity | Path / note |
|------|----------|-------------|
| ~~`express-rate-limit` unused~~ | Resolved | F-301 — removed from `@forge/api` |
| ~~Socket.IO v2 mobile vs v4 API~~ | Resolved | F-302 — `socket_io_client: ^3.0.2` |
| Sentry SDK major skew | Low | API v10, Next v9 |
| ~~No coverage threshold in CI~~ | Resolved | F-1201 — `coverageThreshold` in `apps/api/package.json` |
| ~~No SAST in CI~~ | Resolved | F-801 — CodeQL + npm audit |
| Low TODO/FIXME count | Positive | Sparse in TS codebase |

---

## Dead / scaffold code

| Item | Status |
|------|--------|
| `BillingModule` | Scaffold — intentional Phase 2 |
| FFmpeg worker | Dev-only — must not ship to prod |

---

## Findings

### F-1201: API coverage gate missing — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | Was non-blocking `test:cov` only |
| **Resolution** | `collectCoverageFrom` scopes `auth`, `entitlements`, `content`, `streaming`; global `coverageThreshold` at baseline −2%; CI enforces |
| **Expected impact** | Regression safety on cost-critical paths; ratchet quarterly |

### F-1202: Mobile zero automated tests — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | No `*_test.dart` under `apps/mobile/` |
| **Resolution** | `test/unit/video_model_test.dart`; `flutter test` in `ci.yml` |
| **Expected impact** | Fewer playback regressions (Mux URLs) |

### F-1203: Admin untested

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | Admin CI = lint + build |
| **Recommendation** | Playwright smoke for login + dashboard |
| **Expected impact** | Ops confidence |
