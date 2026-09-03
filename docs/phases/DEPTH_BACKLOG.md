# Depth backlog (post Master Execution)

> **Historical ship log** — not the open backlog SSOT. Open / trigger-gated items live in [audits/DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md) and [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md). Product framing: [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md). **Ads / VAST are permanently N/A** ([ADR-005](../decisions/ADR-005-no-ads.md)).

Master phases 01–24 are documented. Waves below are a **changelog of shipped depth**, not remaining work.

### Master Execution Wave 73 (2026-08-30) — Admin URL sync (approvals, search, copyright)

- Admin `/creator-approvals` reads/writes `?search=&page=` (debounced search)
- Admin `/search` reads/writes `?q=` on submit; auto-runs when URL has ≥2 chars
- Admin `/copyright` reads/writes `?tab=&page=&appeal=` (strikes pending-appeals filter)

### Master Execution Wave 74 (2026-08-30) — Admin fraud filter URL sync

- Admin `/fraud` reads/writes `?status=&page=` (`status=all` for unfiltered; default open omits param)

### Master Execution Wave 72 (2026-08-29) — Live IconButton a11y tooltips

- Mobile live list “Go live” + stream chat Send IconButtons: `tooltip:` for TalkBack/VoiceOver

### Master Execution Wave 71 (2026-08-29) — Admin users filter URL sync

- Admin `/users` reads/writes `?search=&role=&creatorStatus=&isActive=&emailVerified=&hasPendingReports=&page=`
- Debounced search; shareable pending-creator / blocked / reported triage links

### Master Execution Wave 70 (2026-08-29) — Mobile Studio comments `?q=` + web videos URL write

- Mobile Studio comments: deep-link `?q=` + preserve q when changing filter chips
- Web Studio videos: write `?search=&status=&scheduled=` when filters change

### Master Execution Wave 69 (2026-08-29) — Admin content status/page URL sync

- Admin `/content` reads/writes `?status=&page=` (keeps userId / moderationStatus / videoId)

### Master Execution Wave 68 (2026-08-29) — Studio comments search URL sync

- Web Studio comments: `?q=` shareable with filter (debounced, ≥2 chars)

### Master Execution Wave 67 (2026-08-29) — Studio Attention count deep-links

- Web + mobile Attention count cards navigate to comments / held / moderation / earnings / videos filters
- Mobile + web Studio videos honor `?status=` and `?scheduled=` from Attention links

### Master Execution Wave 66 (2026-08-29) — Admin held comments URL sync

- Admin `/comments` reads/writes `?q=&page=` (shareable held-queue search)
- Cross-link to pending reports (`/reports?status=pending`)

### Master Execution Wave 65 (2026-08-29) — Admin audit filter URL sync

- Admin `/audit` reads/writes `?action=&targetType=&page=` (shareable investigation deep-links)

### Master Execution Wave 64 (2026-08-29) — Admin reports filter URL sync

- Admin `/reports` reads/writes `?status=&severity=&targetType=&page=` (shareable triage deep-links)
- Phase 01 ROADMAP: mark N2/N4/CategoryFilter Done (already shipped in code)

### Master Execution Wave 63 (2026-08-29) — Mobile Studio moderation hub

- `/studio/moderation` opens dedicated hub (no longer redirects to community tab only)
- Parse real `moderated-communities` shape (`communityId` + nested `community`) + merge owned communities
- Unified inbox via `GET /creators/me/moderation/inbox` (cursor Load more + Review → community tools)
- Closes mobile parity gap vs web Wave 62 hub

### Master Execution Wave 62 (2026-08-29) — Studio moderation inbox pagination

- `GET /creators/me/moderation/inbox` cursor-paginated (`limit`/`cursor`) + `meta.total`
- Web Studio moderation hub: `useInfiniteQuery` Load more (no client slice / take-200 cap)
- Attention strip uses `meta.total` + `limit: 5` preview (accurate open-report count)
- Closes Phase 01 H16

### Master Execution Wave 61 (2026-08-29) — A11y + reports targetType filter

- Design-system `DataTable`: `aria-sort` on sortable headers
- `GET /admin/reports?targetType=video|comment|user` + admin chip filter
- Live reconnect banners: `aria-live="assertive"` (host health + viewer overlay)

### Master Execution Wave 60 (2026-08-29) — Admin reports severity triage UI

- `GET /admin/reports?severity=p0|p1|p2|p3` filter (list already severity-sorted)
- Admin reports table: Severity column + chip filter; detail shows severity + reasonCategory
- Mobile Explore idle: Trending chip → `/trending`

### Master Execution Wave 59 (2026-08-29) — Admin report comment targets

- `GET /admin/reports/:id` enriches video/comment/user targets (title, snippet, author, videoId)
- Admin report detail: watch deep-link for comments (`?lc=`), Remove comment → `DELETE /admin/comments/:id` + mark reviewed
- `DELETE /admin/comments/:id` removes any comment (not only held); held-queue bulk still held-gated
- Doc hygiene: Phase 01 N4/N5 marked Closed

### Master Execution Wave 58 (2026-08-29) — Mobile Shorts held-comment Release

- Mobile Shorts comments sheet: Held badge + Release for video owners (`POST …/approve`)
- Parity with watch comments (Wave 56) and web Shorts `CommentsPanel`
- Doc hygiene: Phase 01 N1 live theater marked Closed (already shipped in code)

### Master Execution Wave 57 (2026-08-29) — Studio comments inbox API

- `GET /creators/me/comments` — cursor-paginated across all owned videos (`filter`, `q`, `limit`, `cursor`)
- Web + mobile Studio comments use the API (no more 24×8 client scan / 80-cap)
- Closes Phase 01 N2

### Master Execution Wave 56 (2026-08-29) — Watch held-comment Release

- Web `CommentRow` + mobile watch comments: Held badge + Release for video owners
- Attention held items deep-link to `/watch/…?lc=` (owner can release in place)

### Master Execution Wave 55 (2026-08-29) — Mobile settings analytics deep-link

- `?section=analytics|cookies` scrolls to Product analytics toggle (privacy section unchanged)

### Master Execution Wave 54 (2026-08-29) — Admin audit UX polish

- Debounced action filter; DataTable loading / empty / error slots

### Master Execution Wave 53 (2026-08-29) — Admin content videoId deep link

- `GET /admin/videos?videoId=` exact-id filter; Content UI reads `?videoId=`
- Audit log video targets → `/content?videoId=…`

### Master Execution Wave 52 (2026-08-29) — Studio comments filter URL sync

- Web + mobile Studio comments: filter chips write `?filter=` (shareable / Attention deep-link stable)
- Web syncs filter state when `filter` query changes

### Master Execution Wave 51 (2026-08-29) — Admin audit log depth

- Audit list: actor `@username` join; action `ILIKE` partial match; `targetType` filter
- Admin `/audit` chips + target-type select; richer target links (comment/report/copyright)

### Master Execution Wave 50 (2026-08-29) — Search empty “Did you mean”

- Web + mobile empty search: suggestion from `/search/suggestions` (title first, else channel)
- DEPTH cleanup: Wave 39 backfill note + Waves 43–44 grant “web-first” stale lines

### Master Execution Wave 49 (2026-08-29) — Studio attention held comments

- `getCreatorAttention`: `heldComments` count + warning-tone items (Wave 56: deep-link `/watch/…?lc=`)
- Unreplied-comment query excludes `moderation_status=held`
- Web/mobile Attention + Studio home badge include held; comments deep-link `?filter=held`

### Master Execution Wave 48 (2026-08-29) — Mobile Studio held comments

- Mobile Studio comments: “Held for review” filter (Published excludes held) + Release via `POST …/approve`
- Held badge on inbox rows (parity with web Studio)

### Master Execution Wave 47 (2026-08-29) — Admin bulk held-comment actions

- `POST /admin/comments/held/bulk-release` + `bulk-remove` (cap 50); selectable DataTable on `/comments`

### Master Execution Wave 46 (2026-08-29) — Admin held-comment search + a11y/cookies polish

- `GET /admin/comments/held?q=` filters by comment/author/video/channel; admin UI search box
- Cookie banner links to Settings `#cookies`; admin search → creator videos filter
- Mobile live reaction buttons: Semantics labels for screen readers

### Master Execution Wave 45 (2026-08-29) — Mobile paid-event grant access

- Mobile live host: grant paid-event access by @username when `visibility=paid_event`
- LIVE.md host dashboard row fully mobile-parity for chat/clips/mods/grants

### Master Execution Wave 44 (2026-08-29) — Mobile live moderators

- Mobile live host: list / add (@username) / remove stream moderators
- Paid-event grant-access: shipped mobile in Wave 45

### Master Execution Wave 43 (2026-08-29) — Mobile live chat settings + analytics opt-out

- Mobile live host: Chat enabled toggle + Everyone / Subscribers / Members / Mods-only chips (`PATCH …/chat/settings`)
- Mobile Settings: Product analytics opt-in (local; gates `ForgeAnalytics.track`)
- LIVE.md host dashboard row updated (mods/grants completed in Waves 44–45)

### Master Execution Wave 42 (2026-08-29) — Cookie prefs + DNT/GPC

- Settings → Cookies & analytics to change Accept / Essential after the banner
- `analyticsConsentGranted` respects Do Not Track + Global Privacy Control
- Privacy policy cookies section updated

### Master Execution Wave 41 (2026-08-29) — Live clip export UX (mobile) + captions filter tests

- Mobile live host highlights: Play clip link + Export failed (parity with web Wave 40)
- `normalizeCaptionsFilter` unit coverage for lang codes

### Master Execution Wave 40 (2026-08-29) — Caption FTS backfill + clip export UX

- `POST /admin/videos/backfill-caption-search` (+ Content UI button) batch-fills `caption_text` for videos with tracks/URL but empty FTS text
- Host dashboard highlights show Mux export failure (`exportError`)
- Mobile Explore: English / Spanish / Hindi CC filter chips (parity with web Wave 39)
- Still deferred: non-English FTS configs / `pg_trgm`

### Master Execution Wave 39 (2026-08-29) — Shared ThemeProvider + multi-lang caption index

- `@forge/design-system` `ThemeProvider` / `useTheme` (storageKey + preferSystemLight); web/admin thin wrappers
- Caption FTS: `buildCaptionSearchText` indexes up to 8 tracks (~200k chars); Mux `video.captions.updated` → `CaptionIndexListener` → `reindexCaptionSearchText`
- Search `?captions=en|es|hi|…` language filter + web chips; cache `search:v9`
- Caption FTS backfill: shipped in Wave 40 (`POST /admin/videos/backfill-caption-search`)
- Still deferred: dedicated non-English FTS configs / `pg_trgm`

### Master Execution Wave 38 (2026-08-29) — watched_at fix + trending windows

- Bugfix: all `watch_history` velocity SQL used nonexistent `created_at` → `watched_at` (recommendations CTEs, content-library trending join, exclude-watched list)
- `GET /videos/trending?window=now|week` (24h / 7d); cache key `recs:trending:v2:{hours}h`
- Web `/trending` + mobile Trending: Now / This week tabs
- PHASE_12 regional/time-window deferred row closed for time-window half (geo still N/A)

### Master Execution Wave 37 (2026-08-29) — A11y depth + LMS flag doc

- Mobile: tooltips on community post media remove/send, disliked clear, playlist clear search, chapter editor remove
- Roadmap: LMS flag-gating post-MVP row marked **Resolved** (audit §1 already closed; no code change)

### Master Execution Wave 36 (2026-08-29) — Session dwell creators + Studio a11y

- `session-watch.util`: Redis sliding list of creators watched ≥15s; `recordWatch` writes; forYou SQL boosts `session_affinity` (+25)
- Mobile Studio: `tooltip:` on bare back/clear/edit/delete IconButtons (videos, analytics, live, settings, community, rooms, …)
- PHASE_12: click/dwell micro-signal (creator-level) marked shipped; regional trending still deferred

### Master Execution Wave 35 (2026-08-29) — Typo-tolerant search suggest

- `suggestTypoPrefixes` (1-char delete + adjacent swap) fills title suggestions when prefix + contains stay sparse
- No `pg_trgm` dependency; capped OR-clause (≤8 variants)

### Master Execution Wave 34 (2026-08-29) — Session affinity in forYou

- `getPersonalizedFeed`: categories from watches in the last 2 hours prepend long-term affinity (session > history)
- PHASE_12: exploration + session boost marked shipped; regional trending still deferred (no viewer geo)

### Master Execution Wave 33 (2026-08-29) — forYou exploration + eligibility UI

- `applyExplorationBudget` (~15% slots after skipFirst=3) weaves non-followed / off-affinity candidates into first-page `getPersonalizedFeed`
- Studio Earnings (web + mobile): Partner Program eligibility snapshot from `GET /creators/me/monetization/eligibility`
- Roadmap: session exploration budget row marked shipped; eligibility remains read-only until ads

### Master Execution Wave 32 (2026-08-29) — Studio earnings + suggest contains fallback

- Studio `/studio/earnings` (web + mobile): unified MRR / Super Thanks / Super Chat summary + CSV (`GET /creators/me/earnings`)
- Search suggestions: `%term%` fill when prefix matches are sparse
- Roadmap: earnings UI, synthetic monitoring, Personalized bell engagement gate marked shipped/accurate

### Master Execution Wave 31 (2026-08-29) — DSAR strikes + caption language config

- `GET /users/me/export` includes account strikes; web/mobile download copy updated
- Mux VOD ingest auto-captions language/name via `MUX_AUTO_CAPTION_LANGUAGE` / `MUX_AUTO_CAPTION_NAME` (default English)
- Roadmap: multi-language captions note — language is ops-configurable; multi-track FTS indexing shipped in Waves 39–40

### Master Execution Wave 30 (2026-08-29) — Mobile DMCA counter-notice + MVP-2 doc closeout

- Mobile Channel strikes: file counter-notice (parity with web `/settings/strikes`) via existing `ProfileRepository.fileCounterNotice`
- MVP-2 phase-doc rows marked corrected (07/14/15/18/19/21); Stripe refund/dispute path marked verified against existing unit tests
- `PHASE_07_ADMIN.md` shipped list includes report/copyright/strikes/held-comments/audit

### Master Execution Wave 29 (2026-08-29) — Admin audit UI + Trending a11y

- Admin `/audit` page lists `GET /admin/audit-log` (action filter + pagination); Moderation nav link
- Mobile Trending rows: `Semantics` button labels for screen readers
- Roadmap post-MVP rows: audit log, AdminTier moderator, content-scan health marked shipped/updated

### Master Execution Wave 28 (2026-08-29) — Legal footer Copyright + MFA live update

- Site footer `LegalLinks` includes Copyright → `/copyright/notice` (forms stay Terms/Privacy only)
- Cookie consent banner Privacy link targets `/privacy#cookies`
- Admin MFA enroll/disable dispatches `forge-admin-mfa` so the shell banner updates without navigation
- Roadmap: email-digest comment + PHASE_11/12 MVP-2 rows marked fixed/corrected

### Master Execution Wave 27 (2026-08-29) — Admin MFA UX + content-scan health + privacy

- Admin Settings unlocked for moderator-tier (`/settings` removed from `FULL_ADMIN_ONLY_HREFS`) so MFA enroll is reachable
- AdminShell banner when MFA is off → link to Settings
- `/health` readiness exposes `contentScan` (`noop` | `webhook` | `misconfigured`); misconfigured webhook degrades status
- Admin Settings health panel explains noop / misconfigured content scan
- Privacy policy: cookie consent + DSAR download copy; `LEGAL_LAST_UPDATED` → 29 August 2026
- Roadmap MVP-2 a11y row corrected (mobile a11y started; not “zero”)

### Master Execution Wave 26 (2026-08-29) — Mobile DMCA + admin MFA

- Mobile video report: “Copyright infringement” opens web `/copyright/notice?videoId=` (no `/reports` POST) — watch / feed / Shorts
- Admin login: MFA challenge step (`/auth/mfa/login-verify`)
- Admin Settings: TOTP enroll/disable (`AdminMfaSettings`) for `RolesGuard` MFA hard-gate

### Master Execution Wave 25 (2026-08-29) — Mobile DSAR + cookie consent

- Mobile Settings: Download your data → `GET /users/me/export` via share sheet (`JsonExportUtil`)
- Web: cookie consent banner; product analytics (`trackEvent`) gated on Accept (essential-only blocks)
- Web live watch: Share (native share / copy link) — URL share only; video `Share` table remains VOD-scoped by design
- Roadmap corrections: admin MFA API hard-gate; re-transcode already shipped; moderation systems explicitly bounded (platform `reports` vs community inbox — no XL merge)

### Master Execution Wave 24 (2026-08-29) — Copyright report → DMCA notice

- Video reports with `Copyright infringement` → `422 COPYRIGHT_USE_DMCA_NOTICE` (no pending triage report)
- Web report dialog links to `/copyright/notice?videoId=…`; public DMCA notice form posts `POST /copyright/notices`
- Designated-agent USPTO filing still outside codebase

### Master Execution Wave 23 (2026-08-29) — DSAR export depth + settings download

- `GET /users/me/export` adds authored video comments + community posts (cap 2000 each); soft-deleted comment bodies redacted
- Web Settings: “Download your data” JSON download (`DataExportSettings`)
- Chat/DM bodies + analytics events still excluded (volume / privacy)

### Master Execution Wave 22 (2026-08-29) — Async LLM comment re-judge + community report cap

- BullMQ `video-comment-moderation`: regex-held video comments re-scored via OpenAI Moderation only (`scoreWithOpenAiOnly`); false positives auto-release + `comment.created`
- Enqueue from `EngagementService.createComment` when `moderation.provider === 'regex'` (gated on `ai.moderationLlmEnabled` + API key)
- Owner `approveComment` now emits `comment.created` (parity with admin release)
- Community reports: 24h daily cap (`TRUSTED_DAILY_REPORT_CAP`) → 429, aligned with platform reports
- Unit tests: `video-comment-moderation.service.spec.ts` + engagement mock wiring

### Master Execution Wave 21 (2026-08-29) — Admin held comments queue

- `EngagementService.listHeldCommentsForAdmin` / `adminReleaseHeldComment` / `adminRemoveHeldComment`
- Admin API: `GET /admin/comments/held`, `POST …/release`, `DELETE …/:id` (+ audit log)
- Admin UI `/comments` + Moderation nav; complements Studio owner Release
- 41 engagement tests green

### Master Execution Wave 20 (2026-08-29) — Mux highlight clip export

- Migration `228` — `stream_clips.mux_clip_asset_id` / `playback_url` / `export_error`
- BullMQ `stream-clip-export`: create Mux clip asset from live recording; webhook completes HLS URL
- Markers stay `marked` until recording asset exists; auto-retry on `video.live_stream.recording`
- Host dashboard shows “Play clip” when `playbackUrl` is ready
- 56 related API tests green

### Master Execution Wave 19 (2026-08-29) — Community orphan + held comments

- Account deletion: promote MODERATOR if no OWNER/ADMIN; else privatize community + emit `community.orphaned_on_owner_delete`
- Studio Comments: “Held for review” filter + Release button (wires existing `POST …/approve`)
- `Comment.moderationStatus` on shared-types for Studio typing

### Master Execution Wave 18 (2026-08-29) — Report trust-weighting

- `reporter-trust.util`: daily caps from 30d dismiss/uphold history; low-trust demotes non-P0 severity
- Wired in `ReportsService.create` (429 when over daily cap); 24 tests green
- Closes MVP-3 trust-weight gap from PLATFORM_AUDIT / YOUTUBE_PARITY_ROADMAP

### Master Execution Wave 17 (2026-08-29) — Phase 04

- AppShell watch-like chrome for `/live/[id]` + community voice/text rooms
- Web studio redirects: `copilot` → `/studio`; `rooms`/`engagement` → `/studio/community`
- Admin redirects: `/mentorship`, `/channel-points` → `/dashboard`
- Mobile `/trending` + Library Trending/Explore split
- PHASE_04_REPORT refreshed

### Master Execution Wave 16 (2026-08-29) — Phase 03

- Admin soft-delete: bulk `UPDATE videos SET visibility=private` + chunked cache bust (no unbounded find)
- Migration `227` — `account_strikes.source_video_id` FK ON DELETE SET NULL
- Notification entity `@ManyToOne(User)` aligns with FK migration 222
- PHASE_03_REPORT refreshed

### Master Execution Wave 15 (2026-08-29) — Phase 02

- Web/admin env schema: APP_URL, BILLING_ENABLED, LIVEKIT_URL, WEB_URL (+ admin Sentry keys)
- Hot paths use validated `env` (billing, LiveKit, site URL, admin web links)
- AdminUser.role typed to `@forge/shared-types` User['role']
- MODULE_BOUNDARY_MAP: LMS Articles/Qa/StudyGroups; Queues central+re-register; prod env validation note
- API prod env validation confirmed already in `main.ts` (16 tests green)

### Master Execution Wave 14 (2026-08-29)

- Mobile watch engage: `recordShare` on native share / copy link / embed (parity with Shorts + feed)
- Web ShortsFeed + FeedCard: POST `/videos/:id/share` on share / copy-link
- Studio tiers price placeholder: USD cents (align with `formatCentsUsd`)
- Phase 01 Critical/High: re-verified closed; Wave 13 adminTier assign already on tip
- Phase 01 mop-up: live theater keeps chat (no `fixed inset-0`); Studio tiers `formatCentsCurrency`; fresh `PHASE_01_*` docs + report

### Master Execution Wave 13 (2026-08-29) — closed

- Admin user detail: assign `adminTier` (`full` / `moderator`) via PATCH + UI select (full-admin only) — shipped `d20360b`
- Community e2e DI + H23 `HlsPlayerBlock` already on tip

### Master Execution Wave 12 (2026-08-29)

- Community HTTP e2e: mock `CommunityModerationQueueService` for `CommunityAiController` DI
- H23 complete: extract `HlsPlayerBlock` from `watch_screen.dart` (player + volume prefs + PiP lifecycle)

### Master Execution Wave 11 (2026-08-28)

On `feature/continuous-parity-delivery`: likes dedupe migration + race-safe `setVideoReaction`; `AdminTier` full/moderator + `AdminFullGuard`; mobile `/settings/strikes`; studio realtime analytics endpoint; design-system dist rebuild; H23 partial (`WatchEngageRow` / `WatchCommentsSection`). See [PHASE-01-UI-UX §8](../execution/PHASE-01-UI-UX.md).

## Shipped in continuous parity delivery (2026-08-26)

Wave 0–2 on `feature/continuous-parity-delivery` (see [PHASE-01-UI-UX §8](../execution/PHASE-01-UI-UX.md)):

- Admin MFA hard-gate + JWT live `mfaEnabled` + MFA cache bust + admin audit-log fill-in
- Studio Live scoped to creator (`useLiveStreamsQuery(creatorId)`)
- Subscriber list private to owner/ADMIN (`getFollowers` ForbiddenException + web privacy UX)
- Theater mode keeps comments/info/chapters; TopBar Create hidden below `md`
- Studio comments/moderation/subscribers pagination + real error/retry
- Upload step 2 drag-drop + lost-file warning; RealtimeToasts on DS Toast
- Error/auth/studio `Button variant="primary"` batch; VideoPlayer touch secondary controls; Super Thanks infinite query; playlists attach via `fetchStudioLibrary`

### Wave 3 continuation (same day)

- Admin user detail: success/error toasts on update/delete/resend/approve/reject/impersonate/video mutations (`apps/admin/.../users/[id]/page.tsx`)
- Mobile `FollowerListScreen`: 403 → private-list message (widget tests); matches web
- Additional web `primary-button` → `Button` on studio/upload/search/messages/comments/settings CTAs (Links left as-is)

### Wave 4 (same day)

- Studio dashboard + analytics: drop deprecated `getMyVideos`; use `fetchStudioLibrary` (views sort / paginated ready library)
- Admin creator-approvals + content moderation: success toasts on single actions
- Analytics “Top videos” sorted by `viewCount`

### Wave 5 (same day)

- Search page form submit writes `pushSearchHistory` (H9) + vitest
- Admin `/ai` AI budget page wired to existing `GET /admin/ai/budget` (H19 thin surface) + Moderation nav

### Wave 6 (same day)

- `GET /admin/ai/budget` includes BullMQ community-moderation queue counts; admin AI page shows Waiting/Active/Failed/Delayed
- Exported `buttonClassName()` from design-system; high-traffic Links use it (closes Link `primary-button` debt on shell/gates/studio)
- Mobile studio comments scan aligned to web — superseded by Wave 57 (`GET /creators/me/comments`)

### Wave 7 (same day)

- Residual web + admin + DS EmptyState/StatusPage `primary-button` → `buttonClassName` / `Button` (apps/web zero raw hits)
- Partial H8: `apps/web/src/lib/comments-api.ts` + CommentsPanel wired (12 tests green)
- Validation: web 43 + API 68 targeted tests green

### Wave 8 (same day)

- H8 complete: `CommentsPanel.tsx` split → `CommentBody.tsx` + `CommentRow.tsx` + slim panel (12 vitest green). Like/dislike already pass state into `mutationFn` (no stale-closure race).
- H22 slice: `notifications/data/notifications_repository.dart` + screen/library unread badge wired; unit tests green

### Wave 9 (same day)

- H22: `library/data/library_repository.dart` (playlist counts + disliked videos) + unit tests
- H22: `messages/data/messages_repository.dart` (conversations/messages/send/markRead/search) + unit tests; socket stays in presentation

### Wave 10 (same day)

- H22 complete for remaining feature folders: playlists, subscriptions, profile, community, shorts — each with `data/*_repository.dart` + unit tests; sockets stay in presentation
- Mobile studio analytics MRR display aligned to USD (`$`) to match web `formatCentsUsd` (was hardcoded `₹`)

## Shipped in fresh Phase 01 re-audit (2026-08-08)

Re-ran a scoped UI/UX audit of `apps/web` + `apps/admin` + `packages/design-system` against the closed [PHASE_01_REPORT](01-ui-ux/PHASE_01_REPORT.md) baseline. Design-system token adoption confirmed clean (zero raw hex / default-Tailwind bypass in either app). Fixed:

- **Admin Fraud queue** (`apps/admin/src/app/fraud/page.tsx`): was hardcoded `limit=100` with no pagination and a hand-rolled `<table>` — now uses `DataTable` + `AdminPagination` (offset-based, backend already supported it) like every other admin list; added success/error toasts on update + re-check
- **Admin action feedback consistency**: `community/page.tsx` (resolve report, update community visibility) and `live/page.tsx` (force-end, grant access, delete chat message, backfill Mux) had `onSuccess` with no `onError` and no toast — added `useToast` success/error on all five mutations, matching the pattern already used in `content`/`users`/`creator-approvals`/`reports`
- **Admin Categories** (`apps/admin/src/app/categories/page.tsx`): added success toast on save/delete (was silent on success; inline error kept as-is for form validation)
- **Community post images** (`ChannelCommunityFeed.tsx:361`): `alt=""` on user-posted content images (not decorative) → `alt="Community post image"`
- Investigated `AdminUser.permissions` as a possible dead/half-wired nav-gating field — confirmed it's the standard `permissionsForUser()` platform tier (identical for every admin), correctly used only for read-only display on the user detail page. No scoped-admin-role system exists to wire nav to. **No change — false alarm from initial audit pass.**

### EmptyState sweep — resolved with judgment, not blind replace (2026-08-08)

Reviewed all 16 flagged spots individually rather than mechanically swapping every `<p>` for `EmptyState` — the component's fixed `px-6 py-12` card padding is right for full-page/section list-empty states but wrong for compact nested UI (dropdowns, side panels, chat threads, chart placeholders). Converted the ones that are genuinely page/section-level list-empties:

- `[username]/page.tsx` — Videos tab (`icon="video_library"`), Playlists tab (`icon="playlist_play"`)
- `settings/memberships/page.tsx` — no active memberships, now with a "Discover creators" CTA (was also nested invalid-HTML inside a bare `<ul>`, fixed alongside)
- `studio/subscribers/page.tsx` — no subscribers (same invalid-nesting-inside-`<ul>` fix)
- `discover/communities/page.tsx` — no featured communities (file already imported `EmptyState` for its search-empty case, so this was pure inconsistency)

Deliberately left as lightweight inline text (would be a regression to force `EmptyState` here):

| File | Why left inline |
| --- | --- |
| `[username]/page.tsx` "No channel description yet." | Bio placeholder copy, not a list-empty state |
| `messages/page.tsx` | Narrow (`w-72`) sidebar list, not page-width |
| `NotificationsMenu.tsx` | Fixed-height dropdown panel — `py-12` card would blow out the menu |
| `StreamHostDashboard.tsx` (highlights, delegated mods) | Compact nested subsections of a live dashboard |
| `ChannelCommunityFeed.tsx` "No comments yet." | Nested inline comment thread inside an expanded post |
| `CommunityPanel.tsx` "No community posts yet." | Nested tab pane inside a widget, not a top-level page |
| `CreatorCohortChart.tsx` | Insufficient-data placeholder for a chart, different semantics than "no items" |
| `CommunityStageRaiseHandPanel.tsx`, `StreamRaiseHandPanel.tsx` | Compact real-time live-panel queues |

### Notification preferences shipped (2026-08-08)

Closed the "no per-category/email-digest controls" gap:

- `packages/shared-types/src/notification-preferences.ts` — new `NotificationCategory` type, `NOTIFICATION_CATEGORY_BY_TYPE` map (single source of truth, replaces the API/web having two separate copies), `NotificationPreferences` shape, `isCategoryMuted()` helper. `apps/web/src/lib/notification-category.ts` now imports the category map instead of duplicating it.
- Migration `2020000000000-notification-preferences.ts` — `users.notification_preferences` jsonb, nullable (null = all on, digest off).
- `GET/PUT /users/me/notification-preferences` (`users.controller.ts`/`users.service.ts`), mirroring the existing `/users/me/privacy` pattern.
- **Gating is centralized in `NotificationsService.create()`/`createMany()`** rather than touched into each of the ~10 event handlers that call them (`notifications.listener.ts`, `direct-messages.service.ts`, `community-moderation.service.ts`, `community-activity-notify.listener.ts`, `subscription-maintenance.service.ts`, `premium-content-notify.service.ts`, `community-announcement-notify.service.ts`) — since those two methods are the only insert path, this covers unread count, the notification list, and the live socket toast for every notification origin with a one-file change and zero risk of a call site being missed.
- Web: `NotificationPreferencesSettings.tsx` (per-category checkboxes + digest toggle, optimistic-update-with-rollback shape matching `WatchHistoryPrivacyToggle.tsx`), wired into `/profile/settings#notifications`.
- Tests: `notifications.service.spec.ts` (+5), `users.service.spec.ts` (+3), `notification-preferences.spec.ts` (+5, new). Full API suite: 1081/1082 passing (1 unrelated pre-existing flake — `getAvatarUploadUrl` timeout under full-parallel load, passes clean in isolation, not touched by this change).

### FCM push gating closed (2026-08-08)

Followed up same-day: `PushDispatchService` now takes the same mute check as `NotificationsService`.

- `PushPayload`/`enqueueMany`'s job type gained a **required** `category: NotificationCategory` field — required on purpose so TypeScript itself force-lists every call site that needed updating (13 across `notifications.listener.ts` ×11, `premium-content-notify.service.ts`, `subscription-maintenance.service.ts`) rather than relying on remembering to touch all of them.
- `filterMutedJobs()` batch-fetches `notificationPreferences` for the job's recipient IDs and drops muted ones **before** the device-token lookup — a muted category now also saves a wasted token query, not just a wasted push.
- Tests: `push-dispatch.service.spec.ts` +2 (excludes-muted, no-ops-when-all-muted). Full API suite re-run green after this change.

In-app (bell/list/unread/live-toast) and FCM push now both fully respect a muted category — no remaining gap on the notification-preferences feature.

### CommentsPanel test coverage added (2026-08-08)

First of the 6 oversized files unblocked properly instead of left flagged: `CommentsPanel.tsx` (919 lines) had zero test coverage, which is why the file-split was declined earlier — no safety net to catch a regression. Added `CommentsPanel.test.tsx` (11 tests: render, empty state, post, sort refetch, optimistic like + rollback, author-only Edit/Delete, owner-only Remove/Pin/Heart, reply mention prefill, delete-confirm flow), verified stable across 5 repeat runs.

Writing these surfaced a real bug, fixed alongside: the composer textarea was `disabled` for guests, which made it unfocusable — the `onFocus` handler meant to prompt sign-in could never fire for a mouse or keyboard user. Switched to `readOnly` (blocks typing, allows focus) so the guest sign-in prompt actually works.

Also surfaced, not fixed (needs real verification before touching): `likeMut`/`dislikeMut`'s `mutationFn` reads the `liked`/`disliked` component-state closure instead of receiving it as a mutation argument. Under `@testing-library/user-event`'s `act()`-flushed timing, whichever endpoint (`api.post` vs `api.delete`) fires depends on exact re-render ordering relative to `onMutate`'s optimistic state update. Unconfirmed whether this reorders identically in a real browser (React 18's non-test scheduling may not flush the same way) — flagged rather than fixed blind. Fix would be `likeMut.mutate(liked)` with `mutationFn` taking the value as a parameter instead of closing over state.

Remaining 5 files still have no tests: `ShortsFeed.tsx` 866, `studio/videos/page.tsx` 921, `studio/videos/[id]/page.tsx` 780, `WatchExperience.tsx` 784, `search/page.tsx` 625. Same treatment (tests first, extract later) applies to each — not done in this pass to keep this a reviewable, single-file increment.

### SearchPage test coverage added (2026-08-09)

`search/page.tsx` (625 lines) — added `page.test.tsx` (13 tests: no-query/short-query prompts, video/channel/playlist/live result rendering, no-results and error states, type-tab navigation, duration/sort filter visibility by tab, guest hides watch-history filter, trimmed-query submit, live-only skips the catalog fetch).

### ShortsFeed test coverage added + gated() bug fix (2026-08-09)

`ShortsFeed.tsx` (866 lines) — added `ShortsFeed.test.tsx` (17 tests: loading/error/empty states, active-slide player vs. inactive thumbnail, like/dislike mutual exclusion, subscribe + notify-level menu + confirmed unsubscribe, own-video hides Subscribe, guest vs. unverified gating, block/not-interested removing a video, watch-later toggle, share clipboard fallback, deep-link pinning, comments panel).

Writing the guest/unverified gating tests surfaced a real, severe bug, fixed alongside: `ShortSlide`'s `gated()` checked whether the `onGuestAction` prop was passed *before* checking the actual per-user block reason, and `ShortsFeed` always passes `onGuestAction` to every slide — so `blockReason` was unconditionally forced to `null` and `gated()` always short-circuited to the generic feed-level guest modal. In effect, **every engagement action on Shorts (like, dislike, subscribe, watch-later, block, not-interested, don't-recommend) was dead for every viewer, guest or fully verified** — clicking Like as a signed-in verified user just reopened the "sign in" modal and never called the like mutation. Fixed by computing `blockReason` unconditionally and only deferring to `onGuestAction` when the reason is specifically `'guest'` (unverified users now correctly see the inline verify-email prompt instead of being misrouted to a sign-in prompt).

Also hit mid-debug, not a product bug: jsdom implements a real `navigator.clipboard` (unlike `navigator.share`, which is genuinely `undefined`), so replacing the whole `clipboard` property in a test is silently ignored — `vi.spyOn(navigator.clipboard, 'writeText')` is required instead. Noted here since the next oversized-file test pass may hit the same trap if it touches share/clipboard code.

### Remaining oversized-file tests closed out (2026-08-09)

All 3 remaining files from the original 6 now have coverage, closing this line item entirely:

- `studio/videos/page.tsx` (921 lines) — 13 tests (empty/search-empty/error states, row rendering, scheduled publish-now/cancel-schedule, cancel-upload + delete confirm flows, visibility change, clipboard copy, stuck-upload release, status filter re-query, pagination). No product bugs found. Desktop table + mobile list render simultaneously in jsdom (Tailwind `hidden`/`md:hidden` has no effect without real CSS), so row-scoped queries use `within(table)` to avoid duplicate-match errors — noted for any future test on a similar dual-layout page.
- `studio/videos/[id]/page.tsx` (780 lines) — 15 tests (access/loading/error/ownership guards, form save, scheduled publish/cancel, failed-video retry, caption upload end-to-end including a non-.vtt rejection delivered via `fireEvent.change` since `userEvent.upload` itself enforces the input's `accept` filter and won't attach a mismatched file, caption removal, thumbnail clear, playlist count). No product bugs found.
- `WatchExperience.tsx` (784 lines) — 18 tests (private/access-denied gates, processing/failed states, theater mode incl. keyboard, autoplay/loop persistence, up-next end screen, miniplayer, not-interested, block-user, owner hides menu, playlist queue + shuffle). No product bugs found — this file's guest/unverified gating (`onEngageBlocked`) checks the block reason before deciding where to route, unlike the inverted `ShortsFeed` bug fixed above.

### CommentRow like/dislike closure bug fixed (2026-08-09)

Closed: `likeMut`/`dislikeMut` in `CommentsPanel.tsx` now take the prior liked/disliked value as an explicit `mutate(arg)` argument instead of reading it from the `liked`/`disliked` closure — matching the `pinMut`/`heartMut` pattern already used lower in the same file. Argument values are frozen at the `mutate()` call site, so which mutationFn closure TanStack Query's internal options-ref happens to invoke no longer matters. `CommentsPanel.test.tsx`'s 11 tests pass stably across 5 repeat runs.

### Email digest job shipped (2026-08-09)

Closed the last open engineering item: `emailDigest` preference now has a real job behind it. Cadence (daily, 13:00 UTC) confirmed with product before building. `EmailDigestService.runDigest()` batches opted-in users (200/page), queries each user's unread notifications since their `last_email_digest_sent_at` watermark (new migration; defaults to a 24h lookback on first send), and sends a plain-text summary via the existing `MailService` — this codebase has no HTML email template system (every transactional email — verify, reset password — is a plain-text template literal), so the digest follows that convention rather than inventing a new one. Watermark only advances on successful send, so a mail failure retries the same window next day. Wired as a BullMQ repeatable job (`EmailDigestScheduler` + `EmailDigestWorker`) cloning the exact `SubscriptionMaintenanceScheduler`/`Worker` registration pattern (same `shouldRegisterBullScheduler` gate, same dev/production/dedicated-worker-process rules in `workers.module.ts`, `DISABLE_EMAIL_DIGEST` escape hatch matching sibling jobs). 7 unit tests; full API suite 1091/1091 passing.

**With this closed, every remaining open item from the original backlog is ops/product-owned** (see the "Still open" table below). Separately, a new voluntary initiative started below: mobile widget-test coverage (`apps/mobile/test/` had zero widget tests before this).

### Mobile widget-test infrastructure started (2026-08-09)

`apps/mobile/test/` had unit tests against repositories only — zero widget tests anywhere, despite most business logic living inline in presentation-layer `State` classes (per the earlier mobile audit: `ShortsFeed`-equivalent screens, `WatchScreen` at 2681 lines, etc., all untested at the widget level).

Added `test/widget/test_support/widget_harness.dart` + first coverage on `FeedScreen` (7 tests: load/empty/error states, unread badge, continue-watching rail, like optimistic update + failure rollback). No product bugs found in `FeedScreen` itself.

**The harness took real debugging to get right** — worth reading before writing the next widget test file:
- A bare `testWidgets` body does not run in a zone that drains real async I/O on its own. `await` on the fake Dio adapter's Future never resolves, even with zero `pump()` calls — proven by reproducing the identical `FeedRepository.getFeed()` call that resolves instantly in `feed_repository_test.dart`'s plain `test()` environment but hangs forever (three-minute timeout) inside `testWidgets`. `pumpAndSettle()` does not fix this either — it only drains Flutter's own frame/animation scheduling, not arbitrary Futures.
- Fix: per Flutter's own `tester.runAsync` contract, the async call chain must *originate* inside `runAsync` for its continuation to run in the real zone — `initState()`-triggered fire-and-forget work (e.g. `_loadInitial()`) is kicked off synchronously by `pumpWidget`, and an `onTap` handler's work is kicked off synchronously by `tester.tap`, so both calls themselves (not just an `await` afterward) must happen inside `runAsync`. Use `pumpForgeScreen`/`tapAndSettle` from the harness, not raw `pumpWidget`/`tester.tap` + `pumpAndSettle`.
- Separately, `Hive.deleteFromDisk()` also hangs under the widget-test binding (unlike bare `test()`, where it's the established pattern in every repository spec) — the harness's `TestCache.dispose()` uses `Hive.close()` + manual directory delete instead.
- Since every repository provider in this app derives from `apiClientProvider` (`ref.read(apiClientProvider)`), overriding just that one provider via `ProviderScope` fakes the entire network layer for any screen — no per-repository overrides needed.

**Second pass (`ShortsScreen`, 2026-08-09) found two more harness gaps**, both now fixed in `pumpForgeScreen`/`tapAndSettle`/`_pumpAndDrain`:
- `pump()` with no argument advances Flutter's own animation clock by *zero*. A still-transitioning route (a `PopupMenuButton` opening, an `AlertDialog` appearing right after) leaves an `IgnorePointer`/`AbsorbPointer` in the hit-test path — a tap on its content gets silently absorbed instead of reaching the target, which reads as "nothing happened" rather than an error. Fixed by pumping with an explicit duration so the fake clock and the real `runAsync` delay advance together.
- A 3-hop interaction (open menu -> tap item -> confirm dialog) needed more settle margin than a single tap; bumped from 3 to 5 rounds.
- Not a harness bug, but a real footgun the tests caught: `_ShortAction`'s label `Text` is a sibling of its tappable `InkWell`, not wrapped by it — tapping the label text is a no-op. Tap the icon instead.
- Quality lesson: a rollback test can pass against a *completely broken* tap, because the rollback's expected end state is identical to "the action never fired at all". Assert the mutation's HTTP call actually happened (via the fake adapter's request log), not just the visual end state, whenever a test's "before" and "after failure" states look the same.

Full mobile suite: 97/97 (unit + widget). Remaining screens with zero widget coverage: `watch_screen.dart` (2681 lines), `studio_*` screens, `subscriptions_screen.dart`, etc.

Full mobile suite: 85/85 (unit + widget). Remaining screens with zero widget coverage: everything else — `ShortsFeed`-equivalent (`shorts_screen.dart`), `watch_screen.dart` (2681 lines), `studio_*` screens, `subscriptions_screen.dart`, etc. Same harness applies; next file should follow `feed_screen_test.dart`'s pattern directly rather than rediscovering the `runAsync` requirement.

**Third pass (`WatchScreen`, 2026-08-09) — 10 tests, found 3 real production bugs, not just harness gaps:**
- `_WatchBodyState.initState()` called `ref.read(miniPlayerProvider.notifier).close()` synchronously. `_WatchBody` mounts as a direct consequence of `videoDetailProvider` resolving inside its own ancestor's `build()`, so a fast-resolving fetch (cache, or just fast network) can trip Riverpod's "tried to modify a provider while the widget tree was building" guard in production, not just under test. Fixed by deferring via `Future(() => ...)`, per Riverpod's own recommended remediation.
- `_HlsPlayerBlockState._bootstrap()` awaited `VideoPlayerController.initialize()` with no error handling — a failed/unreachable stream left the screen on an infinite loading spinner forever, no retry, no message. Added a try/catch that disposes the controller and shows a "Couldn't load video" state with a Retry button, mirroring the already-working pattern in `ShortsScreen`'s `_ensurePlayer()`.
- `_WatchEngageRowState`'s action-button `Row` (Like/Dislike/Super Thanks/Watch Later/Save/Share/Copy link/More/Subscribe, ~8 controls) had no scrollable or flexible wrapper — a real `RenderFlex overflowed` on the 800px test viewport, which is wider than real phone screens (~360-430dp), so it's strictly worse in production. Fixed by wrapping the button row in a horizontal `SingleChildScrollView` and moving the channel-name text button to its own row below (a `Spacer()` can't live inside an unbounded-width scrollable `Row`).

New harness capabilities added for screens like this one:
- `ProviderScope(retry: (_, __) => null, ...)` in `pumpForgeScreen` — Riverpod 3's default retry-with-backoff on a failed `FutureProvider`/`AsyncNotifier` keeps it in `AsyncLoading(error: ...)` indefinitely, so `.when()` never reaches the `error:` branch under test. Screens that manage their own load/error state manually (`FeedScreen`, `ShortsScreen`) never hit this; any screen `ref.watch`-ing a `FutureProvider`/`AsyncNotifier` directly for its data will.
- `useTallViewport(tester)` + `drainAsync(tester)` — a `ListView`/`Sliver`-based screen only materializes children within the current viewport (unlike `Column` + `SingleChildScrollView`, which builds everything regardless of visibility), so content below the fold genuinely doesn't exist in the tree yet at the default 800x600 test window. Widen the viewport for screens whose whole content needs to be simultaneously present.
- `videoDetailProvider` (a `FutureProvider.family.autoDispose`) is overridden directly via `.overrideWith(...)` rather than simulated over the fake Dio adapter like every other provider — it was getting disposed/re-created mid-settle under the widget-test binding for reasons not fully root-caused; direct override is also just the standard Riverpod testing pattern for a "fetch one thing" provider.
- Known gap, left as-is: `VideoPlayerController.initialize()` hangs (never rejects) under `flutter test` with no platform channel registered, so the new `_initFailed` fallback UI can't be exercised through this harness without a dedicated `VideoPlayerPlatform` fake — out of scope here. The same blind spot already existed for `ShortsScreen`'s player.

Full mobile suite: 107/107 (unit + widget). Remaining screens with zero widget coverage: `studio_*` screens, `subscriptions_screen.dart`, etc.

**Fourth pass (`SubscriptionsScreen`, 2026-08-09) — 4 tests, no production bugs found.** Straightforward screen (plain repository + direct `api.dio.get` calls, no gotcha-prone providers or gesture arenas); confirms the harness generalizes without new capabilities needed.

Full mobile suite: 111/111 (unit + widget). Remaining screens with zero widget coverage: the 17 `studio_*` screens (~6,700 lines total, `studio_video_edit_screen.dart` alone is 995 lines) — largest remaining chunk of the mobile test-coverage initiative, likely worth splitting across several focused passes rather than one sweep.

**Fifth pass (`StudioChannelPostsScreen`, 2026-08-09) — 3 tests, no production bugs found.** Kept scoped to the screen's own logic (sign-in gate, threading `creatorId`/`username` into `ChannelCommunityPanel`) rather than exercising the 671-line `ChannelCommunityPanel` itself (compose/comments/pin/like) — that panel is shared with the public profile Community tab, not studio-specific, and deserves its own dedicated test file if tackled later.

Full mobile suite: 114/114 (unit + widget). Remaining: 16 `studio_*` screens.

**Sixth pass (`StudioSettingsScreen`, 2026-08-09) — 3 tests, no production bugs found.** A `ListView` past the fold again needed `useTallViewport`.

Full mobile suite: 117/117 (unit + widget). Remaining: 15 `studio_*` screens.

**Seventh pass (`StudioLiveDebriefScreen`, 2026-08-09) — 3 tests, no production bugs found.**

Full mobile suite: 120/120 (unit + widget). Remaining: 14 `studio_*` screens.

**Eighth pass (`StudioSuperThanksScreen`, 2026-08-09) — 3 tests, no production bugs found.** Export-CSV button intentionally left untapped in tests — it drives `SharePlus.instance.share` via a real platform channel with no test-time implementation, same class of gap as `VideoPlayerController`.

Full mobile suite: 123/123 (unit + widget). Remaining: 13 `studio_*` screens.

**Ninth pass (`StudioAttentionScreen`, 2026-08-09) — 3 tests, no production bugs found.**

Full mobile suite: 126/126 (unit + widget). Remaining: 12 `studio_*` screens.

**Tenth pass (`StudioLiveScreen`, 2026-08-09) — 5 tests, no production bugs found.**

Full mobile suite: 131/131 (unit + widget). Remaining: 11 `studio_*` screens.

**Eleventh pass (`StudioSubscribersScreen`, 2026-08-09) — 3 tests, no production bugs found.**

Full mobile suite: 134/134 (unit + widget). Remaining: 10 `studio_*` screens.

**Twelfth pass (`StudioCopilotScreen`, 2026-08-09) — 3 tests, no production bugs found.**

Full mobile suite: 137/137 (unit + widget). Remaining: 9 `studio_*` screens.

**Thirteenth pass (`StudioRoomsScreen`, 2026-08-09) — 5 tests, found 1 real bug.** The room-permissions header did `_permissionsRoomId!.substring(0, 8)` unconditionally — any room id under 8 characters throws a `RangeError` and crashes the screen. Real ids are UUID/cuid-length in practice, so unlikely to hit in production, but still a genuine crash risk with no defensive bound. Fixed with `.substring(0, id.length.clamp(0, 8))`.

Full mobile suite: 142/142 (unit + widget). Remaining: 8 `studio_*` screens.

**Fourteenth pass (`StudioTiersScreen`, 2026-08-09) — 4 tests, no production bugs found.**

Full mobile suite: 146/146 (unit + widget). Remaining: 7 `studio_*` screens.

**Fifteenth pass (`StudioScreen`, 2026-08-09) — 3 tests, no production bugs found.** Covers the main dashboard: urgent-badge aggregation from `studioAttentionProvider`'s counts, and the FAB's create-sheet quick actions.

Full mobile suite: 149/149 (unit + widget). Remaining: 6 `studio_*` screens.

**Sixteenth pass (`StudioModerationScreen`, 2026-08-09) — 4 tests, no production bugs found.** `IndexedStack` keeps every tab built but only the selected one is hit-testable — tests switch tabs via the `ChoiceChip` before tapping into a non-default tab's controls.

Full mobile suite: 153/153 (unit + widget). Remaining: 5 `studio_*` screens.

**Seventeenth pass (`StudioCommentsScreen`, 2026-08-09) — 5 tests, no production bugs found.** `getRecentComments()` fans out `GET /videos/studio` then a `GET /videos/:id/comments` per ready video — handlers keyed by path only (query ignored) cover this without needing to pin call order.

Full mobile suite: 158/158 (unit + widget). Remaining: 4 `studio_*` screens.

**Eighteenth pass (`StudioAnalyticsScreen`, 2026-08-09) — 3 tests, no production bugs found.**

Full mobile suite: 161/161 (unit + widget). Remaining: 3 `studio_*` screens.

**Nineteenth pass (`StudioCommunityScreen`, 2026-08-09) — 5 tests, no production bugs found.** Harness gap, not a product bug: `MapHttpAdapter` keys by path only, so three calls to the same `/members` path differing only by `?status=` query collide on one handler. Fixed in the test by branching inside the handler on `req.uri.queryParameters['status']` (not `req.queryParameters`, which doesn't carry the value through) — worth remembering for any screen that calls one endpoint with different query filters.

Full mobile suite: 166/166 (unit + widget). Remaining: 2 `studio_*` screens (`studio_videos_screen.dart`, `studio_video_edit_screen.dart` — the two largest).

**Twentieth pass (`StudioVideosScreen`, 2026-08-09) — 5 tests, no production bugs found.** Covers the library list, debounced search, filter-chip requery, and delete-with-confirm; the popup menu's other actions (publish now, cancel schedule/upload, retry, visibility toggles) share the same `_load()`-after-mutation pattern already proven here, so left uncovered rather than re-testing the identical shape five more times.

Full mobile suite: 171/171 (unit + widget). Remaining: 1 screen (`studio_video_edit_screen.dart`, 995 lines — the largest in the app).

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

- Web Studio comments: search + Published / Held for review / Pinned / Hearted chips
- Mobile Studio comments: same filter chips + Release (Wave 48)

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
- Community access / list / join / channels refuse blocked creator peers
- Community reports keep working after block (`skipBlockGate`); discover search/featured omit blocked creators
- Web theater: Escape exits theater (watch + live)
- Community study groups gate on community access (incl. block); group DMs refuse blocked peers; iOS `audio` background mode for playback
- Public membership tiers / membership-me / LMS bundles / creator resources refuse blocked peers; content `checkAccess` returns not_available when blocked
- LMS course catalog / creator library / podcast episodes honor blocks when viewer is signed in
- iOS system PiP via native `AVPlayer` + `AVPictureInPictureController` (`forge/pip`); Android Activity PiP unchanged
- Mobile live watch OS PiP (button + Home); web live `m` / `p` / `f` shortcuts
- Live poll/clips/captions/RSVP/raise-hand/reactions gated on host block; Shorts `m`/`k`/space only
- Access-session start refuses blocked creators; LMS public reputation refuses blocked peers
- Mux playback rewrite uses URL hostname checks (not substring)
- Community access meta `unavailable` → web/mobile “not available” (vs membership restricted)
- CodeQL hardening: analytics ingest via OptionalJwt (no manual bearer bypass), owned `s3Key` validation, multer temp path containment before read/unlink, video-processor `mkdtemp`, Resend SMTP hostname equality, FCM SW same-origin via Client URL

## Still open → moved to deferred backlog

Canonical open list: **[audits/DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md)** and audit gaps [FRESH_AUDIT_2026-09-03_MASTER.md §4a](../audits/FRESH_AUDIT_2026-09-03_MASTER.md).

Folded from this table (2026-09-03 evening):

| Former row | Disposition |
| --- | --- |
| Staging soak / load evidence | DEFERRED + R1 |
| Mux signing keys / Stripe webhooks | DEFERRED ops |
| PR #185 merge handoff | **Obsolete** — wave merged; cutover is [POST_REAUDIT_CUTOVER.md](../operations/POST_REAUDIT_CUTOVER.md) |
| Nest LMS file deletion | Deferred (flags sufficient) — ADR-006/007 |
| Realtime Studio analytics curves | Product depth — not launch |
| Full ML / embeddings | ADR-008 trigger (100K MAU) |
| Offline download packages | Product deferred |
| Kids / Restricted Mode | DEFERRED legal/product |
| **Ad breaks / VAST** | **Closed — permanently N/A** (ADR-005); do not reopen |

### Completed eng depth (historical)

Block-parity, PiP, theater, Shorts CC/Save, username cooldown, notifyLevel, Studio/comment parity — see git history. Prefer small focused PRs. Execute [PRODUCTION_CHECKLIST.md](../operations/PRODUCTION_CHECKLIST.md) and R1 ops before marketing launch — not a second Master Execution pass.

