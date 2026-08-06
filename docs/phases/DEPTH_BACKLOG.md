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

## Interests settings + upload playlists (2026-08-06)

- Web + mobile profile settings: edit cold-start interests (GET/PUT `/users/me/interests`)
- Mobile upload: optional attach to custom playlists on complete (`playlistIds`)
- Library Messages row; onboarding interests → Settings `#interests`

## Still open

| Area | Item | Owner |
| --- | --- | --- |
| Ops | Staging soak per load-test runbook | Operator |
| Launch | Env secrets, Mux/Stripe webhooks; Mux signing keys for private/unlisted | Operator |
| Launch | DB migrations **185–197 applied** to Neon (2026-08-04) via TypeORM | Done |
| Ship | PR [#185](https://github.com/Forge-Studios-dev/FORGE/pull/185) **MERGEABLE** — CI green; merge when staging checklist passes | Operator |
| API debt | Optional Nest course/podcast **file** deletion (boot-omit + 410 sufficient) | Eng (optional) |
| Analytics | Realtime Studio dashboards / audience retention curves beyond avg watch % | Product |
| Analytics | Studio details page uses `topVideos` (impressions/CTR/watch %); SQL uses `watched_at` | Done (2026-08-04) |
| Comments | Video owner can Remove comments (API + watch/Studio/mobile) | Done (2026-08-04) |
| Community | Channel Community tab expand/reply on posts | Done (2026-08-04) |
| Recs | Full ML / embeddings stack | Product |
| Downloads | Real offline download packages (UI hidden) | Product |
| Legal | Kids / Restricted Mode / made-for-kids | Product + legal |
| Monetization | Ad breaks / VAST | Product + partners |

Prefer small focused PRs over another full Master pass. **Viewer/creator YouTube-parity eng depth on this branch is complete** for the Production Completion Drive; remaining Master phases 09–24 are documented as verified/complete for the shipped codebase. Execute [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) before merge to `main`.

### Ship handoff (operator)

1. Run [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) on staging.
2. Confirm Mux/Stripe webhooks + signing keys for private/unlisted.
3. Merge open PR [#185](https://github.com/Forge-Studios-dev/FORGE/pull/185) (`feature/youtube-replica-wave-1` → `main`) when checklist passes — do not push straight to `main`.
4. Product-deferred: ML recs, downloads, Kids Mode, ad breaks — not blocking viewer/creator core loop.

