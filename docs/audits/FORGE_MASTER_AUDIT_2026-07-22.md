# FORGE — Master Enterprise Production-Readiness Audit

**Date:** 2026-07-22
**Type:** Independent, from-scratch, full-codebase audit (architecture, backend/API/database, web/admin, mobile, security, DevOps/AWS/infra, QA, UI/UX/product/analytics)
**Method:** Eight parallel domain audits, each performed by re-deriving findings directly from source code (Read/Grep/Glob across the monorepo), not from prior audit documents. Each domain audit was explicitly instructed not to read `docs/audits/` — findings below are independent of, and were not anchored to, any earlier report.
**Reviewers (persona lenses applied):** Principal Software Architect, Staff+ Full-Stack Engineer, Senior Backend/Database/API Architects, Senior React/Next.js Engineer, Senior Flutter Engineer, Senior Security Engineer, Senior DevOps/AWS/SRE, Senior QA Automation Lead, Senior Product Designer/UX Researcher/Accessibility/Analytics/PM.
**Known limitation of this environment:** No live database, Redis, AWS console, Fly/Vercel/Neon console, browser, or Flutter SDK was available. Every finding below is grounded in static source review; anything that would require live-runtime verification is explicitly flagged as unverifiable in its section rather than assumed.

---

## 1. Executive Summary

FORGE is a large, mature, multi-surface creator-economy platform (NestJS API, two Next.js frontends, a Flutter mobile app, ~35 backend feature modules) that shows genuine engineering discipline in the places that matter most for reliability: authentication, webhook handling, database migration hygiene, and real-time scaling. It is **not a prototype** — the codebase carries the marks of at least one prior hardening pass (consistent exception handling, refresh-token rotation with reuse detection, DLQ-backed queues, a real design system with accessible primitives).

At the same time, this independent audit surfaced **9 Critical and roughly 26 High-severity findings** spread unevenly across domains. The pattern is consistent: **core money/auth/data paths are solid; the surrounding scaffolding — SEO, analytics instrumentation, CI test execution, a handful of god-objects, and a few infra guardrails — has real, fixable gaps.** No finding in this audit describes a fundamentally broken architecture; every Critical item has a bounded, well-scoped fix.

**Overall score: 6.8 / 10 (Grade: C+ — Adequate-to-Strong; production-viable core with concentrated, fixable gaps).** See §12 for the full scorecard.

---

## 2. Overall Health Assessment

| Signal | Assessment |
|---|---|
| Can the platform run in production today? | Yes — API/web/admin show mature auth, payments, and real-time patterns. |
| Is it safe to scale traffic significantly without changes? | No — a single non-HA worker process, unbounded destructive-script blast radius, and a handful of god-object services will become bottlenecks. |
| Is the mobile app release-ready? | Conditionally — strong offline/upload/lifecycle engineering, but cert pinning is dormant, deep links are unconfigured, and widget-level tests are at zero. |
| Can the business measure its own growth? | **No** — signup, login, publish, and purchase funnels are either unfired or have no analytics vocabulary at all. This is the single most consequential product finding in this audit. |
| Is the codebase testable and covered? | Partially — the backend's slim-e2e convention is genuinely well executed where applied, but web/admin unit tests exist and **never run in CI**, and several critical journeys (email verification, admin moderation, live chat moderation) have zero coverage. |
| Is there a live, unauthorized data-exposure risk today? | **Yes, one** — any authenticated user can join any Direct Message conversation's real-time Socket.IO room and receive private messages, because membership is checked on REST reads but not on the socket join path. This should be fixed immediately (see §11, Critical #1). |

---

## 3. Strengths (cross-domain synthesis)

- **Auth is genuinely production-grade.** Refresh-token rotation with reuse detection (stolen-token mitigation), bcrypt cost-factor-12 hashing, hashed-at-rest refresh tokens, Redis-backed instant global logout, CSRF double-submit with constant-time comparison, and a secure-by-default global guard chain (`JwtAuthGuard → RolesGuard → ConsumerOnlyGuard → PermissionsGuard → ThrottlerGuard → EmailVerifiedGuard`) applied to every route by default.
- **Payments/webhooks are done correctly.** Stripe signature verification against raw body, dedicated webhook idempotency service with real tests, and an integration-level e2e spec (`billing-webhook-http.e2e-spec.ts`) that proves the actual checkout→entitlement-unlock seam — the single best test in the repository and a template the rest of the codebase should copy.
- **Real-time scaling is thoughtfully engineered.** Redis Socket.IO adapter with graceful single-replica fallback, per-user join rate limiting, JWT handshake auth, and a transactional-outbox pattern for reliable event delivery.
- **The design system is a real system, not a token dump.** `Dialog` has an actual focus trap, `Input` wires `aria-invalid`/`aria-describedby` automatically, `DataTable` has roving-tabindex keyboard navigation, and `FeedGrid` is genuinely virtualized (`@tanstack/react-virtual`) with HLS manifest preloading — well above typical mid-size SaaS baseline.
- **Migration and boot-time safety discipline.** `synchronize: false` always enforced, migrations run explicitly, production env-schema validation fails closed on weak/placeholder secrets, and destructive scripts require explicit opt-in confirmation (though coverage of that guard is incomplete — see §11).
- **Mobile shows real production maturity.** Offline-first Hive caching, resumable/interruption-aware uploads, correct controller/stream disposal, lifecycle-aware video pause on backgrounding, and a testable, pure `resolveRedirect()` route-guard function.
- **No committed secrets, near-zero `any` usage, zero TODO/FIXME debt found in the sampled code** — real code-review discipline, not just aspiration.

---

## 4. Weaknesses (cross-domain synthesis)

- **The business cannot measure itself.** Signup, login, and publish events are schema-ready but never fire; there is no analytics vocabulary at all for checkout/subscribe — the platform's two most important funnels (activation, revenue) are completely dark.
- **Tests exist but don't run.** Web and admin unit test suites are wired in `package.json` and contain real, meaningful tests — but CI never invokes them, so they currently provide zero regression protection.
- **SEO infrastructure is simply absent**, not broken — no `sitemap.ts`, no `robots.ts`, no structured data anywhere, on a platform whose growth model depends partly on organic content discovery.
- **A handful of god-objects sit at the center of the domain model** (`CommunitiesService` at 2,035 lines/18 dependencies, `EntitlementsService` at 1,482 lines/56 methods, `EventsGateway` at ~715 lines spanning 10+ domains), bound together by 65 `forwardRef` circular-dependency workarounds across 26 files.
- **Infra has real, if narrow, blast-radius gaps**: a destructive wipe script whose production guard covers only one of three destructive targets (DB, not Redis/S3), no S3 versioning despite a broad `DeleteObject` grant, and a single non-HA worker machine as a SPOF for the entire video/analytics pipeline.
- **Mobile has the weakest feature parity** of any surface — nearly every monetizable feature (memberships, live VIP/breakout, gamification, courses) is ⚠️ partial on mobile while ✅ on web/API, directly undermining competitive positioning against mobile-first competitors (Twitch, Patreon).
- **One live, confirmed authorization gap**: DM Socket.IO room join bypasses the membership check enforced everywhere else.

---

## 5. Detailed Findings by Domain

### 5.1 Architecture & Code Quality

**Method:** 12 files read in full across `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, `packages/*`, plus structure mapping via Glob/Grep for TODO/FIXME/HACK markers, `forwardRef` usage, and file-size hotspots.

#### Strengths
- Clean, feature-based module inventory (25+ NestJS modules) with a well-organized `common/` cross-cutting layer (filters, guards, interceptors, Redis, CLS, throttler, webhooks). **Zero** TODO/FIXME/HACK markers found across `apps/api/src`, `apps/web/src`, `apps/admin/src`, `packages/*`.
- `GlobalExceptionFilter` is a single, consistent catch-all: normalizes exceptions, wires Sentry conditionally, includes `correlationId`, never leaks stack traces.
- `EventsGateway` shows real production hardening: Redis adapter with graceful fallback, per-user join rate limiting via `SET NX EX`, JWT handshake auth.
- Mobile `ApiClient` is a genuinely solid HTTP layer: cert pinning, a deliberately separate `Dio` instance for token refresh to avoid recursive 401 loops (with an inline rationale comment), secure storage.
- Only 2 `any` occurrences in `apps/api/src`, 0 in `apps/web/src` — real TypeScript discipline.
- Auth/session code shows evidence of a prior security-hardening pass: `apps/web/src/lib/auth-storage.ts` deliberately avoids `localStorage` for the access token, citing reduced XSS exposure.
- Legacy-API deprecation is handled with a structured decorator+interceptor pair (`deprecated-channel-api.*`), not silent comments.
- Mobile router factors `resolveRedirect()` out of the `redirect` callback specifically so tests exercise the real `protectedRoutes` list, not a hand-copied duplicate.

#### High
1. **God-object services violate SRP in the most business-critical modules.** `apps/api/src/modules/communities/communities.service.ts` (2,035 lines, 18 constructor-injected dependencies) and `apps/api/src/modules/entitlements/entitlements.service.ts` (1,482 lines, 56 async methods). `CommunitiesService` alone owns CRUD, channel migration, moderation orchestration, AI moderation, room messaging, and feature-flag gating. High coupling means any change risks touching this one file; hard to unit test in isolation. **Fix:** extract along existing sibling seams (`community-posts.service.ts`, `community-moderation.service.ts`, `community-rooms.service.ts` already exist) so `CommunitiesService` becomes a thin facade. Effort: 3-5 days per service.
2. **Pervasive circular module dependencies via `forwardRef`** — 65 occurrences across 26 files, including gateway, billing, communities, streaming, entitlements, feed modules. This is NestJS's documented escape hatch for cyclic DI graphs, not a pattern; indicates domain boundaries were drawn after the fact. **Fix:** introduce interface/token-based boundaries or extract shared read-only logic into a lower-level provider both sides can depend on unidirectionally. Effort: 1-2 weeks for the top 5 offenders.

#### Medium
3. **Cross-app duplication instead of shared-package extraction** — `csrf.ts`, `auth-storage.ts`, `sentry-init-options.ts`, `app-check.ts`, `api.ts` are hand-maintained in parallel between `apps/web` and `apps/admin` despite `packages/shared-types`/`packages/design-system` already establishing the cross-app-sharing pattern. `sentry-init-options.ts` has already drifted by 4 lines. **Fix:** extract into `packages/shared-types` or a new `packages/web-shared`. Effort: 1-2 days.
4. **Business logic embedded in an oversized page component** — `apps/web/src/app/studio/communities/[id]/page.tsx` (759 lines, the largest file in `apps/web`) does direct `api.post()` calls and holds 14+ `useState` hooks inline, conflicting with the project's own "business logic in hooks/services" rule. Effort: 1 day.
5. **Fragmented upload logic** — 9 files, 676 lines, under `apps/web/src/lib` (`upload-manager.ts`, `upload-storage.ts`, `upload-storage-multipart.ts`, `multipart-session.ts`, etc.) with unclear ownership boundaries between overlapping-sounding files. Effort: 0.5-1 day to consolidate.
6. **`@deprecated` legacy Channels API still fully wired into the hottest module** — legitimate in-flight migration tracking, but carries real dual-maintenance cost with no sunset date set.

#### Low
7. Stray `console.*` calls (9 occurrences) outside the structured `Logger` convention — all in pre-bootstrap/seed scripts, low impact.
8. Mobile router (`app_router.dart`) imports ~50 screens in one file — common `go_router` pattern but a growing merge-conflict hotspot.

#### Unverifiable in this pass
`videos.service.ts` (1,186 lines), `streaming.service.ts` (965 lines), `admin.service.ts` (774 lines) were not read line-by-line — likely candidates for the same god-service pattern given size, not confirmed. Migration rollback correctness and index coverage not independently assessed.

**Scores:** Architecture **6.5/10** · Code Quality/Maintainability **7.0/10**

> Feature-based module structure is broadly sound across all four apps, and cross-cutting concerns (Socket scaling, exception handling) are production-grade. Held back by concentrated god-services and 65 circular-dependency workarounds that will actively resist the platform's own stated direction toward more modular feed/search/analytics pipelines.

---

### 5.2 Backend, API & Database

**Method:** ~20 files read in full across `apps/api/src` — `app.module.ts`, auth module, database/migrations, billing (Stripe webhook path), Socket.IO gateway, BullMQ workers, admin controller, feed service, entitlements service, direct-messages service, health controller, exception filter/interceptor, pagination utilities.

#### Critical
1. **DM group/conversation Socket.IO room has no membership check — cross-tenant message leakage.**
   File(s): `apps/api/src/gateway/events.gateway.ts` (`handleJoinConversation`, ~L476-485), `apps/api/src/modules/direct-messages/direct-messages.service.ts` (`assertMember` used only on REST paths).
   Current implementation: `handleJoinConversation` only calls `requireAuth(client)` then unconditionally `client.join('conversation:${data.conversationId}')`. Code comment: *"Membership verified on REST; socket join is best-effort for realtime."*
   Problem: `direct-message.sent` events broadcast to that room in addition to per-recipient rooms. Any authenticated user can guess/enumerate a conversation UUID and receive the live message stream of a conversation they're not in.
   Why it matters: private DM content is exposed — an authorization bypass via WebSocket (IDOR), a severe confidentiality issue for a platform with paid communities/DMs.
   **Fix:** call `directMessagesService.assertMember(userId, conversationId)` before `client.join(...)`, mirroring the `assertStreamAccess`/`assertChannelAccess`/`assertRoomAccess` patterns already implemented elsewhere in the same file, with the same short-TTL Redis cache. Reference: OWASP ASVS 4.0 §4.1. **Effort: 2-4 hours. Impact: closes a live data-leakage vector with no functional regression.**

#### High
2. **Self-hosted ffmpeg transcode pipeline coexists with Mux VOD pipeline — scalability/consistency risk.** `apps/api/src/modules/workers/video-processor/video-processor.worker.ts` downloads to local disk, generates 4 renditions sequentially, and uploads every HLS segment to S3 **one at a time in a sequential loop** (no `Promise.all`/concurrency limit). CPU/memory/disk-bound on the same Fly worker machine that runs other BullMQ consumers, with no visible per-job resource ceiling. **Fix:** confirm Mux is sole production path and retire/gate the ffmpeg fallback, or parallelize `uploadHlsToS3` with a bounded pool. Effort: 0.5 day (confirm/retire) to 0.5 day (parallelize).
3. **Guard order runs RBAC/permission checks before rate limiting.** `ThrottlerGuard` sits second-to-last in the global `APP_GUARD` chain, after JWT + Roles + ConsumerOnly + Permissions all execute. Under credential-stuffing/scripted abuse, this wastes CPU on guard chains for requests about to be throttled anyway. **Fix:** move `ThrottlerGuard` immediately after `JwtAuthGuard`. Effort: small config change + regression run.
4. **`EventsGateway` is a single ~715-line god-object spanning 10+ unrelated domains** — live streams, VOD comments, community channels/rooms/polls, DMs, notifications, gamification, channel points, creator analytics, breakout rooms, all in one class with `forwardRef` imports of three large modules. Violates the project's own "feature-based modules" principle; any regression risks impacting unrelated real-time flows sharing the same DI graph. **Fix:** split into per-domain gateway providers sharing one `@WebSocketServer()` namespace. Effort: multi-day structural refactor.

#### Medium
5. Sequential per-row processing in subscription-expiry reconciliation (up to 500 sequential DB+Redis round trips per run) — **fix:** bulk `In(ids)` update + pipelined Redis busts. Effort: 0.5-1 day.
6. Inconsistent Socket.IO rate-limiting coverage — only `join-community`/`join-channel`/`join-room` are throttled; `join-stream`, `join-video`, `join-conversation`, `stream:react` are not.
7. `in-memory userSockets` map on the gateway doesn't survive/scale across replicas — likely dead code or a latent multi-replica correctness bug; needs an explicit decision.
8. `RolesGuard`/`PermissionsGuard` throw generic `ForbiddenException` without a stable `code` field, unlike `AuthService`'s consistent `{message, code}` shape — inconsistent client-facing error contract.

#### Low
9. Global 1MB JSON body limit applies ahead of the Stripe webhook route — worth confirming large invoice payloads never approach that limit.
10. Swagger UI (`/api/docs`) is gated only by `nodeEnv !== 'production'` string check, with no additional auth for staging environments that may not literally set `NODE_ENV=production`.

#### Strengths
Refresh-token rotation with reuse detection and full-session revocation on detected reuse; correct raw-body Stripe signature verification plus a dedicated, tested webhook-idempotency service; `synchronize: false` always enforced with `migrationsTransactionMode: 'each'` and slow-query logging; hard-capped, cursor-based feed pagination with jittered cache TTLs and generation-key invalidation (cache-stampede aware); Socket.IO Redis adapter with graceful degrade-not-crash fallback; DLQ + attempts/backoff on BullMQ queues; `nestjs-pino` structured logging with correlation IDs and secret redaction; consistent `{success, data, correlationId}` / `{success:false, statusCode, message, code, errors, correlationId}` API envelope across ~35 modules; separated liveness/readiness health checks with per-dependency timeouts; a transactional-outbox pattern for reliable event delivery.

**Scores:** Backend Architecture **7.5/10** · Database **7.0/10** · API Design **8.0/10**

> Migration discipline, webhook idempotency, refresh-token reuse detection, and a uniform API envelope are things many production systems get wrong — FORGE gets them right. The one item that must be patched immediately is the DM Socket.IO membership gap; the two structural risks worth planning around are the growing single-file `EventsGateway` and the parallel/legacy ffmpeg transcode pipeline.

---

### 5.3 Web + Admin (Next.js)

**Method:** Route trees mapped for `apps/web/src/app` (~95 routes) and `apps/admin/src/app` (22 routes); ~20 files read in full including homepage, watch page, upload flow, studio dashboard, admin user-detail + content-moderation pages, shared `Button`/`Input`/`Dialog`/`DataTable`/`EmptyState`, root layouts, `FeedGrid`/`FeedCard`.

#### Strengths
- List virtualization is real: `FeedGrid.tsx` uses `@tanstack/react-virtual`'s `useWindowVirtualizer`, `overscan`, a hard page cache cap, `IntersectionObserver` pagination, and HLS manifest preloading for upcoming cards.
- `next/image` used correctly on the main content surface (`FeedCard.tsx`) with `fill`, responsive `sizes()`, real `alt` text.
- Design-system accessibility is above average: `Dialog` has a real focus trap; `Input` wires `aria-invalid`/`aria-describedby`; `DataTable` has roving-tabindex row navigation.
- Root layout has a real skip-link to `#main-content`.
- Zero hardcoded hex colors found in `apps/web/src/components/**` — all styling routes through design tokens.
- Admin correctly de-indexes itself (`robots: {index:false, follow:false}`).
- Business logic well separated into `apps/web/src/lib` (36 files) rather than embedded in components, matching the project's own frontend rule.

#### Critical
1. **No `sitemap.xml` or `robots.txt` anywhere in the repo.** Confirmed via repo-wide glob — zero matches. Search engines cannot efficiently discover deep pages (watch pages, creator profiles, skill pages) or receive crawl directives. **Fix:** add `apps/web/src/app/sitemap.ts` (dynamic, paginated via the videos/categories API) and `robots.ts` disallowing `/studio`, `/upload`, `/settings`, `/messages`, auth routes. Effort: 0.5-1 day. **Impact: High — directly affects organic discovery of the platform's core content inventory.**
2. **No structured data (JSON-LD) on any public page.** `generateMetadata` on the watch page already fetches the video object needed but populates only OG/Twitter tags — no `VideoObject`/`Person`/`BreadcrumbList` schema anywhere (repo-wide grep for `application/ld+json`: zero matches). **Fix:** add `VideoObject` JSON-LD to the watch page and `Person`/`ProfilePage` schema to profile pages. Effort: 1-2 days. **Impact: High for organic video discovery and SERP CTR.**
3. **Homepage is a single monolithic Client Component.** `apps/web/src/components/home/HomePageContent.tsx` ships hero, live rail, continue-watching, trending skills, and feed all as client JS, even though most sub-sections don't need interactivity. Directly conflicts with the project's own "Server Components where they reduce client JS" rule, and this is the highest-traffic route in the app. **Fix:** keep the page server-rendered, extract only the tab-toggle into a small client island. Effort: 2-3 days. **Impact: High — reduces homepage JS payload, improves LCP/TTI.**

#### High
4. `metadataBase` not set in root layout — Next.js falls back to `localhost:3000` for any relative OG/Twitter image resolution in production, silently breaking social-card previews. Effort: <1 hour.
5. Forced dark mode (`className="dark"` hardcoded) with no theme toggle or `prefers-color-scheme` respect on either app — may be a deliberate brand decision, but as shipped is indistinguishable from an unfinished light theme.
6. No automated accessibility verification (axe-core/Lighthouse) exists in CI — component-level patterns are good, but rendered contrast and screen-reader tree correctness are unverified and unenforced against regression.
7. Admin avatar uses raw `<img>` with an explicit eslint-disable bypassing the `next/image` requirement — low impact alone, but a precedent worth not repeating.
8. Bulk video moderation in admin fires N sequential PATCH requests per selected video (explicitly acknowledged in a code comment: "no dedicated bulk-moderate endpoint exists yet") — no batching, no partial-failure UI. Violates the platform's own performance mandate and its own established `.../bulk` pattern used elsewhere (users/reports/creators).

#### Medium
9. Below-the-fold homepage sections (`ContinueWatching`, `NewFromFollowing`, `TrendingSkills`) have no independent `Suspense`/lazy-loading boundaries.
10. No canonical/`alternates` handling on paginated or filterable pages (`explore`, `search`) — risk of duplicate-content signals across query-param variants.
11. Studio dashboard's attention-alert query has no `isError` handling — failures silently render nothing rather than showing a retry affordance.

#### Low
12. Deprecated `compact` prop still supported alongside `layout` in `FeedCard` — incremental migration debt.
13. Emoji fallback (🎬) for missing thumbnails slightly undercuts the "not a YouTube clone" premium-identity goal.

**Scores:** Web App **7.0/10** · Admin Panel **7.5/10** · SEO **4.0/10** · Frontend Accessibility **7.0/10**

> The gap between "well-engineered" and "production-ready for growth" is concentrated in two narrow, fixable places: SEO infrastructure that's simply absent rather than broken, and one architectural decision (fully client-rendered homepage) that undercuts the performance discipline shown everywhere else.

**Premium-UX suggestions (grounded in code read):**
- **Homepage:** beyond the server/client split, the Discover/Following tab toggle is a plain pill switcher identical to a hundred other apps — given the explicit "not a YouTube clone" mandate, consider a more editorial treatment (e.g. a persistent skill-rail, a Skillshare-style "continue your path" module).
- **Watch page:** access-gating states (private/paywalled/processing) are functionally excellent but visually terse; the generic 3-block loading skeleton doesn't match the actual two-column watch layout, increasing perceived layout shift.
- **Admin content moderation:** functionally strong but visually a plain text-link table — inline thumbnail previews would let moderators triage without opening each video.

---

### 5.4 Mobile (Flutter)

**Method:** ~18 files read in full — `main.dart`, router, network client, theme, and feature folders (feed, watch, live, upload/studio, auth, messaging) plus all 13 existing unit test files. **No Flutter SDK available in this environment — `flutter analyze`/`test`/`build` could not be run; all findings are static-only.**

#### Strengths
- Deliberate, well-documented engineering — inline comments in `api_client.dart`, `certificate_pinning.dart`, `local_cache.dart`, `live_watch_screen.dart` explain *why* a tradeoff was made, including honest disclosure of a known-incomplete fix (see High #1) rather than papering over it.
- Lifecycle-aware video players correctly pause on backgrounding and dispose controllers on hot-swap.
- Consistent controller/subscription disposal spot-checked across the three largest screens.
- Real offline-first caching: `local_cache.dart` implements a bounded, LRU-evicted Hive cache with a platform-channel-free test seam.
- `resolveRedirect()` route-guard logic is a pure, directly-tested function covering auth/onboarding/creator-tier gating in one composable place.
- Resumable, validated uploads with a genuine pause-on-backgrounding and resume-after-interruption flow.
- A release-build safety net (`assertValidForRelease()`) fails fast if a release build points at a non-HTTPS/localhost API.
- No `print()`/`debugPrint()` leftovers found; TODO/FIXME markers minimal (4) and legitimate.

#### High
1. **Live-stream socket listeners silently orphaned on background/foreground cycle** — `ForgeSocket` is a bare static singleton shared across four independently-bound widgets (chat, poll, Q&A, video). The lifecycle handler explicitly does *not* disconnect/reconnect the socket because doing so would "silently break" the other widgets' listeners (self-documented, unresolved debt). If the transport drops during backgrounding, none of the four widgets re-subscribe on foreground. **Fix:** a Riverpod-managed `ForgeSocketController` owning reconnect/backoff with a connection-state stream each panel subscribes to. Effort: 2-3 days.
2. **Certificate pinning is dormant by default in release builds** — `applyCertificatePinning` only activates with `--dart-define=CERT_PINNING_ENABLED=true`; no reference to that flag found anywhere in `.github/**` or `scripts/**`. Production builds likely ship without pinning unless a human remembers to append the flag manually. **Fix:** set the flag unconditionally in the release build script. Effort: small (config-only).
3. **No token-refresh mutex — concurrent 401s can race and force logout.** `api_client.dart`'s `onError` interceptor calls `_refreshTokens()` independently for every concurrent 401; if the backend rotates (single-use) refresh tokens, the second concurrent refresh receives an already-invalidated token, fails, and force-logs-out the user even though the first refresh succeeded — an intermittent "randomly logged out" bug that worsens under poor network conditions. **Fix:** shared in-flight `Future<bool>?` guard. Effort: small (~20 lines).
4. **No deep-link/universal-link configuration despite a full go_router route table ready for it.** Neither `AndroidManifest.xml` nor `Info.plist` has intent-filters/`CFBundleURLTypes`/associated-domains configured. `share_plus` is wired up but shared links cannot open the app. Breaks growth loops and push-notification-driven navigation. Effort: 1-2 days.
5. **Zero widget/integration test coverage across 52 screens** — all 13 existing tests are repository/service-level; no `test/widget/` or golden tests exist for the highest-traffic, most complex screens (live watch, upload, feed). Effort: 3-5 days for a baseline on the top 4 screens.

#### Medium
6. No localization/i18n scaffold — `intl` is a dependency but unused; all strings are hardcoded English across 52 screens.
7. Minimal accessibility labeling — only 4 files use `tooltip:`, only 2 files use `Semantics()` out of 49 `IconButton` call sites.
8. No tablet/wide-screen adaptive layout despite iPad being a declared supported form factor in `Info.plist`.
9. Inconsistent image caching — the watch screen's "related videos" rail uses raw `Image.network` instead of the `CachedNetworkImage` used correctly everywhere else.
10. 70+ raw `Colors.*`/`Color(0x...)` calls bypass the `ForgeTokens` design-token system, concentrated in the two most video-heavy screens.
11. App is hardcoded dark-mode-only with no light theme or system-theme following — may be intentional, needs an explicit product decision.
12. 25 files use non-virtualized `ListView(children:...)` rather than `.builder` — needs per-file triage for which back unbounded datasets.
13. Feed cards show only a static thumbnail with no inline video preview despite a Reels/TikTok-style vertical layout that visually implies autoplay — a product-identity ambiguity, not a defect.

**Score:** Mobile Application **7.0/10**

> A substantial, thoughtfully-built app with real production hardening already present (offline caching, resumable uploads, cert-pinning scaffolding, route guarding). The gap to a higher score is concentrated, not pervasive: wire cert pinning into the actual release pipeline, add a refresh-token mutex, resolve the self-acknowledged socket-reconnection gap, configure deep links (the router is already ready for it), and begin closing the widget-test coverage gap. **No real device/CI build was possible in this environment** — a real `flutter build` + install is a required follow-up before treating CRIT-01-equivalent scaffolding concerns as closed.

---

### 5.5 Security (OWASP-style)

**Method:** ~16 files read in full across auth, admin/impersonation, search, multipart upload, billing webhook, and mobile transport security, following aggressive Grep passes for injection, secrets, IDOR, and XSS patterns.

#### Critical
None found in the code paths reviewed.

#### High
1. **Cert pinning implemented but disabled by default in production builds** (same root cause as Mobile finding #2 above — cross-referenced here as a security control gap). Effort: low.
2. Password-reset (`forgotPassword`) relies only on the global rate limiter with no dedicated per-IP/per-email throttle visible in the code read — low direct security impact (the reset flow itself is otherwise sound: hashed single-use tokens, 1-hour TTL, global session revocation on reset) but a minor email-bombing/cost-abuse vector.

#### Medium
3. Stored `ipHash` uses plain `SHA-256` of the raw IP rather than an HMAC with a server secret — trivially brute-forceable if ever exposed, defeating the purpose of hashing. **Fix:** switch to `createHmac('sha256', secret)`.
4. Admin `deleteUser`/`impersonateUser` have no step-up re-authentication beyond a standing admin JWT — role-escalation-to-admin correctly requires password re-entry, but the two other highest-impact actions do not. Impersonation itself is otherwise well designed (120s single-purpose token, re-validated admin role, admin-on-admin blocked, delivered via URL fragment to avoid log leakage).
5. CSRF double-submit protection is gated on `nodeEnv === 'production'` literally — any staging/preview environment that sets cross-site cookies without also setting `NODE_ENV=production` would be unprotected. Needs verification against actual deploy config (unverifiable from source alone).

#### Low
6. Multipart-upload `contentType` is accepted from client input without a confirmed server-side MIME allowlist at the point read (ownership, part bounds, and completion integrity are all correctly validated elsewhere in the same flow).
7. Hardcoded fallback cookie domain (`.forgestudios.net`) in source — should be a required env var rather than a silent fallback.
8. No true positives found in a repo-wide secrets grep — all matches were docs/test fixtures/`.env.example` placeholders. Listed as a positive finding.

#### Strengths
Refresh-token reuse detection with full-session revocation; bcrypt cost-factor-12; hashed-at-rest refresh tokens with Redis-backed instant global logout; CSRF double-submit with `timingSafeEqual`; HttpOnly/Secure/SameSite=None cookies scoped to `/api/v1/auth`; global `helmet()` + strict `ValidationPipe({whitelist, forbidNonWhitelisted})` blocking mass-assignment platform-wide; secure-by-default global guard chain; Redis-backed distributed rate limiting (correct for multi-instance Fly deployment); a well-designed impersonation flow; production env-schema validation that fails closed on weak/default secrets and blocks `MOCK_SUBSCRIPTIONS_ENABLED=true` in prod; multipart-upload ownership + integrity checks on every state-mutating method; correctly-verified Stripe webhook signatures with idempotency tracking; fully parameterized search queries (no injection found); a genuinely well-reasoned mobile cert-pinning module (pins the issuing intermediate, documented rotation runbook) and `FlutterSecureStorage` for tokens; account-lockout service independent of the global rate limiter; disposable-email blocking at signup.

**Score:** Security **8.0/10**

> This is a notably mature auth/security implementation — refresh-token reuse detection, hashed-at-rest tokens with instant global logout, CSRF double-submit, a secure-by-default guard stack, and boot-time config validation all exceed what's typical at this project stage. No directly exploitable Critical was found in the surfaces reviewed. Residual risk is concentrated in defense-in-depth gaps (mobile cert pinning not confirmed active in production, no step-up auth on the two most consequential admin actions, weak IP-hash scheme) rather than primary control failures. **No live infrastructure was inspected** — IAM scoping, actual secret values, WAF/CDN config, and whether CI actually sets `CERT_PINNING_ENABLED=true` could not be verified from source.

---

### 5.6 DevOps, AWS & Infra

**Method:** Full reads of `fly.toml`, `fly.worker.toml`, both docker-compose files, all Dockerfiles, every `.github/workflows/*.yml`, ~9 scripts in `scripts/`, `health.controller.ts`, `instrument.ts`, `infra/observability/*`.

#### High
1. **Destructive wipe script's production guard covers only `DATABASE_URL`, not Redis or S3.** `scripts/wipe-platform-data.sh` checks `DATABASE_URL` against production-marker strings, but hard-codes `FORGE_FLUSH_CONFIRM=yes` when calling `flush-redis.sh` (bypassing that script's own independent guard), and S3-bucket emptying has **no** production-marker check at all. If `DATABASE_URL` doesn't match the string markers (e.g., a pgbouncer/IP-based connection string) while `REDIS_URL`/`S3_BUCKET_NAME` still point at production, the script proceeds to `FLUSHALL` Redis and recursively delete the entire media bucket on a single substring miss. **Fix:** independent production-marker checks for all three destructive targets, or a single `--target-env` flag validated everywhere. Effort: 1-2 hours. **Impact: closes the single largest blast-radius gap found in this audit.**
2. **S3 bucket has no versioning or lifecycle policy, while the IAM policy grants unscoped `DeleteObject`.** Combined with #1, a leaked key or buggy delete path has no recovery path — deleted creator videos are unrecoverable. **Fix:** enable S3 versioning + a lifecycle rule for noncurrent-version expiry; consider scoping `DeleteObject` by key prefix. Effort: medium. **Impact: High — closes an unrecoverable data-loss gap.**

#### Medium
3. `docker-compose.prod.yml` references `infra/nginx/nginx.conf`/`ssl`, which do not exist anywhere in the repo — this file cannot actually run as written and is stale relative to the real Fly+Vercel deployment topology; if ever used as a DR fallback it will fail immediately.
4. **BullMQ worker runs as a single non-HA machine** (`--ha=false` in the release workflow) — video transcoding kickoff, Mux ingest, and analytics processing all have zero redundancy against a host-level failure, despite `forge-backend.md` explicitly calling this pipeline "platform-critical."
5. Two independently-triggerable Fly deploy workflows have diverged safety checks — the automated `release.yml` runs a required-secrets audit before deploying with image-pinned rollback and dual-URL smoke tests; the manual `deploy-fly.yml` has neither, checking only that `FLY_API_TOKEN` exists.
6. Fly's HTTP health check gates traffic on the liveness probe only (`/health/live`, dependency-free by design), not the deeper readiness check (DB/Redis/queue, already implemented in code) — a machine with a dead DB connection keeps receiving traffic until a human notices via Sentry.
7. IAM `ListBucket` grant is misscoped (listed alongside a wildcard object-level resource, where `ListBucket` only applies at the bucket-ARN level); CloudFront has no access logging and no WAF association.

#### Low
8. Web/Admin Dockerfiles lack a `HEALTHCHECK` instruction (low impact since actual hosting is Vercel).
9. CodeQL covers `javascript-typescript` only, not the Python reporting scripts in `scripts/`.
10. No PR-time dependency-review action (post-merge `npm audit` exists, but doesn't flag newly-introduced vulnerable deps at review time).
11. Redis has no `maxmemory`/eviction policy configured in the compose files — unverifiable whether production Redis (likely a managed provider) differs.

#### Strengths
Multi-stage, non-root Docker builds across all four apps; a fail-closed secrets audit that refuses to deploy if any required Fly secret is missing; automated, image-pinned rollback on deploy failure for both API and worker with dual-URL smoke tests; path-filtered CI avoiding unrelated test runs; liveness/readiness separation in health checks with per-dependency timeouts (not yet wired into Fly's actual routing decision — see Medium #6); destructive scripts require explicit opt-in confirmation (coverage gap noted in High #1, not absence of intent); S3 blocks all public access by default and serves exclusively via CloudFront + Origin Access Control with a `SourceArn`-scoped bucket policy — no legacy OAI, no public bucket exposure; no committed secrets found anywhere in the repo; Sentry + OpenTelemetry bootstrap loaded before any app module, plus Prometheus scrape config, Grafana dashboards, and alert rules checked into `infra/observability/` with a dedicated post-deploy verification script gating the release job; temporary AWS credential files auto-delete after interactive confirmation.

**Scores:** DevOps/CI-CD **7.0/10** · AWS/Cloud Architecture **6.0/10** · Observability/Monitoring **7.0/10**

**Scaling assessment (infra-only, from configs reviewed):** At **10K users**, the current setup is comfortably adequate. At **100K users**, the single non-HA worker becomes a genuine risk, and Neon connection-pooling mode is unconfirmed from these configs. At **1M users**, the reviewed configs don't yet show the infra decisions scale usually forces: S3 versioning/lifecycle, CloudFront logging/WAF, horizontally-scaled workers, or evidence of read replicas/formal connection pooling. This doesn't mean the platform can't reach that scale — it means those decisions aren't visible in the repo yet and several load-bearing facts (managed Redis sizing, Neon pooling mode, branch-protection rules) sit outside what static review can confirm.

---

### 5.7 QA / Testing Coverage

**Method:** Full inventory via Glob across all four apps; ~18 real spec files read in full; CI workflow read end-to-end for what actually executes.

| App | Test files | Source files | Ratio | Note |
|---|---|---|---|---|
| `apps/api` | 143 (139 unit + 4 e2e) | 504 non-spec `.ts` | ~28% | Only ~6 of 44 controllers have direct spec coverage |
| `apps/web` | 6 (3 unit + 3 Playwright) | 216 | ~1.4% unit | Unit tests never run in CI (see Critical #1) |
| `apps/admin` | 3 (2 unit + 1 Playwright) | 35 | ~5.7% unit | Same CI gap |
| `apps/mobile` | 12 (all `test/unit/`) | 102 | ~11.8% | Zero widget/integration tests |

#### Critical
1. **Web and admin unit test suites exist but never execute in CI.** `ci.yml`'s web/admin jobs run only `lint`, `build`, and Playwright e2e — no `npm run test --workspace=@forge/web`/`@forge/admin` step anywhere. `LoginForm.test.tsx`, `access.test.ts`, `permissions.test.ts`, `auth-storage.test.ts` can be broken by any PR and CI stays green. **Fix:** add the missing test steps. Effort: <1 hour. **This is a process fix, not new test-writing, and closes the gap immediately.**
2. **Email verification (signup→verify→login) has zero test coverage.** Grep for `verifyEmail`/`verify-email` across all specs returns only the source files. A regression here silently blocks new-user activation with no test to catch it. Effort: 0.5-1 day.
3. **Admin moderation actions are tested only via decorator-metadata assertions, never guard-execution.** `admin.security.spec.ts` and `reports.controller.spec.ts` confirm `@Roles(ADMIN)` is present on the class but never boot the module or execute a real request through the live guard chain — no test proves a non-admin request is actually rejected, or that an admin action produces the correct side effect, on the platform's highest-blast-radius surface. **Fix:** one slim HTTP e2e spec (same pattern as the excellent `billing-webhook-http.e2e-spec.ts`) asserting 403 for non-admin JWTs and correct behavior for admin JWTs. Effort: 1 day.

#### High
4. Upload→transcode→publish has good per-stage unit coverage but no integration seam test stitching controller→service→queue→worker→publish end-to-end, unlike the equivalent (and excellent) billing pattern. Effort: 1 day.
5. Live-stream chat settings/slow-mode moderation appears untested — no corresponding service/spec found, in contrast to well-tested community-room chat.
6. The enforced coverage gate (`collectCoverageFrom`) is scoped to fewer than half the module tree (excludes communities, courses, live-broadcast, messaging, gamification, notifications, admin, search, feed, and every controller/module file everywhere) at low thresholds (20-34%) — `npm run test:cov` reports a number that materially overstates real coverage.

#### Medium
7. Mobile has zero widget/UI-layer test coverage (data/repository layer is solid).
8. No test evidence found for the admin app's core moderation/user-management screens beyond login.

#### Low
9. The only e2e test that exercises a real login round-trip is skipped unless `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` secrets are configured, and silently no-ops (rather than failing loudly) if they're ever unset.

#### Strengths
`apps/api/test/http-test.harness.ts` and its 4 e2e specs genuinely follow the project's own documented convention (slim module, mocked DataSource/Redis/queue tokens, never the full `AppModule`) — verified by direct reading, not aspirational. `billing-webhook-http.e2e-spec.ts` is the standout test in the repository, proving the real checkout→entitlement-unlock seam. CI runs API tests with no `DATABASE_URL`/`REDIS_URL` set, matching the documented rule. Mobile's `multipart_upload_test.dart` is genuinely strong (resumable-checkpoint logic, ETag-error handling). `LoginForm.test.tsx` is real behavioral coverage of several auth edge cases.

**Score:** Testing/QA **6.0/10**

> A tale of two disciplines: where the team invested (billing webhooks, video utilities, community services, mobile data layer), tests are real and behaviorally meaningful. But coverage is concentrated on what was easiest to test rather than what's riskiest, and — most consequentially — the web/admin unit suites are wired up but never invoked by CI, providing zero actual regression protection today despite existing. Closing the CI gap is a configuration fix, not new test-writing, and would be the single highest-leverage QA action available.

---

### 5.8 UI/UX, Accessibility, Product & Analytics

**Method:** Design-system source read in full (tokens, Tailwind config, `Button`/`Input`/`Dialog`/`DataTable`/`EmptyState`/`Toast`/`PaywallCard`); ~14 real screen-level components read across web/admin; 3 critical user journeys traced through actual route/component code; analytics event vocabulary and firing sites grepped across all four apps.

#### Critical
1. **Signup, login, and publish funnels are schema-ready but never actually fire tracking events.** `ANALYTICS_EVENTS` defines `auth.signup`, `auth.login`, `auth.login.new_device`, `studio.publish` as trackable, and the ingest endpoint is live — but grepping the entire `apps/web/src` tree for calls to any of them returns **zero matches**. Only `watch.*` and `search.query` are actually instrumented. Of the funnels named in this audit's brief (signup, upload, purchase, watch), only "watch" is observable. **Fix:** add `trackEvent()` calls at the existing success handlers in `SignupForm.tsx`, the login success path, and `uploadLesson`'s success path — the allowlist and call-site locations already exist. Effort: a few hours. **Impact: High — unlocks core growth/activation measurement.**
2. **Zero analytics vocabulary exists for checkout/subscribe/purchase at all.** Not a missed call site — the `ANALYTICS_EVENTS` allowlist has no `billing.*` entries whatsoever, and the membership page does a bare `window.location.href` redirect to Stripe with no tracking around it. For a membership/Patreon-style platform, having no concept of "purchase" in the analytics vocabulary means the revenue funnel cannot be measured even if someone tried to add tracking today. **Fix:** add `billing.checkout_started`/`checkout_returned`/`subscription_canceled` to the shared event schema and fire them around the Stripe redirect, reconciling actual state via the existing webhook. Effort: medium. **Impact: High — direct revenue funnel visibility.**

#### High
3. Feedback pattern (success/error) is inconsistent across otherwise-similar screens — sometimes a toast (`useToast()`, well-built with correct ARIA roles), sometimes a plain inline `<p>` that disappears on next interaction. Violates Nielsen's consistency heuristic.
4. Admin's highest-risk screen (`users/[id]/page.tsx`) hand-rolls destructive-action button styling with raw Tailwind classNames instead of the design system's `Button` component, which exists specifically to prevent this — the exact "one-off styling" anti-pattern the project's own rules warn against.
5. Top-level page loading states in admin (`reports/[id]`, `users/[id]`) render bare loading text while nested tables on the same page correctly use purpose-built skeleton components — a visible seam between "this page cares about loading states" and "this page doesn't."
6. Per the project's own feature matrix, mobile is the weakest-parity surface for nearly every monetizable feature (memberships, live VIP/breakout, gamification, courses are all ⚠️ on mobile, ✅ on web/API) — directly undermines competitive positioning against mobile-first competitors.

#### Medium
7. The most conversion-critical flow in the product (first video publish) uses raw `<input>`/`<textarea>`/`<select>` instead of the design system's `Input` component, forfeiting its built-in `aria-invalid`/`aria-describedby` wiring at exactly the point where it matters most.
8. Broad `aria-*`/`alt` attribute density across `apps/web` is low relative to app size (26 occurrences across 16 of 60+ pages) — sampled components are strong, but broad icon-button coverage is unverified and should be confirmed via an automated CI a11y gate rather than manual sampling.
9. Two design tokens (`outline`, `live`/`critical` red) sit close to the WCAG AA contrast threshold (roughly 4.6-6:1) rather than the 8:1+ the rest of the palette achieves — worth verifying against every surface tier they're actually composited on.
10. The upload wizard has a real, acknowledged data-loss edge case: navigating back a step can lose the selected video `File` object, patched with a recovery-UI message rather than fixed at the state-management layer.

#### Low
11. `Button` has no `danger`/`destructive` variant, which is the systemic cause of Finding #4.
12. Production copy directly references "YouTube Partner Program" in an approval-status message — undercuts the project's own "not a YouTube clone" identity mandate at exactly the moment a creator is deciding whether FORGE feels distinct.

#### Strengths
`Dialog` has a genuine focus trap (tab-cycle, escape-close, focus-restore); `Input` auto-wires `aria-invalid`/`aria-describedby`; `Toast` correctly splits `role="alert"` vs `role="status"`; `DataTable` has real keyboard row navigation and enforces loading/empty/error slots as required props, not optional afterthoughts; the token system is a single coherent source of truth (not scattered hex values); the upload flow is unusually mature (resumable-upload awareness, background-upload messaging, schedule-vs-immediate publish, phase-labeled progress); admin destructive actions are consistently gated through `ConfirmDialog`; the Studio home groups by job-to-be-done with an explicit rationale comment, not default dashboard sprawl; `PaywallCard` is a well-designed, genuinely reused primitive across watch/community/course surfaces.

**Scores:** UI Design **7.0/10** · UX Design **7.0/10** · Accessibility **7.0/10** · Product Completeness/Analytics **5.0/10**

**User journey walkthroughs (code-derived):**
- **Signup → verify → login:** the auto-refresh-after-verify step silently swallows failure (`catch { refresh(); }`) — a user may see "Email verified" without actually being logged in, with no explicit signal either way. Plus: the first funnel step is analytics-invisible (Critical #1).
- **Become creator → upload → publish:** a real, acknowledged file-loss edge case on back-navigation mid-wizard; the publish event never fires (Critical #1), so the platform cannot measure how many creators who start the wizard actually finish it.
- **Discover → subscribe → access gated content:** the revenue funnel has zero analytics vocabulary at all (Critical #2); `PaywallCard` itself is a genuine strength, well-designed and reused — the friction here is observability, not the UI.

**Premium-polish recommendations grounded in code:** add a `danger` Button variant and migrate admin's hand-rolled destructive buttons onto it; adopt `useToast()` universally for mutation feedback; use the existing skeleton components for all top-level page loads, not just nested tables; lighten the `live`/`critical`/`outline` tokens slightly off the AA threshold; migrate upload-wizard fields onto `Input`; give `PaywallCard` (a monetization touchpoint) the same entrance-motion treatment already used elsewhere in the design system.

---

## 6. UI/UX Review

See §5.3 (Web/Admin UI findings) and §5.8 (UI/UX/Accessibility/Product) in full above. Summary: the design system itself is genuinely well-built (real focus traps, correct ARIA wiring, virtualized feeds), but adoption is inconsistent in the highest-stakes screens (admin destructive actions, the upload wizard) where hand-rolled styling and native form elements bypass the accessible primitives already available. No live screenshots were possible in this environment — every finding is grounded in reading the actual component/screen source.

## 7. Security Review

See §5.5 in full above. **Score: 8/10.** No Critical vulnerability found; the one Critical authorization gap in this entire audit (DM Socket.IO room membership) is filed under Backend (§5.2) because it is a backend authorization defect, not a security-layer omission — the REST layer enforces the correct check, only the socket join path skips it.

## 8. Performance Review

Cross-domain performance findings, synthesized:
- **Backend:** sequential per-row subscription-expiry reconciliation (up to 500 sequential round trips/run); sequential (non-parallel) S3 segment uploads in the legacy ffmpeg transcode path; RBAC/permission guards evaluated before rate limiting on every request.
- **Web:** homepage ships as a fully client-rendered bundle on the highest-traffic route; admin issues N sequential PATCH requests for bulk moderation instead of using the batch-endpoint pattern already established elsewhere in the same app.
- **Mobile:** 25 files use non-virtualized `ListView(children:...)`; one screen (watch page's related-videos rail) bypasses the app's own image-caching library.
- **Database:** cursor-based, cache-aware feed pagination with cache-stampede protection is a genuine strength; query-plan/index verification was not possible without live DB access (flagged, not assumed passing).
- **Infra:** a single non-HA worker machine is the platform's primary scalability risk today — it is a SPOF for the entire async video/analytics pipeline, not just a performance tail-latency concern.

## 9. Scalability Review

The architecture (Fly API + Fly worker + managed Postgres/Redis + S3/CDN + Mux) is fundamentally sound and appropriate for a modular-monolith-with-async-workers pattern. At current scale (implied low-to-mid thousands of active users based on the feature set), nothing in this audit indicates an immediate scaling emergency. The concrete risks that will surface first, in order, are: (1) the single non-HA worker process as the async pipeline's SPOF, (2) the two largest god-objects (`CommunitiesService`, `EntitlementsService`) becoming harder to safely extend as more real-time/community features are added, (3) unconfirmed Neon connection-pooling mode and Redis memory/eviction policy at higher concurrency, and (4) the dual ffmpeg/Mux transcode pipeline's sequential upload path under upload-volume growth. None of these require an architecture rewrite — each has a bounded, independently schedulable fix (see §11).

## 10. Production Readiness Assessment

| Gate | Status |
|---|---|
| AuthN/AuthZ correctness | **Pass** — mature, no Critical found |
| Payment/webhook correctness | **Pass** — best-tested code path in the repo |
| Data-loss protection (backups/versioning) | **Fail** — no S3 versioning despite broad delete grant; wipe-script guard gap |
| Test-gate reliability (does CI actually catch regressions?) | **Fail** — web/admin unit tests don't run in CI |
| Authorization completeness (REST vs. realtime parity) | **Fail** — one confirmed gap (DM sockets), otherwise strong |
| Observability | **Pass** — Sentry/OTel/Prometheus/Grafana all wired and verified in the deploy gate |
| Rollback capability | **Pass** — image-pinned automated rollback on both API and worker |
| High availability | **Fail** — worker is a single non-HA machine |
| SEO/discoverability | **Fail** — sitemap, robots, and structured data are all entirely absent |
| Growth/revenue measurability | **Fail** — signup/login/publish funnels unfired; purchase funnel has no vocabulary at all |
| Mobile release readiness | **Conditional** — strong engineering, but cert pinning dormant, deep links unconfigured, zero widget tests, and no real device build was verifiable in this environment |

**Overall: conditionally production-ready.** The platform is safe to operate at current scale with the one Critical backend fix applied immediately. It is **not** yet ready for a significant growth push until the data-loss, CI-test-execution, and analytics-instrumentation gaps are closed — none of which are large engineering efforts, but all of which are currently silent (nothing is failing loudly; the gaps are absences, not errors).

---

## 11. Prioritized Action Plan

### Critical — fix before any further scale-up or growth push

| # | Finding | Domain | File(s) | Effort |
|---|---|---|---|---|
| 1 | DM Socket.IO room join has no membership check — any authenticated user can join and read any conversation's live message stream | Backend/Security | `apps/api/src/gateway/events.gateway.ts` | 2-4 hrs |
| 2 | No `sitemap.xml`/`robots.txt` anywhere — public content pages undiscoverable by search | Web/SEO | `apps/web/src/app/{sitemap,robots}.ts` (missing) | 0.5-1 day |
| 3 | No structured data (JSON-LD) on any public page | Web/SEO | `apps/web/src/app/watch/[id]/page.tsx`, `[username]/page.tsx` | 1-2 days |
| 4 | Homepage is a fully client-rendered monolith on the highest-traffic route | Web/Performance | `apps/web/src/components/home/HomePageContent.tsx` | 2-3 days |
| 5 | Web/admin unit tests exist but never execute in CI — zero regression protection despite existing | QA/Process | `.github/workflows/ci.yml` | <1 hour |
| 6 | Email verification (signup→verify→login) has zero test coverage | QA | `apps/api/src/modules/auth/*` | 0.5-1 day |
| 7 | Admin moderation actions tested only via decorator metadata, never guard execution | QA | `apps/api/src/modules/admin/*` | 1 day |
| 8 | Signup/login/publish analytics events defined but never fired | Product/Analytics | `apps/web/src/lib/analytics.ts` + call sites | Few hours |
| 9 | No analytics vocabulary exists for checkout/subscribe at all — revenue funnel is completely dark | Product/Analytics | `packages/shared-types/src/analytics.ts` | Medium |

### High priority — next 30 days

- Split `CommunitiesService`/`EntitlementsService` god-objects along existing sibling seams; begin untangling the 65 `forwardRef` circular dependencies (Architecture).
- Confirm Mux is the sole production transcode path and retire/gate the sequential-upload ffmpeg fallback (Backend).
- Move `ThrottlerGuard` earlier in the global guard chain (Backend).
- Split `EventsGateway` by domain (Backend — larger, schedule as a planned refactor).
- Set `metadataBase` in root layout; add a CI-enforced axe-core accessibility gate; replace admin's sequential bulk-PATCH with a real bulk endpoint (Web).
- Wire `CERT_PINNING_ENABLED=true` into the actual mobile release build pipeline; add a token-refresh mutex; resolve the live-stream socket-reconnection gap; configure Android App Links / iOS Universal Links (Mobile).
- Add step-up re-authentication for admin impersonation and account deletion; switch `ipHash` to HMAC (Security).
- Fix the wipe-script's production guard to cover Redis and S3, not just the database string match; enable S3 versioning + a lifecycle policy given the broad `DeleteObject` grant; run the BullMQ worker with `--ha` redundancy; unify the two divergent Fly deploy workflows (DevOps).
- Add an upload→publish integration seam test mirroring the existing billing-webhook pattern; expand the coverage-gate's module scope (QA).
- Standardize feedback UX on `useToast()`; migrate admin's hand-rolled destructive buttons onto a `Button` `danger` variant; prioritize closing mobile feature-parity gaps for monetizable features (UI/UX/Product).

### Medium priority — optimizations and maintainability

Cross-app duplication of `csrf.ts`/`auth-storage.ts`/`sentry-init-options.ts` into a shared package; consolidate fragmented upload-lib files; add localization scaffolding and tablet-adaptive layout on mobile; add `Suspense` boundaries to below-the-fold homepage sections; fix `docker-compose.prod.yml`'s stale nginx reference or mark it reference-only; wire Fly's readiness check into actual traffic routing, not just liveness. Full itemized list with file paths is in each domain's §5 subsection.

### Low priority — polish

Console-log cleanup in bootstrap scripts; router file-splitting on mobile as the screen count grows; deprecated `FeedCard` prop cleanup; copy edit removing the "YouTube Partner Program" reference; CodeQL coverage for Python scripts; PR-time dependency-review action. Full list in each domain's §5 subsection.

---

## 12. Overall Scorecard

| Category | Score | Grade band |
|---|---|---|
| Architecture | 6.5/10 | C+ |
| Code Quality / Maintainability | 7.0/10 | B |
| Backend Architecture | 7.5/10 | B |
| Database | 7.0/10 | B |
| API Design | 8.0/10 | B+ |
| Web Application | 7.0/10 | B |
| Admin Panel | 7.5/10 | B |
| SEO | 4.0/10 | D |
| Frontend Accessibility | 7.0/10 | B |
| Mobile Application | 7.0/10 | B |
| Security | 8.0/10 | B+ |
| DevOps / CI-CD | 7.0/10 | B |
| AWS / Cloud Architecture | 6.0/10 | C+ |
| Observability / Monitoring | 7.0/10 | B |
| Testing / QA | 6.0/10 | C+ |
| UI Design | 7.0/10 | B |
| UX Design | 7.0/10 | B |
| Accessibility (product-wide) | 7.0/10 | B |
| Product Completeness / Analytics | 5.0/10 | C |
| **Overall (unweighted average)** | **6.8/10** | **C+** |

**Grade bands used:** 9.0-10 A (world-class) · 8.0-8.9 B+ (strong, minor gaps) · 7.0-7.9 B (solid, several fixable gaps) · 6.0-6.9 C+ (adequate, meaningful gaps) · 5.0-5.9 C (functional but under-invested) · below 5.0 D (not production-ready in this specific area).

**Overall grade: C+ — Adequate-to-Strong.** The core of the platform (auth, payments, real-time, migrations) scores in the B/B+ range consistently across independent reviewers. The average is pulled down by two categories that are genuinely weak rather than borderline: **SEO (4/10)**, which is a fixable absence rather than a broken implementation, and **Product Completeness/Analytics (5/10)**, where the single largest finding in this entire audit lives — a platform that cannot currently measure its own growth or revenue funnels.

---

## 13. Final Recommendations

Three things matter more than everything else in this report, in this order:

**First, patch the DM Socket.IO authorization gap this week.** It is the only live, confirmed data-exposure risk found across all eight domains, it has a two-to-four-hour fix, and the correct pattern to copy already exists three functions away in the same file.

**Second, treat the analytics and CI-test gaps as a single "close the loop" sprint, not two separate backlogs.** Both are process/wiring fixes rather than new engineering: the web/admin test suites already exist and just need a CI step; the signup/login/publish events already exist in the schema and just need the `trackEvent()` calls added at already-identified success handlers; the checkout funnel needs a small schema addition plus instrumentation around an existing redirect. None of this requires new features — it requires connecting things that were already built.

**Third, schedule the god-object decomposition (`CommunitiesService`, `EntitlementsService`, `EventsGateway`) as planned architectural work before the next major feature push into communities or real-time, not as an emergency.** These files are not causing incidents today, but every dependency the platform's own stated roadmap calls for — more modular feed ranking, more real-time surfaces, deeper community features — will get measurably harder to build safely the longer these three files keep absorbing new responsibilities.

Everything else in this report — SEO infrastructure, mobile deep links, the S3 versioning gap, the single non-HA worker, the dozens of Medium/Low findings — is real, worth fixing, and itemized with file paths in §5 and §11, but none of it is blocking. FORGE's foundation is meaningfully more solid than its scorecard's single average number suggests; the gaps that exist are concentrated, identified, and each has a bounded fix.
