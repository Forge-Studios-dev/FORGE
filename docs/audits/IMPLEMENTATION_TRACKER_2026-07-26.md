# FORGE — Audit Remediation Tracker

**Source of truth:** [FRESH_AUDIT_2026-07-26_MASTER.md](./FRESH_AUDIT_2026-07-26_MASTER.md) + 7 domain reports.
**Branch:** `fix/production-hardening-audit-2026-07-26`
**Order of execution:** Critical → High → Medium → Low → Optimization → Refactoring → Testing → Documentation → Final verification (per user instruction — no reordering).
**Rule:** one item fully done (explain → implement → test → docs → commit) before starting the next. Nothing pushed/merged/PR'd without explicit user go-ahead (`forge-git-branching.md`).

Legend: ⬜ not started · 🔄 in progress · ✅ done · ⏸️ blocked/deferred (reason given) · ❌ explicitly out of scope this pass

---

## Critical (6)

| # | Finding | Status | Notes |
|---|---|---|---|
| C1 | `main` has no GitHub branch protection | ✅ | Applied live via `gh api PUT branches/main/protection` after user confirmation: requires PR + "CI passed" + CodeQL ("Analyze (javascript-typescript)") status checks, 1 approving review (dismiss stale on new commits), blocks force-push/deletion, `enforce_admins: true` (no admin bypass — closes the exact "compromised/careless admin" scenario the finding described), required conversation resolution. Verified live via a follow-up `gh api GET` read-back. |
| C2 | `CommunitiesService` god object (2,035 lines) | ⬜ | Large refactor, staged |
| C3 | `Billing ⇄ Entitlements` circular dependency | ✅ | Root cause was narrower than the module-level symptom suggested: `EntitlementsService` only ever needed the leaf `StripeTierSyncService` (already `@Optional()`-injected). Extracted it into a new standalone `StripeTierSyncModule` (deps: `ConfigService` only) that both `BillingModule` and `EntitlementsModule` now import one-way. `EntitlementsModule` no longer imports `BillingModule` at all; `BillingModule`'s `EntitlementsModule` import dropped its `forwardRef`. Removed the now-unnecessary `forwardRef(() => StripeTierSyncService)` injection in `entitlements.service.ts`. Verified: `tsc --noEmit` clean, full API unit suite (143 suites/912 tests) + e2e-spec suite (6/6) green, ESLint clean. Did not touch C2 (turned out independent — no shared extraction needed). |
| C4 | Course pages client-only, missing SEO/sitemap | ✅ | `courses/[id]/page.tsx` + `discover/courses/page.tsx` converted to async Server Components with `generateMetadata`/static `metadata`, JSON-LD `Course` schema added; interactive parts extracted to `CourseViewerClient`/`CourseCatalogClient`. `sitemap.ts` now emits course routes (bounded via existing `courses/discover/featured?limit=24` — no bulk course-list endpoint exists yet, same bounded-fetch pattern as videos). Verified: `tsc --noEmit` clean, ESLint clean, full `next build` succeeds, both routes render. |
| C5 | Mobile `TextEditingController` leak | ✅ | `playlists_screen.dart:44` — controller now created/disposed in try/finally. Verified: `flutter analyze` clean. |
| C6 | No live/manual QA on flagship flows | ⬜ | Process item — will produce a manual verification checklist; actual click-through requires a running app + human/browser session, flagged explicitly |

## High (23) — tracked per domain, filled in as reached

_(populated when Critical items close)_

## Medium (37) / Low (22)

_(populated when High items close)_

---

## Risks & blockers log

- **C1 (branch protection):** applying this changes how *everyone* on the team pushes to `main` going forward — confirming with user before executing via `gh api`, even though it's explicitly named in the audit and this prompt.
- **C6 (manual QA):** no browser/device session available in this execution context by default — will note this limitation explicitly rather than claim flows were verified when they weren't.
- **C2/C3 (god object + circular dep):** touches `CommunitiesService`, `EntitlementsService`, `BillingModule` — high blast radius, real production revenue/access-control code. Will run full existing test suite after each extraction step, not just at the end.

## Technical debt removed

_(running log, updated as work lands)_

## New technical debt introduced

_(none yet — flag anything here immediately if it happens)_
