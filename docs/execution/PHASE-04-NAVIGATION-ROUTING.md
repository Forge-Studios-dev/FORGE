# Phase 04 — Navigation & Routing Audit & Implementation

**Status:** Audit complete, scoped implementation complete, phase report below.
**Date:** 2026-08-23
**Scope:** Route architecture beyond what Phase 01's UI/UX lens covered — auth/permission gating consistency, new-feature UI reachability, redirect-chain correctness, route-level code-splitting, cross-app URL structure.
**Method:** Fresh code-level audit, evidence-based.

---

## 1. Existing State

Phase 01 already confirmed no orphaned routes exist in any of the 3 apps. This phase went deeper into gating logic, redirect targets, and cross-app consistency — areas a link-reachability audit doesn't cover.

---

## 2. Problems Found

### New-feature UI reachability

**Confirmed: the 3 backend modules added earlier this session (`articles`, `qa-sessions`, `study-groups`) have zero frontend UI in any app** — API-only, gated behind `FEATURES_SKILL_ECONOMY_LMS` (default off). Expected, matches how they were scoped.

**High — real content-moderation gap, independent of the UI gap:** none of the 3 modules has an admin-scoped controller, and `reports.service.ts`'s `targetType` union (`'video' | 'user' | 'comment'`) has no case for them. If `FEATURES_SKILL_ECONOMY_LMS` is ever flipped on in any environment, approved creators can publish public articles/questions/groups with no report path and no admin review surface. **This must be fixed before the flag is ever enabled anywhere — not before UI is built.** Not fixed this pass (the flag stays off; building admin moderation for content nothing can create yet is speculative work) — flagged in the roadmap as a hard prerequisite gate.

### Auth/permission gating — fixed this pass

- **High (fixed):** mobile's `protectedRoutes` included bare `/profile` and `/playlists`, which (via prefix-matching) also gated `/profile/:username` (a public channel page) and `/playlists/:id` (a public playlist) — **mobile silently required login to view any public channel or playlist, breaking YouTube-parity logged-out browsing that web already supports.** Root cause: `/profile` isn't even a real route (verified via grep — no such `GoRoute` exists), it was dead weight that happened to over-match. Fixed by removing the bare prefixes and adding a new `protectedExactRoutes` list for pages that need exact-only protection (`/playlists`, the owned "my playlists" home) without leaking to their public sub-paths.
- **High (fixed):** web's `/settings/memberships` (billing/subscription) and `/settings/delete-account` were not in `PROTECTED_PREFIXES` at all — no `/settings` entry existed. These relied solely on client-side `isGuest` checks inside the page components, unlike every other sensitive surface which gets middleware-level redirect-to-login before render. Added `/settings` to `PROTECTED_PREFIXES`.
- **Low (fixed):** web had a redundant explicit `/profile/settings` entry, already covered by the `/profile` prefix. Removed while making the settings fix above.
- **Medium, deferred:** `/subscriptions` and `/updates` are protected on mobile but not on web (web disables the query and shows an empty/misleading state instead of redirecting). Inconsistent strategy, not a security gap — deferred, needs a product decision on which pattern (redirect vs. in-place empty state) is the intended UX for guests hitting these specific pages.

### Redirect chains

No loops found. One collapsible two-hop chain found (renamed-user + legacy `/community` alias → canonical username → community slug redirect) — narrow trigger (only affects users who renamed **and** used a legacy shim URL), **deferred**, Low/Medium severity, not worth the risk of touching redirect logic for an edge case this narrow in the same pass as higher-value fixes.

### Route-level code-splitting — fixed this pass

- **High (fixed):** `MiniPlayerDock.tsx` did a static top-level `import Hls from 'hls.js'` and was mounted unconditionally in `providers.tsx` (wrapping every route in the app) — meaning `hls.js` shipped in the bundle for every single page load (settings, /terms, everywhere) regardless of whether a miniplayer was ever active, even though the exact same problem was already correctly solved for the main player (`VideoPlayerLazy.tsx`). Fixed with a new `MiniPlayerDockLazy.tsx` wrapper: renders `null` (no import triggered at all) when no miniplayer session exists, and only `next/dynamic`-imports the real `MiniPlayerDock` (and therefore `hls.js`) once a session actually starts.
- Admin: no finding — `recharts` is already route-isolated by Next's automatic per-route chunking.
- Mobile: no finding — all `GoRoute` builders are already lazy callbacks, no eager top-level screen instantiation.

### URL structure consistency — documented, deferred

- **Medium/High, deferred (architectural):** the "creator channel" resource has 3 different URL shapes across surfaces, and — more substantively — mobile keys the community resource by `creatorId` while web keys the canonical URL by `username`. This is a real identifier-scheme divergence, not a cosmetic path difference, and fixing it would mean touching route params and lookups on at least one platform. Too large/risky for a mechanical pass — roadmapped.
- **Low/Medium, deferred:** playlists naming asymmetry (mobile's "my playlists" home is bare `/playlists`; web's is `/playlists/me`) is the root cause that made the mobile auth-gating bug possible in the first place. The auth bug itself is fixed (see above); renaming the mobile route to match web's convention would be a larger, deep-link-breaking change — roadmapped separately from the security fix.
- **Low, not a bug:** web's two legacy community-alias shims (`/community/:id`, `/communities/id/:id`) both intentionally funnel to the same canonical helper — duplicate surface area, documented as deliberate in the shared helper's own docstring.

---

## 3. Recommended Architecture / Fixes

Same principle as prior phases: fix what's mechanically safe and testable now; defer identifier-scheme and URL-renaming changes that would ripple into deep links, app store review considerations, or need a product decision.

---

## 4. Roadmap

| Task | Priority | Effort | Risk | Notes |
|---|---|---|---|---|
| Build admin moderation surface (report `targetType` cases + review UI) for articles/qa-sessions/study-groups | **P0 — hard gate before enabling the flag anywhere** | M | Low | Must land before `FEATURES_SKILL_ECONOMY_LMS=true` in any environment, including staging |
| Decide + standardize guest-UX pattern for `/subscriptions`/`/updates` (redirect vs. in-place empty state) across web/mobile | P2 | S | Low | Product decision on intended guest experience |
| Collapse the renamed-user two-hop community redirect | P3 | S | Low | Narrow edge case |
| Unify community identifier scheme (username vs. creatorId) across mobile/web | P2 | L | Medium | Architectural; touches route params + lookups |
| Rename mobile's playlists home route to match web's `/playlists/me` convention | P3 | M | Medium | Deep-link/App-Store-review consideration |

---

## 5. Acceptance Criteria (this pass)

- [x] Mobile no longer requires login to view a public channel or public playlist (parity with web restored).
- [x] Web's `/settings/*` billing and account-deletion pages are middleware-gated like every other sensitive surface.
- [x] `hls.js` no longer ships in every page's bundle — only loads when a miniplayer session actually exists.
- [x] No regressions: web 165/165 tests, mobile 186/186 tests (182 baseline + 4 new), both lints clean, both builds clean.

---

## 6. Implementation Log

| Fix | Files |
|---|---|
| Removed over-broad `/profile`/`/playlists` prefix protection on mobile; added `protectedExactRoutes` for exact-only gating | `apps/mobile/lib/core/router/app_router.dart` |
| Updated + added mobile router tests (public channel, public playlist, owned playlists home, owned system playlists) | `apps/mobile/test/unit/auth_redirect_test.dart` |
| Added `/settings` to web's `PROTECTED_PREFIXES`; removed redundant `/profile/settings` entry | `apps/web/src/middleware.ts` |
| New `MiniPlayerDockLazy.tsx` wrapper — conditional + dynamic import, avoids loading `hls.js` until a session exists | `apps/web/src/components/watch/MiniPlayerDockLazy.tsx`, `apps/web/src/app/providers.tsx` |

**Validation:** `eslint` clean on web (pre-existing test-file warnings only), `next build` clean, web unit suite 165/165. `flutter analyze` zero new errors, `flutter test` 186/186 (182 baseline + 4 new cases covering exactly the fixed behavior).

---

## 7. Deferred / Backlog

The admin moderation gate (P0, blocks enabling the LMS flag anywhere), guest-UX standardization, the two-hop redirect, and the two identifier/naming architectural items are captured in the roadmap above, not dropped.
