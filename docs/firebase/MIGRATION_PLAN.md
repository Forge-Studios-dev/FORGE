# Firebase Migration Plan

No Firestore or Firebase Auth migration. Phased complement adoption only.

## Phase 0 — Observability & analytics (immediate)

- [x] Wire web/mobile to `POST /analytics/events`
- [x] Sentry on web + admin
- [x] Analytics allowlist in API + shared-types

## Phase 1 — OAuth

- [x] `oauth_accounts` migration
- [x] Passport Google strategy
- [x] Web OAuth callback page

## Phase 2 — FCM backend

- [x] `device_tokens` table
- [x] Register/revoke API
- [x] `push-dispatch` BullMQ worker
- [x] Hook notification listener → enqueue push

## Phase 3 — FCM clients

- [x] Web service worker + token registration
- [x] Flutter `firebase_messaging` + registration

## Phase 4 — App Check

- [x] API middleware/guard on public routes
- [x] Web reCAPTCHA Enterprise token header
- [x] Mobile App Check (when configured)

## Phase 5 — Session hardening

- [x] HttpOnly `forge_session` cookie from API
- [x] Middleware reads session cookie
- [x] ADR in `docs/firebase/SESSION_HARDENING.md`

## Rollback

- Set `FCM_ENABLED=false` — in-app + email notifications continue
- Set `APP_CHECK_ENABLED=false` — routes accept requests without App Check header
- OAuth: set `GOOGLE_OAUTH_ENABLED=false`

## Branch workflow

Single feature branch → one PR → one merge to `main` per repo branching rules.
