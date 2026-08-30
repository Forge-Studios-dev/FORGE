# Phase 01 — Implementation roadmap (2026-08-29)

Validated against fresh audit in [PHASE_01_UI_UX.md](./PHASE_01_UI_UX.md).

| Slice | Priority | Effort | Risk | Status |
| --- | --- | --- | --- | --- |
| Fresh audit + docs | P0 | S | Low | **Done** |
| Aug-23 C1–H23 closure | P0 | — | — | **Done** (prior waves) |
| Wave 14 share analytics + tiers placeholder | P1 | S | Low | **Done** |
| **N1** Live theater keeps chat (no `fixed inset-0`) | P1 | S | Low | **Done** |
| **N5** Studio tiers list money format | P2 | S | Low | **Done** |
| N2 Studio comments exhaustive pagination | P2 | L | Med | **Done** (Wave 57) |
| N3 DS DataTable/charts sweep | P3 | XL | Med | Deferred → Phase 02 |
| N4 Mobile Trending screen | P2 | M | Low | **Done** (Wave 38 + Explore chip) |
| Brand purple → red | — | M | Med | **Waived** (product identity) |
| CategoryFilter arrow keys | P3 | S | Low | **Done** (HomeFeed CategoryFilter) |
| Custom player chrome | — | XL | High | Deferred → Phase 08 |

## Dependencies

- N1 depends only on `apps/web/src/app/live/[id]/page.tsx` layout.
- N5 depends on `formatCentsUsd` in `apps/web/src/lib/utils.ts` (or currency-aware variant when `t.currency` ≠ USD).

## Validation

- No duplicate of Phase 04 nav IA or Phase 08 player rewrite.
- No unnecessary complexity (no new share schema for channel/live).
- Security: subscriber privacy already gated; no new public PII surfaces.

## Acceptance (close Phase 01)

See checklist in PHASE_01_UI_UX.md §4 — N1 + N5 required for this mop-up close; then PHASE_01_REPORT.
