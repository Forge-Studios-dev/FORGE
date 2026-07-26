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
| C1 | `main` has no GitHub branch protection | ⬜ | Live GitHub-settings change — will confirm with user before applying (affects shared team workflow, not just local code) |
| C2 | `CommunitiesService` god object (2,035 lines) | ⬜ | Large refactor, staged |
| C3 | `Billing ⇄ Entitlements` circular dependency | ⬜ | Depends on understanding C2's extraction first (shared surface) |
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
