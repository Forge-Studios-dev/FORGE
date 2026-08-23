# Phase 05 — User Platform Audit & Implementation

**Status:** Audit complete, scoped implementation complete, phase report below.
**Date:** 2026-08-23
**Scope:** Account lifecycle (signup/login/OAuth/refresh/MFA), account deletion (GDPR completeness), notification-preference correctness, and any user-platform data-integrity races found along the way.
**Method:** Fresh code-level audit, evidence-based; behavior verified with targeted Jest suites, not just static reading.

---

## 1. Existing State

Auth is JWT + rotating opaque refresh tokens (`refresh_tokens` table, hashed), Google OAuth, optional MFA (TOTP + backup codes), soft-delete account model (`deletedAt` on `users`, no hard delete on self-service deletion). Notification preferences are a single `mutedCategories[]` JSON column checked by a shared `isCategoryMuted`/`categoryForNotificationType` helper (`@forge/shared-types`), already correctly gating in-app (`notifications.service.ts`) and push (`push-dispatch.service.ts`).

---

## 2. Problems Found

### Account deletion — GDPR completeness (fixed this pass)

- **High (fixed):** `admin.service.ts`'s `deleteUser` anonymized `email`/`username`/`displayName` but left `bio`, `avatarUrl`, `bannerUrl`, `websiteUrl`, `channelLinks` untouched — real PII and social links kept rendering on the "deleted" profile page indefinitely, and `mfaSecretEncrypted`/`mfaBackupCodeHashes`/`stripeConnectAccountId` also survived. Fixed by scrubbing all of these in the same anonymization write.
- **Medium (fixed):** `OAuthAccount` rows (`email`, provider identity) are FK-cascaded only on a **hard** delete of the `User` row, which never happens on self-service deletion (soft-delete only). The real linked Google email survived indefinitely in an orphaned row after "deletion." Fixed: `deleteUser` now explicitly deletes the user's `OAuthAccount` rows.
- **High (fixed, product decision confirmed with user):** owned videos were only hidden (visibility → PRIVATE) on deletion, never actually removed — permanent, silent data retention with no stated policy. Implemented a **30-day grace-period hard delete**: new `AccountPurgeService` + daily BullMQ scheduler (`account-purge-daily`, mirrors the existing `SubscriptionMaintenanceScheduler` pattern) scans accounts past `deletedAt + 30d` and hard-deletes their videos (S3/Mux assets + DB row) via a new `VideosService.purgeVideoForDeletedAccount`. Gated by `DISABLE_ACCOUNT_PURGE` env var, matching the existing worker on/off convention.

### Refresh-token rotation — TOCTOU race (fixed this pass)

- **Medium (fixed):** `refreshWithToken` read `storedToken.revoked`, then separately issued new tokens and marked the old one revoked. Two concurrent requests presenting the same refresh token (e.g. duplicate tab restore, retry-on-flaky-network) could both pass the `revoked === false` check before either write landed, both mint a fresh token pair, and both survive — defeating single-use rotation and reuse-detection. Fixed with an atomic claim: `UPDATE refresh_tokens SET revoked = true WHERE id = :id AND revoked = false`, and only the request whose update actually affected a row proceeds to issue tokens. The loser is treated as reuse (revokes all of that user's sessions), which is the same conservative response already used for genuine token-reuse.

### Transactional email ignored notification mute preference (fixed this pass)

- **Medium (fixed):** `notifications.listener.ts`'s `maybeEmailUser` (used by `video.ready` and `stream.started`) sent a transactional email to every user regardless of their `mutedCategories` preference — the in-app and push paths already correctly gated on `isCategoryMuted`, but email was a silent bypass of that preference. Fixed by having `maybeEmailUser` look up the same preference and category (`categoryForNotificationType`) before sending.

### Signup / OAuth-signup duplicate-check race (fixed this pass)

- **Low (fixed):** `signup()` checked for existing email/username with separate `findOne`/`createQueryBuilder` reads before `save()` — under concurrent signups for the same identity, both requests could pass the pre-check and one would hit the DB's unique-index violation as a raw, unhandled 500. Fixed by wrapping `save()` in a try/catch that converts a Postgres `23505` into the same friendly `BadRequestException` the pre-check would have thrown.
- **Low (fixed):** the equivalent first-time-OAuth-login transaction (`loginWithOAuth`, creates `User` + `OAuthAccount` together) had the same race for two concurrent first-time Google logins on the same email. Wrapped the transaction in the same catch/convert pattern.

### Like/dislike reaction — no unique constraint (found, escalated, NOT fixed this pass — needs your call)

- **Upgraded from an assumed "Low, occasional 500" to Medium: this is silent data corruption, not just an error page.** `likes` table has no unique index on `(userId, videoId)` — only non-unique indexes on `userId`, `videoId`, and `(userId, reaction, createdAt)`. `setVideoReaction` does a `findOne` existence check, then `create`+`save` a new row if none exists — no unhandled exception on a race, because there's nothing to collide with. Two concurrent double-click requests with no prior reaction both pass the `existing` check as `null`, both insert a **duplicate** like/dislike row for the same (user, video) pair, and both increment `likeCount`/`dislikeCount` — permanently inflating the count and leaving orphaned duplicate rows with no cleanup path.
- **Not fixed this pass** — closing this properly needs a schema migration (unique index on `(userId, videoId)`) plus either an `ON CONFLICT DO UPDATE` upsert or a dedupe migration for any duplicates that already exist in production data. Per this project's migration-confirmation rule, that's queued for explicit sign-off rather than shipped silently in this pass. Captured in the roadmap below.

### Deferred, no code change (documented only)

- **OAuth CSRF state gap** (`google-oauth.guard.ts`): no `state` parameter validated on the Google OAuth callback. Real fix touches the live OAuth flow end-to-end (needs careful testing against Google's actual redirect, not just unit mocks) — deferred rather than rushed.
- **Followers/following not cleaned up on account deletion:** soft-deleted accounts remain in other users' follower/following lists (their profile is anonymized, so this degrades gracefully rather than leaking PII) — acceptable for now, no action needed.
- **Email verification optional by default** (`auth.requireVerifiedLogin` config): intentional product configuration, not a bug.

---

## 3. Recommended Architecture / Fixes

Same principle as prior phases: ship what's mechanically safe and testable now; defer anything that's a genuine product/policy decision (video retention — resolved this pass via explicit confirmation) or requires a production schema change (like/dislike unique constraint) to an explicit follow-up.

---

## 4. Roadmap

| Task | Priority | Effort | Risk | Notes |
|---|---|---|---|---|
| Add unique index on `likes (userId, videoId)` + upsert `setVideoReaction`, dedupe existing rows first | **P1** | M | Medium (migration touches live table with unknown existing-duplicate count) | Needs explicit go-ahead before running against prod data |
| OAuth CSRF `state` validation on Google callback | P2 | M | Medium | Touches live OAuth flow; test carefully against real Google redirect |
| Standardize follower/following cleanup on account deletion (or explicitly document as intentional) | P3 | S | Low | Currently degrades gracefully via anonymization; not urgent |

---

## 5. Acceptance Criteria (this pass)

- [x] Deleted accounts no longer leak PII (bio/avatar/banner/website/social links/MFA secrets/Stripe Connect ID) or a real linked OAuth email after "deletion."
- [x] Owned videos are hard-deleted 30 days after account deletion (grace period), not retained forever — confirmed as the intended policy.
- [x] Refresh-token rotation is race-safe: only one of two concurrent requests presenting the same token can succeed; the other is treated as reuse.
- [x] Transactional emails (`video.ready`, `stream.started`) respect the user's muted-category preference, matching in-app and push behavior.
- [x] Signup and first-time-OAuth-login no longer surface a raw 500 on a duplicate-identity race; both return a friendly 400.
- [x] No regressions: full API build clean, targeted suites (auth, admin, notifications listener, account-purge, videos.service) 134/134 passing, ESLint clean on all touched files.

---

## 6. Implementation Log

| Fix | Files |
|---|---|
| PII/media scrub + OAuth-account cleanup on account deletion | `apps/api/src/modules/admin/admin.service.ts`, `admin.module.ts`, `admin.service.spec.ts` |
| 30-day grace-period hard delete for videos owned by deleted accounts | `apps/api/src/modules/users/account-purge.{constants,service,scheduler}.ts`, `account-purge.service.spec.ts`, `apps/api/src/modules/content/videos.service.ts` (new `purgeVideoForDeletedAccount`), `apps/api/src/modules/users/users.module.ts`, `apps/api/src/modules/workers/workers.module.ts`, `apps/api/src/modules/workers/account-purge/account-purge.worker.ts` |
| Atomic refresh-token rotation claim (TOCTOU fix) | `apps/api/src/modules/auth/auth.service.ts` (`refreshWithToken`), `auth.service.spec.ts` |
| Transactional email respects notification mute preference | `apps/api/src/modules/notifications/notifications.listener.ts` (`maybeEmailUser`), `notifications.listener.spec.ts` |
| Signup / first-time-OAuth-login duplicate-race → friendly 400 instead of raw 500 | `apps/api/src/modules/auth/auth.service.ts` (`signup`, `loginWithOAuth`), `auth.service.spec.ts` |

**Validation:** `nest build` clean. Targeted Jest: 18 suites / 134 tests passing (`auth`, `admin.service`, `account-purge`, `notifications.listener`, `videos.service`). ESLint clean on every touched file. No new migrations required — `AccountPurgeService` reuses the existing `deletedAt` column.

---

## 7. Deferred / Backlog

The `likes` unique-constraint fix (P1, needs explicit go-ahead for a production migration), OAuth CSRF state validation (P2), and follower/following cleanup standardization (P3) are captured in the roadmap above, not dropped.
