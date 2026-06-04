# Phase 12 — Code Quality Scorecard

**Audit date:** 2026-06-04

---

## Scores (1–10)

| Dimension | Score | Evidence |
|-----------|-------|----------|
| **Folder structure** | 9 | Feature modules under `apps/api/src/modules/`; web App Router; mobile `lib/features/` |
| **Design patterns** | 8 | Guards, DTOs, mappers, shared-types contracts |
| **Test coverage** | 5 | ~30 API specs; thin web E2E; zero mobile/admin unit tests |
| **Duplication** | 7 | Two Next apps share stack; some entitlement logic repeated at call sites |
| **Complexity** | 7 | Feed cursor logic non-trivial but tested; streaming service manageable |
| **Technical debt** | 6 | Unused deps, Socket.IO skew, no CI coverage gate |

**Overall code quality:** 7/10 — strong backend structure; test and client parity lag.

---

## Test inventory

| Area | Framework | Count | CI |
|------|-----------|-------|-----|
| API | Jest | 30 `*.spec.ts` | ✅ `ci.yml` |
| shared-types | Jest | 4 specs | ✅ |
| Web | Playwright | 3–4 e2e specs | ✅ smoke (partial auth needs secrets) |
| Admin | — | 0 | lint + build only |
| Mobile | flutter_test | 0 `*_test.dart` | analyze only |
| design-system | — | 0 | build only |

**API test themes:** auth, entitlements, Mux, playback, permissions, redis utils, production config validation.

**Untested modules (examples):** feed, engagement (limited), admin controller, notifications, gateway, billing, mail, most workers.

**Jest config:** `passWithNoTests: true` in `apps/api/package.json` — allows green CI with zero tests in a workspace.

---

## Technical debt register

| Item | Severity | Path / note |
|------|----------|-------------|
| `express-rate-limit` unused | Low | `apps/api/package.json` |
| Socket.IO v2 mobile vs v4 API | High | `apps/mobile/pubspec.yaml` |
| Sentry SDK major skew | Low | API v10, Next v9 |
| No coverage threshold in CI | Medium | `.github/workflows/ci.yml` |
| No SAST in CI | High | F-801 |
| Low TODO/FIXME count | Positive | Sparse in TS codebase |

---

## Dead / scaffold code

| Item | Status |
|------|--------|
| `BillingModule` | Scaffold — intentional Phase 2 |
| FFmpeg worker | Dev-only — must not ship to prod |

---

## Findings

### F-1201: API coverage gate missing

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | `test:cov` exists locally; not in CI |
| **Recommendation** | CI `jest --coverage` with 60% floor on `auth`, `entitlements`, `content`, `streaming` |
| **Expected impact** | Regression safety on cost-critical paths |

### F-1202: Mobile zero automated tests

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | No `*_test.dart` under `apps/mobile/` |
| **Recommendation** | Widget tests for auth + watch; `flutter test` in CI |
| **Expected impact** | Fewer playback regressions (Mux URLs) |

### F-1203: Admin untested

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | Admin CI = lint + build |
| **Recommendation** | Playwright smoke for login + dashboard |
| **Expected impact** | Ops confidence |
