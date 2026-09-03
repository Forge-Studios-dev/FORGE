# FORGE — Production readiness checklist

Use before promoting a release to production (`main`).

## Environment

- [ ] API: `DATABASE_URL`, Redis, AWS S3, Mux token id/secret, Stripe keys (if billing on)
- [ ] `CSRF_DISABLED` unset/false in production
- [ ] Until CSAM vendor is live: `CONTENT_SCAN_ALLOW_NOOP=true` on API **and** worker (`npm run set:fly:content-scan-secrets` + `sync:fly:worker-secrets`) — ADR-012; **not** CSAM protection
- [ ] Web/Admin: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_URL` (web), billing flag, site URL
- [ ] Mobile: release `apiBaseUrl` assert passes
- [ ] `npm run verify:production` (with prod-like env) passes

## Data

- [ ] Pending TypeORM migrations applied (incl. `185…`–`197…` YouTube wave; captions, notify_level, Super Thanks, pin/heart, channel links, unlisted playlists, history pause; plus `198…`–`201…` dislike columns, `user_blocks`, `username_changed_at`, `username_history`; **`229…` program_purchases** when enabling paid programs; **`230…` `content_scan_held` notification enum**; **`231…` `watch_history(watched_at)` index**)
- [ ] Rollback SQL reviewed for risky migrations

## Media

- [ ] Mux webhooks point at production API (`video.asset.ready`, `track.ready`, live events)
- [ ] Sample upload → READY → HLS playback + optional multi-language captions
- [ ] For private/unlisted/members VOD + live: set Mux playback policy to **signed** and configure `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` (unsigned URLs are withheld when signing is required but keys are missing)

## Billing (if enabled)

- [ ] Stripe webhook endpoint + Connect onboarding smoke
- [ ] Test checkout → membership active → portal cancel
- [ ] Super Thanks tip on a VOD → Connect destination charge + Studio ledger (gross/net/fee) + CSV export + daily summary
- [ ] Confirm skill flags for target environment: `FEATURES_COURSES` / `FEATURES_MENTORSHIP` / `FEATURES_CHANNEL_POINTS` (or legacy `FEATURES_SKILL_ECONOMY_LMS` for full LMS)
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
- [ ] Smoke: Mobile watch Up next end-screen + Loop video
- [ ] Smoke: Studio Change thumbnail (web + mobile) on a ready video
- [ ] Smoke: Mobile playback speed + Copy embed / link at time
- [ ] Smoke: Mobile channel Live tab (live + upcoming)
- [ ] Smoke: Mobile channel Playlists tab + Videos/Shorts sort
- [ ] Smoke: Mobile channel Community posts + About tab
- [ ] Smoke: Mobile Videos list titles; Community image compose
- [ ] Smoke: Mobile channel Home tab; Community expand/reply comments
- [ ] Smoke: Channel Home playlists shelf (web + mobile)
- [ ] Smoke: Channel Community owner Pin/Delete (web + mobile)
- [ ] Smoke: Mobile Studio comments Reply/Remove; channel banner on profile
- [ ] Smoke: Mobile Studio Attention queue + home badge
- [ ] Smoke: Mobile Studio branding; Library Continue watching shelf
- [ ] Smoke: Mobile search Live + Watched filters
- [ ] Smoke: Mobile Library New playlist (create + open detail)
- [ ] Smoke: Mobile playlist Search this playlist (≥4 videos)
- [ ] Smoke: Watch Save → New playlist (description + visibility)
- [ ] Smoke: Mobile notifications category chips + unread badge after mark-read
- [ ] Smoke: Mobile Studio videos search/sort/filters + Playlists link
- [ ] Smoke: Mobile Studio edit Topic tags
- [ ] Smoke: History Pause history → settings privacy toggle
- [ ] Smoke: Studio settings Playlists shortcut
- [ ] Smoke: Library Your videos; Playlists A–Z sort; search type chips; system playlist search
- [ ] Smoke: Shorts CC + Save/Watch later + Block user (web + mobile); Settings username cooldown lock + unlock date
- [ ] Smoke: Watch ⋮ Block user (web + mobile); Feed ⋮ Block user (web + mobile)
- [ ] Smoke: After Block — search/suggestions omit peer; channel videos empty; if they blocked you, channel 403/not found
- [ ] Smoke: After Block — Liked/Watch later/History hide peer videos; Manage subscriptions + DM inbox omit peer
- [ ] Smoke: When they blocked you — channel page shows “not available” (not generic 404); watch of their video same
- [ ] Smoke: Blocked peer live URL / playlist detail / stream chat show “not available”; mobile Shorts deep-link same
- [ ] Smoke: Category explore + similar videos omit blocked peers when signed in; Watch later add fails for blocked creator
- [ ] Smoke: Embed `/embed/:id` shows “not available” (not generic 404) when blocked
- [ ] Smoke (Android): Watch or miniplayer → Home enters OS Picture-in-Picture; web player `p` toggles browser PiP
- [ ] Smoke (iOS device): Watch PiP button / Home while playing enters system AVPlayer PiP (simulator unsupported)
- [ ] Smoke (mobile): Live watch PiP button / Home keeps live in OS PiP; web live `p` / `m` / `f`
- [ ] Smoke: Blocked peer — community detail/join/posts return unavailable/empty (channel Community tab already empty)
- [ ] Smoke: Blocked peer community page shows “not available” (not membership “restricted”) on web + mobile
- [ ] Smoke: After Block — community Report still succeeds; discover search/featured omit that creator
- [ ] Smoke: Blocked peer cannot list/join community study groups; cannot be added to a group DM
- [ ] Smoke: Blocked peer — membership tiers / membership-me / resources (and LMS bundles if on) return unavailable
- [ ] Smoke: Blocked peer — channel-points balance/rewards/redeem return unavailable when LMS flag on
- [ ] Smoke: Blocked peer — live poll/clips/captions/RSVP/raise-hand/reactions return unavailable
- [ ] Smoke: Blocked peer — access-session start fails; LMS public reputation unavailable when flag on
- [ ] When skill flags on: smoke `/discover/courses`, Studio course builder, `/courses/:id` viewer (web + mobile)
- [ ] When `FEATURES_SKILL_ECONOMY_LMS` on: smoke program viewer + paid program Stripe checkout (`POST /programs/:id/checkout`)
- [ ] When mentorship/points flags on: smoke `/studio/mentorship`, `/studio/channel-points` (web + mobile + admin)
- [ ] Optional: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for Studio axe smoke; guest `critical-chrome.spec.ts`

## Content safety (pre-launch)

- [ ] Temporary: health `checks.contentScan` is `noop_ack` (ALLOW_NOOP set) **or** `webhook` — never silent `noop` in production after ADR-012
- [ ] `CONTENT_SCAN_PROVIDER` set to a real vendor integration (not `none`) before open public upload at scale — see `docs/CONTENT_SCANNING.md` and ADR-009
- [ ] Admin Settings health panel + Admin notifications bell show held-scan alerts; Held videos nav works
- [ ] Smoke: held upload → admin notify → `/content?moderationStatus=held`
- [ ] CSAM/illegal-content fast-path documented with legal owner — `docs/ESCALATION_RULES.md`

## Observability / rollback

- [ ] Health endpoint green (DB/Redis)
- [ ] Fly + Vercel rollback owners identified
