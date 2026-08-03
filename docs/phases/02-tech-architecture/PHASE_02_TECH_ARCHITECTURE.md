# Phase 02 — Technical Architecture (Fresh Restart)

**Status:** Complete — proceed to Phase 03  
**Supersedes:** Prior report claiming Complete before Phase 01 restart  
**Companion:** [`PHASE_02_FRESH_KICKOFF.md`](./PHASE_02_FRESH_KICKOFF.md), [`MODULE_BOUNDARY_MAP.md`](./MODULE_BOUNDARY_MAP.md)

---

## 1. Objective

Harden architecture boundaries, dual-theme tokens, shared contracts strategy, and env discipline—without DB migrations (03), nav IA (04), or video engines (08–10).

---

## 2. Architecture

See [`MODULE_BOUNDARY_MAP.md`](./MODULE_BOUNDARY_MAP.md).

### AppShell mode matrix (web)

| Mode | Routes | Chrome |
| --- | --- | --- |
| minimal | auth, offline, embed, … | none |
| immersive | `/watch/*`, `/shorts` | none |
| studio | `/studio/**` | TopBar only |
| default | else | TopBar + SideNav + MobileNav + footer |

### LMS soft-retire

- Default: `FEATURES_SKILL_ECONOMY_LMS` unset → `CoursesModule.register()` returns empty module; podcasts/courses APIs 410 via guard when mounted.
- Opt-in: set env `true` to restore LMS controllers.

---

## 3. Audit (fresh)

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| H1 | High | Flutter dark token consts ignore ThemeMode | Slice B: `ForgePalette` + `of(context)` |
| H2 | High | Domain types split | Slice C: document `shared-types/domain.ts` as canonical; incremental adoption |
| M1 | Medium | Economy modules still in AppModule | Slice E: document; no unload without product decision |
| M2 | Medium | Dual ThemeProviders web/admin | Documented; keep separate storage keys |
| M3 | Medium | Stale module map | Slice A: this refresh |
| L1 | Low | Token parity ignores light* | Documented; script stays dark-parity |

Env: web `api.ts` already uses `@/env` — Slice D verified complete.

---

## 4. Acceptance criteria

- [x] MODULE_BOUNDARY_MAP matches AppModule + Phase 01 chrome
- [x] Flutter primary shell uses `ForgeTokens.of(context)` / ThemeExtension
- [x] Dual-theme architecture documented
- [x] Env gap: web client already validated
- [x] PHASE_02_REPORT filed
