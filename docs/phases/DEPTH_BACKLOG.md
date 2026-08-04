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

## Still open

| Area | Item | Owner |
| --- | --- | --- |
| Ops | Staging soak per load-test runbook | Operator |
| Launch | Env secrets, Mux/Stripe webhooks, migrations on prod (`185–196`) | Operator |
| Ship | Review + merge `feature/youtube-replica-wave-1` (do not push straight to `main`) | Operator |
| API debt | Optional Nest course/podcast **file** deletion (boot-omit + 410 sufficient) | Eng (optional) |
| Analytics | Studio impressions / CTR / retention / realtime depth | Product |
| Recs | Full ML / embeddings stack | Product |
| Downloads | Real offline download packages (UI hidden) | Product |

Prefer small focused PRs over another full Master pass. Remaining Master phases 09–24 are documented as verified/complete for the shipped codebase; execute [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) before merge to `main`.

