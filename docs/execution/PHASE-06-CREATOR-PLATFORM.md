# Phase 06 — Creator Platform Audit & Implementation

**Status:** Audit complete, scoped implementation complete, phase report below.
**Date:** 2026-08-24
**Scope:** Creator-facing business logic and authz boundaries Phases 01-05 didn't cover — creator approval, Studio surfaces, monetization, creator analytics, community moderation, copyright/strikes from the creator's receiving end, live streaming setup.
**Method:** Fresh code-level audit, evidence-based; empirically boot-tested the DI wiring for every new/changed provider against local Postgres/Redis, not just static build — this is exactly the class of bug that broke the Phase 05 worker deploy.

---

## 1. Existing State

Creator monetization (Stripe Connect, tiers, Super Thanks), analytics (studio performance queries), and community-post ownership checks are already solid — see "Verified correct" below. The real gap was entirely on the receiving end of enforcement actions: DMCA takedowns and account strikes fire real consequences (video taken down, upload restricted, termination recommended) with zero creator-facing visibility.

---

## 2. Problems Found

### Creators were never notified of copyright takedowns or account strikes (fixed this pass)

**High.** `copyright.service.ts` and `account-strikes.service.ts` emit 8 distinct events (`copyright.notice_recorded`, `copyright.takedown_issued`, `copyright.counter_notice_filed`, `copyright.video_reinstated`, `account.strike_issued`, `account.strike_appealed`, `account.strike_appeal_resolved`, `account.strike_rescinded`) — confirmed via `grep -rn "@OnEvent('account.strike\|@OnEvent('copyright\."` that **zero listeners existed for any of them**. A creator's video could be taken down and their channel put on the 3-strike termination ladder with no in-app notification, no email, no push — they'd only find out by noticing the video went private.

Digging further during implementation found the gap was worse than "no notification": **there was no frontend page anywhere (web or mobile) to view strikes or a takedown notice at all.** The API had `GET /users/me/strikes` and `POST /copyright/notices/:id/counter-notice`, but nothing linked to them and no page rendered the response — a notification would have pointed nowhere.

**Fixed:**
- 5 new `NotificationType` values (`copyright_takedown`, `copyright_video_reinstated`, `strike_issued`, `strike_rescinded`, `strike_appeal_resolved`) with a migration adding them to the Postgres enum, category-mapped to `creator` in `@forge/shared-types`.
- 5 new listener handlers in `notifications.listener.ts` — in-app + push for all, plus transactional email (respecting the mute preference, per Phase 05's pattern) for the two "you got hit" events: `copyright_takedown` and `strike_issued`.
- New `GET /copyright/notices/:id` endpoint (`copyright.service.ts`'s `getNoticeForUploader`) — scoped to the video owner, deliberately omits claimant email/address (the uploader needs to know who's claiming and why, not the claimant's raw contact info).
- New web page `/settings/strikes`: lists strikes, shows claim details for copyright strikes (fetches the new endpoint), and lets the creator file a counter-notice or appeal a community-guideline strike inline. Linked from the Settings hub nav.
- Notification icon/category metadata and deep-link routing added for web and mobile; mobile's notification tap intentionally resolves to `null` (stays put) for these types since there's no mobile strikes screen yet — explicit, not a silent fallback to a broken link.

### Creator-gated endpoint checked role but not approval status (fixed this pass)

**Medium.** `users.service.ts`'s `requestCreator()` sets `role = CREATOR` immediately on request, before admin approval — `creatorStatus` stays `PENDING` separately, and the JWT strategy re-resolves `role` live per-request. Every creator-sensitive controller correctly uses `CreatorApprovedGuard` (which checks `creatorStatus === APPROVED`) **except one**: `categories.controller.ts`'s `POST :id/ai/suggest-tags` used the bare `@Roles(CREATOR, ADMIN)` guard, letting an unapproved (pending) creator call it immediately after requesting creator status. Blast radius was contained (an AI tag-suggestion cost/abuse vector, not data or money), but the pattern was wrong. Fixed by swapping to `@UseGuards(CreatorApprovedGuard)`.

**Caught during implementation, not the audit:** `CategoriesModule` didn't import `UsersModule`, so `CreatorApprovedGuard` (which needs `UsersService`) couldn't be instantiated there — boot-testing the real Nest app (not just `nest build`, which doesn't catch this) surfaced an `UnknownDependenciesException` identical in shape to the Phase 05 worker incident. Fixed by adding `forwardRef(() => UsersModule)` to `CategoriesModule`, mirroring the same pattern `ContentModule` already uses for the same guard. Re-verified clean boot after the fix — `CategoriesModule`, `UsersModule`, and `AdminModule` all initialize and the app reaches `Nest application successfully started` with a passing `/health` check.

### Likes/dislikes have no unique constraint (found, NOT fixed — needs a migration decision)

**Medium, escalated from the original audit's assumption.** `likes` table has no unique index on `(userId, videoId)`. `setVideoReaction` does a `findOne` existence check then `create`+`save` — a race on two concurrent first-reactions for the same (user, video) pair produces **duplicate rows and permanently inflated like/dislike counts**, not just an error page. Fixing this needs a schema migration (unique index) plus either an upsert rewrite or a dedupe pass for any duplicates already in production data. Deferred to the roadmap pending explicit sign-off, per this project's migration-confirmation convention.

### Verified correct (no re-check needed)

- `CreatorApprovedGuard` — correctly checks role, `isVerified`, and `creatorStatus === APPROVED`; consistently applied on all 22 other creator-gated controllers.
- `analytics.service.ts`'s `getStudioVideoPerformance` — date range clamped [1,90] days, parameterized SQL, scoped to the requesting user, no N+1.
- `billing.service.ts`'s `createSuperThanksCheckout` — amount clamped, blocked-peer check, requires a ready video, blocks self-tipping, `creatorId` derived server-side from `video.userId`.
- `monetization-eligibility.service.ts`, `creator-earnings.service.ts` — parameterized, correctly scoped, refund-excluded aggregates.
- `community-posts.service.ts`'s `updatePost`/`deletePost` — scoped by `{id, communityId}` together, no IDOR.
- Stream-key rotation has no self-service reset endpoint, but each new stream session gets a fresh Mux stream ID/key — a leaked key's blast radius is one session, not the channel. UX-parity gap, not a security hole; not fixed this pass.

---

## 3. Recommended Architecture / Fixes

Same principle as prior phases: ship the notification/authz gap now (real, exploitable-by-omission bug); defer the schema-changing fix (likes unique constraint) for explicit confirmation.

---

## 4. Roadmap

| Task | Priority | Effort | Risk | Notes |
|---|---|---|---|---|
| Add unique index on `likes (userId, videoId)` + upsert `setVideoReaction`, dedupe existing rows first | **P1** | M | Medium (unknown existing-duplicate count in prod) | Needs explicit go-ahead before running against prod data |
| Mobile strikes/copyright screen (parity with the new web `/settings/strikes` page) | P2 | M | Low | Web has the full flow; mobile currently just avoids a dead link |
| Self-service stream-key rotation (YouTube-parity "Reset key" button) | P3 | S | Low | Current mitigation (fresh key per session) is adequate short-term |
| Local dev: `forge-api`'s docker-compose service crashes on a fresh image build (`pino-pretty` is a devDependency, omitted from the production-style Dockerfile image, but compose sets `NODE_ENV=development` which requires it) | P3 | S | Low (local-only; Fly production sets `NODE_ENV=production`, unaffected) | Found while boot-testing this phase's fix; pre-existing, unrelated to Phase 06 code |

---

## 5. Acceptance Criteria (this pass)

- [x] Creators receive an in-app + push notification (and email for the two highest-stakes events) for every copyright/strike event that affects their channel.
- [x] Creators can read the actual claim against their video (claimant name, work/infringement description) and file a counter-notice, or appeal a community-guideline strike, from a real page (`/settings/strikes`).
- [x] The one creator-gated endpoint that skipped the approval check now uses the same guard as every other creator surface.
- [x] No regressions: full API build clean, targeted suites (`categories`, `copyright`, `notifications.listener`, `account-strikes`) 70/70 passing, ESLint clean on every touched TS file, `flutter analyze` clean on touched Dart files, web `next build` clean including the new route.
- [x] The new migration was run against a real local Postgres (not just reviewed statically) and confirmed to add all 5 enum values without error.
- [x] The full Nest app (not just `nest build`) was booted against local Postgres/Redis after every DI-relevant change and reached `Nest application successfully started` with a passing health check.

---

## 6. Implementation Log

| Fix | Files |
|---|---|
| 5 new notification types + migration + category mapping | `apps/api/src/modules/notifications/entities/notification.entity.ts`, `apps/api/src/database/migrations/2240000000000-notification-copyright-strike-types.ts`, `packages/shared-types/src/domain.ts`, `packages/shared-types/src/notification-preferences.ts` |
| 5 new listener handlers (in-app + push + selective email) | `apps/api/src/modules/notifications/notifications.listener.ts`, `notifications.listener.spec.ts` |
| Creator-readable copyright notice endpoint | `apps/api/src/modules/copyright/copyright.service.ts`, `copyright.controller.ts`, `copyright.service.spec.ts` |
| Fixed creator-approval-status gap + its DI wiring | `apps/api/src/modules/categories/categories.controller.ts`, `categories.module.ts` |
| New web Settings > Strikes page (list, claim details, counter-notice, appeal) | `apps/web/src/app/settings/strikes/page.tsx`, `apps/web/src/app/profile/settings/page.tsx` (nav link) |
| Notification icon/category/routing for new types | `apps/web/src/lib/notification-category.ts`, `notification-href.ts`, `apps/mobile/lib/features/notifications/presentation/notifications_screen.dart`, `apps/mobile/lib/core/notifications/notification_href.dart` |

**Validation:** `nest build` clean. Targeted Jest: 6 suites / 70 tests passing. ESLint clean on all touched TS/JS files. `flutter analyze` clean on touched Dart files. Web `next build` clean, `/settings/strikes` compiles. Migration run against local Postgres, verified via `enum_range` that all 5 values landed. Full Nest app boot-tested twice (before and after the `CategoriesModule` DI fix) against local Postgres/Redis — first attempt failed with the same `UnknownDependenciesException` shape as the Phase 05 incident, second attempt reached `Nest application successfully started` plus a passing `/health` check.

---

## 7. Deferred / Backlog

The `likes` unique-constraint fix (P1, needs explicit go-ahead for a production migration), the mobile strikes screen (P2), self-service stream-key rotation (P3), and the local-dev-only `pino-pretty`/`NODE_ENV` mismatch (P3, does not affect production) are captured in the roadmap above, not dropped.
