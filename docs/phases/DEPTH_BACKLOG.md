# Depth backlog (post Master Execution)

Master phases 01–24 are documented. This list tracks **remaining depth** that is intentionally deferred or partially shipped.

## Shipped in depth pass (2026-08-02 → 2026-08-03)

- Primary surface skill/lesson → video voice; subscribe bell; player keys
- Search playlists + duration/upload filters (`search:v4`)
- Not interested + Don’t recommend channel + soft creator diversity
- Personalized notify ≠ All (45d watch gate); muted channels settings
- axe CI: home, login, search, library, subscriptions, shorts, explore, watch; **Studio axe when `E2E_TEST_*` set**
- forYou fetch-ahead diversity; multi-language captions; Studio caption upload
- **Super Thanks:** checkout, notify, watch tip UI, ledger, Studio UI, CSV export, Connect destination charges + fee/net snapshot (migration `192…`), **daily reconciliation summary** (`GET /billing/super-thanks/received/summary`)
- Economy orphans removed (web); Attention kept; dead `components/Courses` removed
- **Skill-economy LMS soft-retire:** `FEATURES_SKILL_ECONOMY_LMS` (default off) → HTTP 410 on courses/podcasts/programs APIs; mobile Studio IA + deep links redirect; **orphan Flutter LMS screens deleted**
- Load scaffold: `scripts/load-test-feed.sh` + `docs/operations/LOAD_TEST_RUNBOOK.md`
- **Channel tabs:** `GET /users/:id/videos?type=video|short`; Home Shorts shelf; Videos ≠ Shorts; Shorts feed like/subscribe rail + creator join on `/videos/shorts`
- **Shorts hydrate:** batch `getViewerVideoReactions` + `getFollowingSet` (2 queries / page)
- **Channel Community tab:** `GET /creators/:creatorId/channel-posts` + inline feed; **owner compose** via `POST /creators/me/channel-posts`; post likes
- **Channel Live tab:** `GET /streams/live|upcoming?creatorId=` lists this channel’s streams
- **Watch autoplay next** (localStorage toggle) + Shorts ↑/↓ keyboard navigation
- **LMS boot gate:** `CoursesModule.register()` + conditional `PodcastsController` when `FEATURES_SKILL_ECONOMY_LMS=true`; content library defaults to video/short; channel Home **Live now** shelf
- **Channel Community media:** `POST /creators/me/channel-posts/media-upload-url` + image compose on channel Community tab
- **Watch history:** remove individual videos (`DELETE /users/me/watch-history/:videoId`) + History page Remove; **Pause watch history** account-synced (`users.watch_history_paused`, migration `193…`, `GET/PUT /users/me/privacy`) + local fast-path
- **Save to playlist modal** on watch (`GET /playlists/me/containing/:videoId`)
- **TopBar notifications dropdown** preview (See all → `/notifications`)
- **Comments sort** Top / Newest (`?sort=top|newest` on video comments)
- **Description timestamps** seek the player on click
- **Trending** page `/trending` + SideNav + Explore chip + sitemap + axe smoke
- **Comment pin + creator heart** (migration `194…`; video owner only)
- **Watch end-screen** Up next overlay with countdown / cancel / play now
- **Share at timestamp** (`?t=` / `1m30s`) + At time copy button; seek on watch load
- **Playlist watch queue** (`?list=`) — Play all / item links, sidebar rail, autoplay next in list
- **Chapters bar** from description lines (`0:00 Title`…; ≥3 chapters starting at 0:00)
- **Loop** toggle on watch (localStorage; disables end-screen autoplay while on)
- **Channel Videos/Shorts sort** Newest / Popular / Oldest (`GET /users/:id/videos?sort=`)
- **Notifications menu** Mark all read (same as `/notifications`)
- **Embed player** `/embed/:id` (shell-less) + Copy embed iframe snippet on watch; framing allowed via CSP `frame-ancestors *` on embed only
- **Search typeahead** TopBar suggestions (titles + channels) via `GET /search/suggestions`
- **Continue / History progress** `viewerProgressSeconds` on incomplete history; progress bar + `?t=` resume on FeedCard
- **Playlist reorder** owner move up/down → `PUT /playlists/:id/reorder`
- **Report presets** YouTube-style reasons on video/channel report + comment report
- **Show transcript** watch panel from WebVTT (seek on cue click; multi-lang when tracks exist)
- **Channel Share / Report** on profile header (non-owner)
- **Channel links** `website_url` + `channel_links` jsonb (migration `195…`); Settings editor; About tab display
- **Player shortcuts help** press `?` for keyboard overlay
- **Transcript API proxy** `GET /videos/:id/captions?language=` (SSRF-guarded server fetch) — watch transcript no longer blocked by CDN CORS
- **FeedCard Save to Watch later** + Copy link (signed-in grid menu)
- **Playlist management** owner Public/Private, rename, delete on playlist detail
- **Subscriptions channel rail** from `GET /users/:id/following` (not only channels present in the feed page)
- **Search Sort by** Relevance / Upload date / View count (`?sort=`, cache `search:v5`)
- **FeedCard Report** via existing report presets dialog
- **Playlist Unlisted** visibility (migration `196…`); create + detail UI; link-access like YouTube (not listed on channel)
- **Miniplayer dock** — continues HLS after leaving watch; explicit Miniplayer control; auto-persist when navigating off `/watch`
- **Library Your videos** → channel Videos tab
- **Search Features: Subtitles/CC** (`?captions=yes`, cache `search:v6`)
- **Description hashtags** → `/search?q=` links (with timestamps)
- **Comment reply counts** on top-level threads + View N replies / Reply split
- **Playlist Share** copy link (public/unlisted + owner)
- **Studio playlists** Unlisted option; Save modal shows unlisted icon
- **Subscriptions infinite scroll** via FeedGrid + following feed
- **Related rail** client hide (Not interested / Don’t recommend) + FeedCard sidebar menus (Watch later / Copy / Report)
- **Playlist Edit details** title + description for owners
- **Subscriptions empty state** copy when following feed is empty
- **Comment @mentions** → `/{username}` + author profile links; timestamps in comments seek player
- **Search Type** Videos / Shorts (`?kind=`, cache `search:v7`)
- **Subscriptions channel filter** rail selects `?channel=` → `GET /videos/feed/following?channelId=`
- **Watch history search** client filter by title/channel
- **FeedCard** channel profile link; **Save to playlist** menu → SaveToPlaylistModal
- **Comments Oldest** sort (`?sort=oldest`)
- **Download** control on watch (disabled — downloads not offered yet)
- **Reply @mention** prefill when replying to a comment
- **Notifications Unread only** filter
- **Create playlist** optional description (DTO + UI; service already supported)
- **Shorts double-tap** to like (+ heart burst)
- **Playback speed** `<` / `>` keyboard shortcuts
- **Search Live** Broadcast filter (`?live=yes`) + Live hits from `/streams/live` in All results
- **Playlist search** filter videos within a playlist (≥4 items)
- **Playback prefs** remember rate + volume/mute in localStorage
- **Playlist shuffle** (`?shuffle=1`) + **Loop playlist** on watch with `?list=`; Shuffle from playlist detail
- **Save to playlist** create with optional description
- **Comment Copy link** (`?lc=`) + highlight/scroll; `GET /videos/:videoId/comments/:commentId`
- **Continue watching** home shelf (`/users/me/watch-history?incomplete=true`)
- **Player** `i` miniplayer; double-click side seek ±10s; library playlist A–Z sort
- **Search Watched / Not watched** (`?watched=`, auth via OptionalJwt; cache skipped; `search:v8`)
- **Theater mode** remembered in localStorage
- **Volume** ↑/↓ keyboard shortcuts
- **History** link to Pause watch history settings

## Shipped in Production Depth Pass (2026-08-03)

- Skill/topic voice: watch tags → search hashtags; upload/studio “tags”; `/explore/skills/*` redirect; sitemap categories; become-creator + MembershipPanel + Studio analytics LMS chrome cleaned; footer/legal/playlist copy
- Light theme FOUC fix (blocking preference script) + tokenized NoAccessCallout / VerifyEmailBanner
- Download control hidden until product-supported
- Shorts `VideoPlayer` `variant="shorts"` (cover crop, mute control, no landscape chrome)
- Studio tiers: course entitlement picker removed; `/studio/branding` Customize channel (ProfileHeader + Studio nav)
- Axe smoke: history + notifications
- forYou: home path uses `RecommendationsService.getPersonalizedFeed` (+ category affinity / exclude-watched fallback path); ranking helper tests
- Flutter: Shorts + Subscriptions bottom nav; Library/You shelves (Watch later, Liked, Explore/Trending); onboarding video voice; feed tab Subscriptions; upload topic tags; AI Copilot deep link → Studio
- Admin: Mentorship removed from primary nav (LMS soft-retire); light-theme FOUC fix; Fraud page design tokens
- Shorts mute control uses volume icons + muted state sync
- Subscribe wording: Shorts Subscribed; live/watch access gates; mobile profile Subscribe/Subscribers; studio visibility Subscribers
- Flutter Shorts: inline HLS playback for active slide (pause/dispose offscreen)
- **Parity polish:** UserList Subscribers/Subscriptions; auth/engage gates subscribe copy; legal follow→subscribe; FeedCard TopicChip only when tagged; glass-panel theme tokens; Super Thanks error copy; upload title placeholder; admin categories + user subscriber labels; mentorship route → dashboard; mobile lesson→video / Follow→Subscribe sweep (watch, studio, live, onboarding, subscriptions, playlists, waiting-approval, profile tokens)
- Live/Studio Super Thanks/visibility labels; mobile Members IA + upload Subscribers vs Members; light-theme toast/playlist skeleton borders; mobile Pause watch history settings; comment creator heart icon
- Entitlements follow→subscribe gate copy; Studio Super Thanks “tips” labels; HomeFeedTabs aria-pressed; FeedCard progress track token; mobile auth/live/community Colors.grey→tokens; playlist Unlisted; watch Like + Subscribe + notify bell menu
- Billing Super Thanks error/API copy; upload/studio visibility YouTube labels; history guest empty; mobile Shorts Like/Subscribe rail; admin Channel points soft-retire subtitle
- Mobile profile/shorts notify bell; watch dislike + comment pin/heart; history Clear; library playlist visibility meta; Super Thanks/Chat warning tokens; Studio comments Pin/Heart; pin aria-labels
- Feed empty-state fix (no infinite skeleton); history swipe/remove; mobile Super Thanks sheet; Shorts dislike + notify menu (web+mobile); playlist Unlisted meta; remaining amber→tokens; Save/Studio aria polish
- **Mobile engage depth:** watch Watch later + Share + Not interested/Don’t recommend; feed Share + thumbs + overflow hide; Shorts Share; Up next rail hide menus; auth/settings error/sign-out → ForgeTokens.error
- **Web/API polish:** Shorts Share; new-subscriber notify metadata includes `followerUsername` (deep-link); community ♥→thumb_up; `video_liked` notify icon thumb_up; PiP/Go Live/Theater/Miniplayer aria-labels; mobile live Share
- **Mobile Save to playlist** sheet (list/toggle/create) on watch
- **Mobile channel links:** website + channel links edit in Settings; bio/links chips on profile
- **Mobile notifications** deep-link navigation (mirror web `notification-href`) + mark-read on open
- **Community likes** fill thumb when `likedByMe`; Shorts Report / Not interested / Don’t recommend (web+mobile)
- **Mobile comments** Top/Newest/Oldest sort + Report; watch description Show more + timestamp seek
- **Mobile muted channels** list/unmute in Settings
- **Parity polish:** paid_event access copy (web watch); mobile `?t=` resume; history search + progress bar resume; comments View replies + @mention prefill; Shorts double-tap like; channel Share/Report; notifications Unread filter
- **Mobile/web parity:** description hashtags + comment linkify/Copy link; share-at-time; feed Watch later/Share/Report; playlist Play all + Share + `?list=`; search playlists; channel Videos/Shorts tabs; Subscriptions channel rail; web profile Subscriptions count link
- **Mobile playlist queue:** honor `?list=` / `?shuffle=1`; queue rail; autoplay next (+ related fallback); Loop playlist / Shuffle / Autoplay toggles; playlist detail Shuffle
- **Mobile search:** sort/kind/duration/upload/CC filter chips + typeahead via `GET /search/suggestions`
- **Comment deep links:** `?lc=` open/highlight + edit/delete on mobile; notification hrefs include `?lc=` (web + mobile)
- **Library unread badge** on Notifications row; **Shorts comments** sheet (web modal + mobile bottom sheet)
- **Mobile playlist owner tools:** Edit details (title/description/visibility), reorder up/down, Shuffle play

## Production-readiness drive (2026-08-04)

- Flutter: all `lib/features/**` screens use `ForgeTokens.of(context)` / `ForgePalette` for light/dark (notifications via semantic `_NotifTone`)
- Shorts deep-link hydrate confirmed: web `?v=` pin+scroll; mobile `initialVideoId` from `/shorts?v=`
- Admin: `/channel-points` → dashboard redirect; Settings LMS oversight links removed
- Targeted API Jest: 81 tests passed; admin `tsc --noEmit` clean

## Hardening pass (2026-08-04 cont.)

- Logout CSRF: API always asserts CSRF (incl. `allDevices`); web + admin send `X-Forge-CSRF` on logout
- Channel points API boot-omit via `ChannelPointsModule.register()` when LMS flag off
- Studio analytics skips `courses` / `creator_programs` queries when LMS off
- Upload topic tags optional (API + web + mobile) — YouTube parity
- Mobile subscribe uses `/channels/:id/subscribe` (not legacy `/follow`)

## Hardening pass 2 (2026-08-04)

- Studio video update: empty topic tags allowed (DTO + `applySkillTagUpdate` + Studio UI)
- LMS HTTP soft-retire: Mentorship, Brands, Gamification controllers + bundle routes return 410 when LMS off
- Studio analytics also skips brands/bundles queries when LMS off
- Mobile Home AppBar notifications bell + unread badge
- Removed deprecated `SkillChip` export (TopicChip only)

## Hardening pass 3 (2026-08-04)

- Remove Community XP/leaderboard UI (web + mobile) — APIs return 410 with LMS off
- Remove mobile Home streak/XP chip (platform gamification retired)

## Hardening pass 4 (2026-08-04)

- Content library: parameterized SQL binds for `creatorId`/`categoryId` + UUID validation (closes injection risk)
- XP write soft-retire: `GamificationListener` + referral rewards no-op when LMS flag off
- Removed self-service `POST .../achievements/:key/unlock` (service unlock remains internal)
- Studio business analytics: omit XP/course funnel stages + reweight engagement when LMS off
- Mobile live Q&A/poll panels: `ForgeTokens.of(context)` (light/dark)
- Clients: subscriptions rails + UserList use `/channels/:id/subscribers|subscriptions`

## Hardening pass 5 (2026-08-04)

- Community deep links: `/community/:id` + `/communities/id/:id` redirect to `/{username}/c/{slug}`
- Community e2e defaults LMS off and asserts gamification 410
- Retention + admin KPIs use chat/posts/watch signals when LMS off (not XP)
- Comment report dialog: aria-modal, labelled title, Escape + backdrop close
- Mobile auth/studio/memberships: remaining Colors.* → ForgeTokens

## Hardening pass 6 (2026-08-04)

- Community notify metadata includes `creatorId`/`username`/`slug`; clients deep-link correctly (no community UUID as creatorId)
- Report content dialog a11y parity; Studio analytics CSV export shows errors
- Channel reorder validates UUID array DTO
- Boot-omit Brands/Mentorship controllers + Gamification HTTP when LMS off (service retained)

## Hardening pass 7 (2026-08-04)

- Engagement: `ParseUUIDPipe` on video/comment/channel IDs; pin/creator-heart DTOs with `@IsBoolean`
- Updates feed returns `creatorUsername`; web/mobile use `/subscribers` + `/subscriptions` (legacy paths redirect)
- Creator bundles HTTP moved to boot-omitted `CreatorBundlesController` when LMS off
- Removed empty mobile `features/gamification` tree

## Hardening pass 8 (2026-08-04)

- Soft-retire community wiki/challenges/surveys (`SkillEconomyLmsGuard` + e2e 410); Engage panel keeps rooms/events only; Posts default tab
- Group DM DTOs + `ParseUUIDPipe` on conversation IDs; UUID pipes on playlists / video `:id` / notification read
- Gate `ecosystem-tree` behind LMS; remove Studio analytics duplicate communities fetch
- Delete unused Studio Community LMS panels; CategoryFilter + CommunityPanel tablist a11y

## Hardening pass 9 (2026-08-04)

- Mobile community: drop wiki/challenges/surveys; Posts/Polls/Rooms tabs; Studio Engagement tab removed
- Community posts: DTOs + `ParseUUIDPipe`; streaming `:id` UUID pipes
- Delete dead `StudioBadgeConfigPanel` + mobile `StudioEngagementScreen`
- Welcome modal dialog a11y; TopBar Sign in visible on mobile

## Hardening pass 10 (2026-08-04)

- Add real web `/[username]/subscribers` + `/[username]/subscriptions` pages so ProfileHeader links resolve
- Add `/communities/id/[communityId]` redirect page and make discover paid/fallback links route through canonical community resolution

## Hardening pass 11 (2026-08-04)

- Add `ParseUUIDPipe` across active community member, moderation, and room endpoints
- Update mocked community e2e IDs to valid UUIDs and keep the suite green under the stricter guards

## Hardening pass 12 (2026-08-04)

- Fix `GET /streams/:id/breakout-rooms` to read `communityId` from query params instead of a GET body
- Add nested `ParseUUIDPipe` validation on live moderator, poll, audience-request, and co-host IDs; cover the breakout query contract with a controller test

## Hardening pass 13 (2026-08-04)

- Add `ParseUUIDPipe` across still-mounted UUID-backed `communities.controller` params (community/category/channel/message IDs)
- Add negative mocked e2e coverage proving malformed community IDs return `400` before service logic runs

## Hardening pass 14 (2026-08-04)

- Replace remaining anonymous live-control bodies with DTOs for audience requests, breakout controls, co-host add, and VIP config
- Add focused stream DTO validation specs alongside the existing breakout controller coverage

## Hardening pass 15 (2026-08-04)

- Fix avatar/banner uploads to persist URLs only after an explicit finalize call; add profile image size checks on API and web/mobile clients
- Add user service coverage for non-persistent presign, oversize rejection, and finalize persistence

## Hardening pass 16 (2026-08-04)

- Add DTO validation for `users/me/privacy` and `users/me/interests`, plus UUID guards on active user-profile list/detail routes
- Add focused DTO tests covering malformed privacy values and invalid/oversized interest arrays

## Hardening pass 17 (2026-08-04)

- Rename the active web/mobile upload helper layer from `lesson` to `video` terminology and delete the now-orphaned `upload-lesson.ts`
- Clean the remaining watch-detail/internal upload comments that still referenced LMS-era lesson naming

## Hardening pass 18 (2026-08-04)

- Tighten web LMS legacy routing by redirecting nested `/studio/programs/...` paths through `next.config.mjs` instead of leaving deep links to dead IA
- Confirm the existing web course redirects already cover `/courses` and `/discover/courses`, avoiding duplicate filesystem routes

## Hardening pass 19 (2026-08-04)

- Add `ParseUUIDPipe` coverage to active live/video creator endpoints: stream chat, stream Q&A, studio stream analytics, browser broadcast controls, and creator resource routes
- Verify the change with a targeted API smoke test on `stream-analytics.controller.spec.ts`

## Hardening pass 20 (2026-08-04)

- Extend `ParseUUIDPipe` validation across active membership, analytics, referral, fraud-detection, and admin moderation/detail routes
- Verify the admin-facing controller pass with `admin.security.spec.ts`

## Hardening pass 21 (2026-08-04)

- Replace raw inline bodies with DTO-validated payloads on active room messaging/permissions, creator AI moderation/insights, fraud alert updates, and admin creator/report moderation actions
- Add missing UUID validation to active creator AI community/room routes
- Verify with targeted API smoke tests on `community-rooms.service.spec.ts` and `admin.security.spec.ts`

## Hardening pass 22 (2026-08-04)

- Add DTO validation to active community event and creator resource payloads instead of accepting raw inline bodies
- Add `ParseUUIDPipe` coverage to active community event route params
- Verify with targeted API smoke tests on `community-events.service.spec.ts` and `creator-resources.service.spec.ts`

## Hardening pass 23 (2026-08-04)

- Add DTO validation for active community group creation and `ParseUUIDPipe` coverage across community group and poll route params
- Verify the community poll route pass with `community-polls.service.spec.ts`

## Hardening pass 24 (2026-08-04)

- Add `ParseUUIDPipe` validation to the remaining mounted `communities` controller creator/community-channel routes (`creatorId` public lookups and deprecated channel message send)
- Confirm the controller compiles cleanly via IDE diagnostics; no direct Jest coverage was discoverable for those exact endpoints under the current API test matcher

## Hardening pass 25 (2026-08-04)

- Update the mocked community HTTP e2e suite to use valid UUID fixtures on newly hardened routes and add an explicit malformed-`creatorId` assertion
- Verify the route contract with the API e2e config directly: `jest --config apps/api/test/jest-e2e.json --runTestsByPath apps/api/test/community-http.e2e-spec.ts` (`33/33` passing)

## Hardening pass 26 (2026-08-04)

- Tighten API Jest module resolution so `@forge/shared-types` maps to source consistently in both unit and e2e configs instead of falling through to built `dist` artifacts
- Keep the API test suite green after the config change (`community-http.e2e-spec.ts` and `admin.security.spec.ts` both passing); residual `ts-jest` fallback warnings remain for shared `.js` source files and can be handled in a later dedicated test-config pass

## Hardening pass 27 (2026-08-04)

- Remove the duplicate root `package.json` `knip` script entry so npm no longer emits duplicate-key warnings during workspace command execution
- Verify with an npm-driven API smoke test (`admin.security.spec.ts` passing); remaining npm warning is only the unrelated local `devdir` env config

## Hardening pass 28 (2026-08-04)

- Expand the mocked community HTTP e2e suite to cover active group creation plus malformed community/group/poll UUID rejection paths
- Re-verify the suite directly under the API e2e config (`37/37` passing)

## Hardening pass 29 (2026-08-04)

- Expand the mocked community HTTP e2e suite again to cover active community event creation, malformed event/resource UUID rejection, and creator resource upload-url flows
- Re-verify the suite directly under the API e2e config (`41/41` passing)

## Autonomous production hardening (2026-08-04)

- Shorts ≤60s hard reject (Mux + ffmpeg + web/mobile duration probe)
- Axe smoke expanded (signup, forgot-password, live, legal, light home); API Jest `--forceExit`
- Mux signed playback for restricted VOD watch path + structured missing-key warn + checklist item
- Shorts feed: mute/not-interested filters + freshness/engagement rank + creator diversity
- Studio analytics foundation: `video.impression` beacons, `GET /analytics/studio/video-performance` (impressions / CTR / avg watch %)

## Production Completion Drive (2026-08-05)

- Tablist keyboard (Arrow/Home/End + roving tabindex): `CategoryFilter`, Community Panel tabs, search result-type tabs
- `RealtimeToasts`: `role="status"` + dismiss
- Removed empty LMS orphan route dirs (`courses`, `studio/courses`, `studio/programs`, `discover/courses`, `communities/id/[id]`)
- Mobile onboarding: fetch `GET /categories`, persist + `PUT /users/me/interests`
- Web unsubscribe confirm via `ConfirmDialog` on `SubscribeChannelControl`
- Playlist service unit tests: unlisted create/find, update, reorder
- Axe smoke: messages guest redirect, embed shell, unknown channel, playlist (skip-if-empty)
- Guest critical chrome e2e: search type tablist keyboard; home category tabindex
- Vitest: `SubscribeChannelControl.test.tsx` (subscribe + confirm unsubscribe)

## Manage subscriptions + LMS notif soft-hide (2026-08-05)

- Own `/[username]/subscriptions` Manage list: per-channel `SubscribeChannelControl` (notify + unsubscribe)
- Hide LMS-era `achievement_unlocked` / `xp_level_up` in web notifications page/menu + mobile notifications list

## Library hygiene + search history + FeedCard a11y (2026-08-05)

- Liked remove via playlist DELETE (unlikes + likeCount sync); Watch later / Liked **Clear all** API + web/mobile UI
- SearchSuggest: local recent searches + Clear (localStorage)
- FeedCard overflow → `PopoverMenu` (Arrow/Home/End keyboard)
- Studio Create menu → `PopoverMenu` keyboard parity

## Manage subs mobile + watch hide + Shorts menus (2026-08-05)

- Mobile own subscriptions list: Manage title + per-channel notify/unsubscribe (confirm)
- Watch: Not interested / Don’t recommend channel overflow (home after action)
- Shorts more + subscribe notify → `PopoverMenu`
- Vitest: `search-history.test.ts`
- `SubscribeChannelControl` notify menu → shared `PopoverMenu` (last hand-rolled menu)

## Mobile search history + LMS chrome + password UI test (2026-08-05)

- Mobile Explore: recent searches via Hive `LocalCache` + Clear; removed LMS “Core disciplines” grid
- Studio live title placeholder → YouTube-tone stream copy
- Vitest: `PasswordResetSettings` mismatch + happy path

## Depth polish / bugfix (2026-08-05)

- Mobile search history: remember on submit/chip only (not debounce prefixes)
- FeedCard/Shorts Report: `role="menuitem"` on button (no nested interactive)
- Shorts + mobile manage: load saved `notifyLevel` from subscription API
- Flutter unit: `search_history_storage_test.dart`
- Studio live: “Stream title” placeholder

## A11y keyboard follow-on (2026-08-05)

- Comments sort Top/Newest/Oldest → tablist + Arrow/Home/End
- Search `FilterChipRow` → radiogroup + Arrow/Home/End roving tabindex
- `PopoverMenu` ArrowUp/Down/Home/End for `role="menu"`
- Subscribe notify menu: focus first item + Arrow/Home/End

## In-app change-password (2026-08-05)

- `POST /auth/change-password` — verifies current password, hashes new, revokes other sessions (keeps current `sid`)
- Web `/profile/settings` Security: current + new + confirm + email reset fallback
- Mobile Settings Security section (same API + email reset)
- Unit coverage in `auth.service.spec.ts` (changePassword)

## Unsubscribe confirm parity (2026-08-05 cont.)

- Web Shorts rail: `ConfirmDialog` before unsubscribe (matches `SubscribeChannelControl`)
- Mobile watch / Shorts / profile: `AlertDialog` before unsubscribe
- Home feed For you / Subscriptions: tablist keyboard + roving tabindex
- E2E: home feed tablist smoke in `critical-chrome.spec.ts`

## Search history per-item remove (2026-08-06)

- Web `removeSearchHistoryItem` + Clear all; TopBar suggest row × control
- Mobile Explore recent list trailing close + storage helper
- Studio video editor: live chapter preview from description timestamp lines

## Upload chapters + history confirm (2026-08-06)

- Shared `DescriptionChaptersHint` on Studio edit + web upload (long-form)
- Mobile upload description helper for chapter format
- Watch history Clear all → `ConfirmDialog` (parity with unsubscribe confirms)
- Playlist Clear all / Delete → `ConfirmDialog` (Liked, Watch later, custom)

## Destructive ConfirmDialog sweep (2026-08-06)

- Watch comments Delete/Remove; Studio comments Remove
- End live stream; Studio cancel upload; upload progress banner cancel
- Studio subscribers Suspend membership
- Settings memberships: cancel / cancel-at-period-end / tier change
- Shared `countChapterCandidateLines` for Studio/upload chapter hints (+ tests)
- `.gitignore` local audit/prompt_docs/stitch scratch files

## Mobile Studio content library (2026-08-06)

- `getMyVideos` uses `GET /videos/studio` (all statuses, not public channel list)
- `/studio/videos/:id` edit: title, description, visibility, cancel upload, retry, delete
- List shows visibility + scheduled badge; tap opens editor (Watch from editor when ready)

## Mobile schedule + Studio analytics (2026-08-06 cont.)

- Studio edit + upload: schedule publish (date/time, ≥15m ahead) → `scheduledPublishAt`
- Upload complete lands on Studio editor (not watch) when scheduling/managing
- Mobile Studio analytics: `GET /analytics/studio/video-performance` impressions / CTR / avg watch % + top videos
- Boot-omit `CommunityEngagementController` when LMS flag off (with Brands/Mentorship)

## Mobile Studio captions (2026-08-06)

- Studio edit: upload / remove WebVTT by language (`presigned-url` + `PUT /caption`)
- `VideoModel.captionTracks` / `captionUrl` for track list display

## Mobile watch transcript + Super Thanks ledger (2026-08-06)

- Watch: Show transcript panel (API-proxied VTT cues, seek on tap, multi-lang)
- Shared `parseWebVtt` + unit tests
- Studio Super Thanks ledger (`/studio/super-thanks`) wired to received tips API

## Mobile upload thumbnail + playlist attach (2026-08-06)

- Upload: optional custom thumbnail (JPEG/PNG/WebP) via `thumbnail/presigned-url` while UPLOADING
- Playlist detail: owner Add videos from Studio ready library (`POST /playlists/:id/videos`)

## Mobile watch chapters (2026-08-06)

- Shared `extractVideoChapters` (YouTube ≥3 + 0:00 rule) + unit tests
- Watch Chapters panel (seek bar + list, active from playback position)
- Studio edit + upload live chapter preview (`DescriptionChaptersHint`)

## Mobile watch end-screen + loop (2026-08-06)

- Up next end overlay (Cancel / Play now; 5s countdown when Autoplay on)
- Loop video toggle (Hive pref; disables end-screen; Chewie looping)
- Persist Autoplay / Loop prefs; reset end-fired after seek-back

## Studio replace thumbnail (2026-08-06)

- API: thumbnail presign allowed for uploading/processing/ready; returns `publicUrl`
- `PUT /videos/:id/thumbnail` sets/clears URL (scoped to this video’s custom object)
- Web + mobile Studio editors: Change / Clear custom thumbnail

## Mobile playback speed + embed share (2026-08-06)

- Watch playback speed 0.5×–2× (Hive pref `forge.watch.playbackRate`)
- Copy link / at current time / embed iframe from watch engage row
- Upload path finalizes custom thumb via `PUT /thumbnail` when `publicUrl` returned

## Mobile channel Live tab (2026-08-06)

- Profile Videos / Shorts / Live segmented control
- Live now + Upcoming from `/streams/live|upcoming?creatorId=`

## Mobile channel Playlists + video sort (2026-08-06)

- Profile chips: Videos / Shorts / Live / Playlists
- Newest / Popular / Oldest sort on Videos & Shorts
- Public playlists via `GET /users/:id/playlists`

## Mobile channel Community + About (2026-08-06)

- Community tab: channel posts feed, like, owner compose (`/creators/.../channel-posts`)
- About tab: bio, links, subscribers/videos/joined (`createdAt` on UserModel)

## Mobile channel Videos list + Community images (2026-08-06)

- Videos tab: thumb + title + views list (Shorts stay 3-col grid)
- Community compose: multi-image upload via media-upload-url

## Mobile channel Home + Community comments (2026-08-06)

- Home tab (default): Live now shelf, Uploads preview, Shorts rail, links to Community/About
- Community posts: expand/reply comments via `/communities/:id/posts/:postId/comments`

## Channel Home playlists + community shelves (2026-08-06)

- Mobile Home: Playlists shelf + Community post previews
- Web channel Home: Playlists shelf; `getUserPlaylists` falls back to `/users/:id/playlists`

## Channel Community owner pin/delete (2026-08-06)

- Mobile + web: owner Pin/Unpin + Delete on channel Community posts

## Channel Home community + SharePlus (2026-08-06)

- Web channel Home: Community post previews
- Mobile: migrate `Share.share` → `SharePlus.instance.share(ShareParams…)`

## Playlist list videoCount (2026-08-06)

- `listByUser` includes `videoCount` via relation count; web channel Home/Playlists show counts

## Mobile Studio comments + channel banner (2026-08-06)

- Studio comments: Reply + Remove (parity with web Studio)
- Channel profile: `bannerUrl` on UserModel + banner strip on mobile header

## Library playlist counts (2026-08-06)

- Liked system playlist `videoCount` from reactions; web Library uses `videoCount` meta
- Save-to-playlist modal + mobile Library shelves show counts

## Mobile Studio Attention queue (2026-08-06)

- `/studio/attention` from `GET /creators/me/attention` (counts + inbox); Studio home badge
- Attention comment items deep-link to `/watch/:id?lc=` (web + mobile highlight)

## Mobile Studio branding + Library continue watching (2026-08-06)

- `/studio/branding` → channel customize (profile settings); Studio home/settings links
- Library You: Continue watching shelf; CW filter ≥5s progress (web parity)

## Mobile search Live + Watched (2026-08-06)

- Explore/Search: Live chip (streams from `/streams/live`, Live-only hides catalog)
- Watched / Not watched chips → `?watched=` (web parity)

## Mobile Library New playlist (2026-08-06)

- You tab: New playlist action + shelf card (title, optional description, visibility)
- Shared create dialog; opens playlist detail after create

## Mobile playlist search filter (2026-08-06)

- Playlist detail: Search this playlist when ≥4 videos (title/channel; web parity)

## Mobile Save sheet New playlist (2026-08-06)

- Watch Save to playlist → shared create dialog (description + visibility) then add video

## Mobile Library / Playlists / Search depth (2026-08-06)

- Library Your videos → `/profile/me?tab=videos` (channel Videos tab via `?tab=`)
- Playlists list sort: Recently added / A–Z / Z–A
- Search type chips: All / Videos / Channels / Playlists
- Watch later / Liked: Search this playlist when ≥4 videos

## Mobile notifications polish (2026-08-06)

- Category chips (Social / Live / Content / …); relative timestamps; load-error retry
- Invalidate unread badge after mark-read / mark-all-read

## Mobile Studio library + Playlists IA (2026-08-06)

- Studio videos: search, sort, status/visibility filters, pagination (`GET /videos/studio`)
- Studio home Content zone: Playlists → `/playlists`

## Mobile Studio topic tags edit (2026-08-06)

- Studio video editor: Topic tags when video has `categoryId` (`skillTagIds` on PATCH)

## History Pause deep-link + Studio Playlists settings (2026-08-06)

- History “Pause history” → `/profile/settings?section=privacy` (scrolls to toggle)
- Studio settings shortcut: Playlists
- Web notifications page: relative `timeAgo` (menu parity)

## Mobile push deep-link parity (2026-08-06)

- Shared `notificationHref` used by in-app notifications + FCM tap routing

## Notif category a11y + watch volume + Studio comment search (2026-08-06)

- Web notifications: category chips as `tablist` with Arrow/Home/End (CategoryFilter parity)
- Mobile watch: persist volume/mute prefs (`forge.watch.volume` / `forge.watch.muted`)
- Mobile Studio comments: client search by text / author / video title

## Messages username search + thread reply (2026-08-06)

- Mobile Messages: `@username` search compose, thread reply composer, `dm:message` socket
- Web Messages: reply composer in active conversation
- Live Now “Go live” → `/studio/live` (was web-only stub)

## System playlist Play all (2026-08-06)

- Mobile Watch later / Liked: Play all + Shuffle with `?list=` queue (custom playlist parity)

## Mobile playlist delete (2026-08-06)

- Owner Delete playlist on detail (non-system; web ConfirmDialog parity)

## Studio settings + Super Thanks CSV + Subs Manage (2026-08-06)

- Mobile Studio settings: Super Thanks, Moderation, Messages shortcuts + view channel
- Mobile Super Thanks: Export CSV via shared `CsvExportUtil` (web parity)
- Subscriptions feed: Manage → `/profile/:username/subscriptions`

## Studio analytics period window (2026-08-06)

- Web + mobile: video performance `days` selector (7 / 28 / 90) on Studio analytics

## Studio Community + video playlists (2026-08-06)

- Web Studio: `/studio/community` channel posts (sidebar + settings); video editor Manage playlists (`SaveToPlaylistModal`)
- Mobile Studio: `/studio/channel-posts` compose surface; video editor playlist membership toggles
- Mobile Shorts comments: like + reply (watch parity)
- Create menus + Studio dashboard link Community post; watch transcript Copy (web + mobile)

## Publish now + Scheduled library filter (2026-08-06)

- Studio video editor: **Publish now** clears future `scheduledPublishAt` (web + mobile)
- Studio content library: `scheduled=true` API filter + Scheduled only UI (web checkbox / mobile chip)
- Studio content list: **Publish now** action on scheduled rows (web + mobile)
- Mobile Shorts share sheet: Share + Copy link

## Continue watching remove (2026-08-06)

- Web home Continue watching: remove (X) clears history item via `DELETE /users/me/watch-history/:videoId`
- Mobile feed + Library Continue watching tiles: same remove control

## Disliked videos Library shelf (2026-08-06)

- API: `GET/DELETE /me/disliked-videos` (private shelf from dislike reactions)
- Web Library tile + `/library/disliked` (search, remove, clear all)
- Mobile Library row + `/library/disliked` screen

## Studio content row actions + own-channel Share (2026-08-06)

- Studio content library: Copy link + Delete (confirm) on web table/mobile menu
- Own channel ProfileHeader: Share alongside Customize channel
- Mobile own profile: Share channel + Customize channel shortcuts

## Studio visibility quick-change + Watch later toggle (2026-08-06)

- Studio content list: change Public / Unlisted / Private / Subscribers without opening editor (web + mobile)
- FeedCard overflow: Save ↔ Remove from Watch later (toggle)
- Mobile feed overflow: same Watch later toggle

## Studio comments search + filters (2026-08-06)

- Web Studio comments: search + Published / Pinned / Hearted chips
- Mobile Studio comments: same filter chips (search already present)

## Studio Videos / Shorts type filter (2026-08-06)

- `GET /videos/studio?videoType=video|short` (DTO + library query util)
- Web Studio content: Type select (All / Videos / Shorts)
- Mobile Studio content: Videos / Shorts filter chips

## Studio edit Video ↔ Short type (2026-08-06)

- Studio detail editor: change content type Video / Short (web + mobile)
- API rejects Short when known duration > 60s (`shortTypeChangeError`)

## Studio Short public URLs (2026-08-06)

- Studio View / Copy link use `/shorts?v=` for Shorts (web + mobile)
- Short badge on Studio content library rows

## Short-aware public paths (2026-08-06)

- `publicVideoPath` / share URL: Shorts → `/shorts?v=` (FeedCard, Continue watching, share)
- `video.ready` notifications include `videoType`; deep links open Shorts feed when applicable
- Mobile: shared `publicVideoPath` on feed, explore, history, library, profile, subscriptions, disliked

## Sitemap + miniplayer Shorts awareness (2026-08-06)

- Sitemap emits `/shorts?v=` for Shorts
- Web miniplayer expand/hide respects Shorts deep links + `videoType`
- Mobile floating miniplayer dock (continue HLS after leaving watch; Miniplayer control)

## Studio library category filter (2026-08-06)

- Web + mobile Studio content: filter by upload category (`?categoryId=`)

## Studio playlists management depth (2026-08-06)

- Web Studio playlists: search, visibility filter, sort, description on create, edit details, delete
- Hides system Watch later / Liked from Studio custom list
- Mobile playlists: search + visibility chips; custom playlists only

## Studio playlist reorder + library duration (2026-08-06)

- Studio manage panel: move up/down reorder (`PUT /playlists/:id/reorder`); Copy link on cards
- Studio Content library: duration on ready rows + thumbnail badge (web); duration in mobile library meta

## Studio comments deep links (2026-08-06)

- Web + mobile Studio comments: `?lc=` View comment; Short badge; wider ready-video sample (12 videos / 40 comments)
- Copy comment link from Studio inbox (web + mobile)

## Studio schedule cancel + video performance CSV (2026-08-06)

- Cancel schedule → clear `scheduledPublishAt` + set private (web/mobile library + editors); distinct from Publish now
- Video performance Export CSV (web details + mobile); mobile top-video cards open Studio edit

## Attention queue scheduled publishes (2026-08-06)

- `GET /creators/me/attention` includes upcoming `scheduled` items + `scheduledUpcoming` count
- Web + mobile Attention chips / Studio home badge include scheduled

## Studio post-upload category edit (2026-08-06)

- `PATCH /videos/:id` accepts `categoryId`; category change clears tags unless new `skillTagIds` sent
- Web + mobile Studio video editors: category select + retag for new category

## Mobile Studio cancel/retry + relative schedule (2026-08-06)

- Mobile Content list: Cancel upload + Retry processing (existing APIs)
- Relative scheduled times (`timeUntil` / `in 2h`) on web + mobile Studio library

## Settings playback prefs (2026-08-06)

- Web + mobile Settings: Autoplay next + Loop toggles (same `forge.watch.*` keys as watch UI)

## Upload cancel + playlist remove bugfixes (2026-08-06)

- `UploadProgressBanner`: clear sticky `cancelOpen` when upload ends; hoist ConfirmDialog
- `upload-manager`: skip `POST …/complete` after abort cleared active meta mid-PUT
- `ConfirmDialog`: ignore Escape/backdrop close while `loading`; unique `labelledBy`
- Mobile playlist detail + system Liked/Watch later: confirm before remove

## Interests settings + upload playlists (2026-08-06)

- Web + mobile profile settings: edit cold-start interests (GET/PUT `/users/me/interests`)
- Mobile upload: optional attach to custom playlists on complete (`playlistIds`)
- Library Messages row; onboarding interests → Settings `#interests`

## Comment dislike + polish (2026-08-08)

- Comment reactions: `comment_likes.reaction` like|dislike + `comments.dislike_count` (migration `198…`)
- `POST/DELETE …/comments/:id/dislike`; mutual exclusion with like (video reaction parity)
- Web CommentsPanel + mobile watch/Shorts: dislike control (no public dislike count)
- Embed copy includes `?t=` at current time (web + mobile); ChannelCommunityFeed delete → ConfirmDialog
- Live host dashboard: highlights clip list from `GET /streams/:id/clips`

## Viewer user Block (2026-08-08)

- `user_blocks` table (migration `199…`); `POST/DELETE /users/:id/block`, `GET /me/blocked-users`
- Block also unsubscribes both ways + mutes channel; DMs and comment create/list respect blocks
- Profile `viewerBlocked`; web/mobile Block + Settings blocked list

## Username self-service (2026-08-08)

- Migration `200…`: `users.username_changed_at`; 14-day rename cooldown
- `PUT /users/:id` accepts `username` (signup validators + reserved handles + case-insensitive uniqueness)
- Signup also rejects reserved handles; profile lookup is case-insensitive
- Web + mobile Settings: editable `@username`; API errors surface in UI
- Public user payload includes `usernameChangedAt`

## Structured chapters editor (2026-08-08)

- Web Studio + upload: `DescriptionChaptersEditor` row UI writes `m:ss Title` lines into description
- Mobile Studio + upload: same structured editor; shared apply/strip helpers
- Helpers: `formatSecondsAsTimestamp`, `listChapterDraftRows`, `stripChapterLinesFromDescription`, `applyChapterRowsToDescription`

## ConfirmDialog loading tests (2026-08-08)

- Web vitest: ConfirmDialog confirm/cancel + Escape ignored while `loading`

## Username history redirects (2026-08-08)

- Migration `201…`: `username_history` — old handles resolve to current user until reclaimed
- Rename + signup clear colliding history rows; web permanentRedirect to canonical `/{username}`; mobile profile `replace`
- Neon prod: migrations **198–201** applied (2026-08-08) — dislike, blocks, username_changed_at, username_history

## Mobile live Mark highlight (2026-08-08)

- Host live panel: Mark highlight (~30s at current moment) + clip list via `POST/GET /streams/:id/clips`
- `LiveRepository.listClips` / `createClip`

## Subscriptions list notifyLevel (2026-08-08)

- Own `GET …/subscriptions` includes `notifyLevel` (viewer must be list owner)
- Web Manage subscriptions skips per-row subscription GET; mobile seeds bell from list payload

## Mobile in-player CC (2026-08-08)

- Watch player: closed-caption overlay from existing caption tracks / VTT proxy
- CC toggle (+ language when multi-track); pref `forge.watch.cc` (default on)

## Shorts CC + username cooldown UX (2026-08-08)

- Web ShortsFeed passes `captionUrl` / `captionTracks` into VideoPlayer
- Mobile Shorts: same `PlayerCaptionsOverlay` as watch (higher cue inset)
- Settings (web + mobile): disable handle edit while cooldown active; show unlock date

## Shorts Save / Watch later (2026-08-08)

- Web Shorts: Save (Watch later toggle) on rail + Save to playlist in ⋮ menu
- Mobile Shorts: bookmark Save / Watch later on rail + overflow item
- Mobile: shared `showSaveToPlaylistSheet` (watch + Shorts ⋮ Save to playlist)

## Shorts Block user (2026-08-08)

- Web + mobile Shorts ⋮ → Block user (confirm) → hide short from feed

## Watch Block user (2026-08-08)

- Web WatchExperience ⋮ → Block user (confirm) → home
- Mobile watch engage ⋮ → Block user (confirm) → home
- Shared web `blockUser` / `unblockUser` in engage-mutations (ProfileHeader, watch, Shorts)

## Feed Block user (2026-08-08)

- Web FeedCard ⋮ Block user (confirm) → hide card/channel
- Mobile home feed ⋮ Block user (confirm) → hide

## Blocked peers excluded from discovery (2026-08-08)

- Home / following / related feeds, Shorts, and personalized recs exclude `getBlockedPeerIds` (both directions)
- Direct watch of a blocked peer’s video → 403 not available
- Helper `mergeExcludedCreatorIds` (muted ∪ blocked)
- Search (FTS + legacy): videos / channels / playlists exclude muted ∪ blocked
- Search suggestions: title + channel prefixes exclude muted ∪ blocked
- Channel profile: if they blocked you → 403 “not available”; if you blocked them → profile + Unblock, empty videos/playlists/community posts
- Channel videos / playlists / channel-posts gated when blocked either way
- Notifications list hides actor metadata from blocked peers; live fan-out skips blocked recipients
- Live / upcoming stream lists exclude blocked creators
- Watch history / continue watching omit videos from blocked peers
- Library shelves (Liked / Watch later / Disliked) omit blocked creators’ videos
- Followers / subscriptions lists + DM inbox hide blocked peers
- `GET /users/:id` matches by-username block gating
- Channel / watch 403 surfaces “not available” UI (web + mobile) instead of generic 404
- Direct live stream detail 403 when blocked; live/playlist unavailable UX
- Stream chat / Q&A / Super Chat reject blocked peers (`assertNotBlockedFromHost`)
- Mobile playlist detail + Shorts deep-link show “not available” on 403
- Captions / watch progress / likes use same host-block gate as video detail; comment deep-link hides blocked authors
- `GET /videos/:id/similar` + category feed honor viewer JWT exclusions; playlist add / Watch later reject blocked creators
- Billing checkouts (membership / Super Thanks / Super Chat / paid event) + tier change reject blocked peers
- Comment list / deep-link / replies / reactions gate on video-owner block; embed player shows unavailable on 403
- Subscription notify get/set refuse blocked peers; web miniplayer Picture-in-Picture button (browser OS PiP)
- Android OS PiP (`forge/pip` MethodChannel + manifest); web player `p` shortcut; iOS stays floating miniplayer
- Web watch/live theater toggle via `t` (persists on watch)

## Still open

| Area | Item | Owner |
| --- | --- | --- |
| Ops | Staging soak per load-test runbook | Operator |
| Launch | Env secrets, Mux/Stripe webhooks; Mux signing keys for private/unlisted | Operator |
| Launch | DB migrations **185–197 applied** to Neon (2026-08-04) via TypeORM | Done |
| Launch | DB migrations **198–201** (dislike, blocks, username_changed_at, username_history) | Done (2026-08-08 Neon) |
| Ship | PR [#185](https://github.com/Forge-Studios-dev/FORGE/pull/185) **MERGEABLE** — CI green; merge when staging checklist passes | Operator |
| Eng (optional) | Mobile in-player CC overlay (transcript API exists; web has tracks) | Done (2026-08-08) |
| Eng (optional) | Shorts in-player CC (web + mobile) | Done (2026-08-08) |
| Eng (optional) | Shorts Save / Watch later | Done (2026-08-08) |
| Eng (optional) | Shorts Block user | Done (2026-08-08) |
| Eng (optional) | Watch Block user (web + mobile) | Done (2026-08-08) |
| Eng (optional) | Feed Block user (web + mobile) | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from feeds/shorts/recs + watch | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from search | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from suggestions + channel surfaces | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from notifs + live lists | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from watch history | Done (2026-08-08) |
| Eng (optional) | Exclude blocked peers from library + follows + DMs | Done (2026-08-08) |
| Eng (optional) | Channel/video unavailable UX for block 403 | Done (2026-08-08) |
| Eng (optional) | Live stream block gate + unavailable UX | Done (2026-08-08) |
| Eng (optional) | Stream chat block gate + mobile playlist/Shorts 403 UX | Done (2026-08-08) |
| Eng (optional) | Captions/watch/like/comment-deeplink block gate | Done (2026-08-08) |
| Eng (optional) | Similar + category feed + playlist-add block gates | Done (2026-08-08) |
| Eng (optional) | Billing checkout block gates | Done (2026-08-08) |
| Eng (optional) | Comment read/react + embed 403 UX | Done (2026-08-08) |
| Eng (optional) | Web miniplayer browser PiP | Done (2026-08-08) |
| Eng (optional) | Android OS Picture-in-Picture | Done (2026-08-08) |
| Eng (optional) | Web theater `t` shortcut | Done (2026-08-08) |
| Eng (optional) | Username cooldown dated lock UX | Done (2026-08-08) |
| Eng (optional) | `notifyLevel` on Manage subscriptions list (kill N+1) | Done (2026-08-08) |
| API debt | Optional Nest course/podcast **file** deletion (boot-omit + 410 sufficient) | Deferred (LMS off by default) |
| Analytics | Realtime Studio dashboards / audience retention curves beyond avg watch % | Product |
| Analytics | Studio details page uses `topVideos` (impressions/CTR/watch %); SQL uses `watched_at` | Done (2026-08-04) |
| Comments | Video owner can Remove comments (API + watch/Studio/mobile) | Done (2026-08-04) |
| Community | Channel Community tab expand/reply on posts | Done (2026-08-04) |
| Recs | Full ML / embeddings stack | Product |
| Downloads | Real offline download packages (UI hidden) | Product |
| Mobile | iOS AVPlayer Picture-in-Picture (Android OS PiP shipped; floating miniplayer remains) | Eng (optional) |
| Legal | Kids / Restricted Mode / made-for-kids | Product + legal |
| Monetization | Ad breaks / VAST | Product + partners |

Prefer small focused PRs over another full Master pass. **Viewer/creator YouTube-parity eng depth on this branch is complete** for the Production Completion Drive; remaining Master phases 09–24 are documented as verified/complete for the shipped codebase. Execute [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) before merge to `main`.

### Ship handoff (operator)

1. Run [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) on staging.
2. Confirm Mux/Stripe webhooks + signing keys for private/unlisted.
3. Merge open PR [#185](https://github.com/Forge-Studios-dev/FORGE/pull/185) (`feature/youtube-replica-wave-1` → `main`) when checklist passes — do not push straight to `main`.
4. Product-deferred: ML recs, downloads, Kids Mode, ad breaks — not blocking viewer/creator core loop.

