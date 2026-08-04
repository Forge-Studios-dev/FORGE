# FORGE — Production readiness checklist

Use before promoting a release to production (`main`).

## Environment

- [ ] API: `DATABASE_URL`, Redis, AWS S3, Mux token id/secret, Stripe keys (if billing on)
- [ ] `CSRF_DISABLED` unset/false in production
- [ ] Web/Admin: `NEXT_PUBLIC_API_URL`, billing flag, site URL
- [ ] Mobile: release `apiBaseUrl` assert passes

## Data

- [ ] Pending TypeORM migrations applied (incl. `187…` captions, `188…` notify_level, `189…` super_thanks enum, `190…` caption_tracks, `191…` super_thanks ledger, `192…` fee snapshot, `193…` watch_history_paused, `194…` comment pin/creator heart, `195…` channel website/links, `196…` playlist unlisted)
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

- [ ] `npm install` then targeted API tests (`billing`, `mux-vod`, `search`, diversity)
- [ ] Smoke: home feed, watch (speed/theater/Thanks), subscribe, Studio upload/captions/Super Thanks, live create, admin login
- [ ] Confirm `/studio/courses` and `/podcasts` redirect away from economy orphans
- [ ] Optional: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for Studio axe smoke

## Observability / rollback

- [ ] Health endpoint green (DB/Redis)
- [ ] Fly + Vercel rollback owners identified
