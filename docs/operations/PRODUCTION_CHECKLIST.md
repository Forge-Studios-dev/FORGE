# FORGE — Production readiness checklist

Use before promoting a release to production (`main`).

## Environment

- [ ] API: `DATABASE_URL`, Redis, AWS S3, Mux token id/secret, Stripe keys (if billing on)
- [ ] `CSRF_DISABLED` unset/false in production
- [ ] Web/Admin: `NEXT_PUBLIC_API_URL`, billing flag, site URL
- [ ] Mobile: release `apiBaseUrl` assert passes

## Data

- [ ] Pending TypeORM migrations applied (incl. `185…` YouTube wave through `197…` watch_history index cleanup; captions, notify_level, Super Thanks, pin/heart, channel links, unlisted playlists, history pause)
- [ ] Rollback SQL reviewed for risky migrations

## Media

- [ ] Mux webhooks point at production API (`video.asset.ready`, `track.ready`, live events)
- [ ] Sample upload → READY → HLS playback + optional multi-language captions
- [ ] For private/unlisted/members VOD + live: set Mux playback policy to **signed** and configure `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` (unsigned URLs are withheld when signing is required but keys are missing)

## Billing (if enabled)

- [ ] Stripe webhook endpoint + Connect onboarding smoke
- [ ] Test checkout → membership active → portal cancel
- [ ] Super Thanks tip on a VOD → Connect destination charge + Studio ledger (gross/net/fee) + CSV export + daily summary
- [ ] Confirm `FEATURES_SKILL_ECONOMY_LMS` unset (or not `true`) so courses/podcasts controllers are not registered (410 if somehow hit)
- [ ] Optional: staging soak per `docs/operations/LOAD_TEST_RUNBOOK.md`

## Quality

- [ ] `npm install` then targeted API tests (`billing`, `mux-vod`, `search`, diversity, `playlists.service.spec`, `auth.service` changePassword)
- [ ] Web vitest: `SubscribeChannelControl`, `PasswordResetSettings`, `search-history`
- [ ] Flutter: `test/unit/search_history_storage_test.dart`
- [ ] Smoke: home feed, watch (speed/theater/Thanks + Not interested), subscribe notify bell, Shorts menus, Studio upload/captions/Super Thanks, live create, admin login
- [ ] Smoke: Library Liked/Watch later remove + Clear all; TopBar search recent history (clear all + per-item ×); Manage subscriptions (web + mobile); change password in profile settings
- [ ] Smoke: Studio video editor chapter preview (≥3 lines from 0:00); ConfirmDialog on history/playlist clear, comment remove, end live, cancel upload, membership cancel
- [ ] Smoke: Mobile Studio Content — list shows processing/failed; open edit, change visibility, cancel incomplete upload
- [ ] Smoke: Mobile schedule publish (upload + Studio edit ≥15m ahead); Studio analytics impressions/CTR/avg watch
- [ ] Smoke: Mobile Studio captions — upload .vtt + remove track by language
- [ ] Smoke: Mobile watch Show transcript (seek cue); Studio Super Thanks ledger
- [ ] Smoke: Mobile upload custom thumbnail; playlist owner Add videos from library
- [ ] Smoke: Mobile watch chapters seek; Studio/upload chapter preview
- [ ] Confirm `/studio/courses` and `/podcasts` redirect away from economy orphans
- [ ] Optional: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for Studio axe smoke; guest `critical-chrome.spec.ts`
## Observability / rollback

- [ ] Health endpoint green (DB/Redis)
- [ ] Fly + Vercel rollback owners identified
