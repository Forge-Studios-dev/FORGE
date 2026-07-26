# FORGE — Fresh Architecture & Code Quality Audit

**Date:** 2026-07-26
**Scope:** Architecture and code quality only (security, UI/UX polish, and test coverage are covered by parallel audits and are out of scope here except where they intersect directly with architecture).
**Auditor:** Senior Software Architect pass, from-scratch (no reliance on prior audit docs).

## Method

This was a code-first pass, not a doc review. Concretely:

- Enumerated module structure via `find` across `apps/api/src/modules`, `apps/web/src`, `apps/admin/src`, `apps/mobile/lib`.
- Ranked files by `wc -l` to find god-objects/god-files, then opened the top candidates (`communities.service.ts`, `entitlements.service.ts`, `videos.service.ts`, `streaming.service.ts`, `events.gateway.ts`, `admin.service.ts`) and read constructors, method lists, and representative method bodies.
- Used `codegraph_explore` to pull verbatim module-graph source (`*.module.ts` files) and blast-radius/caller data for `CommunitiesModule`, `EntitlementsModule`, `BillingModule`, `StreamChatModule` to confirm circular-dependency claims from real `forwardRef()` call sites rather than inference.
- Grepped cross-cutting signals: `forwardRef` (68 hits / 26 files), `TODO|FIXME|HACK` (0 in api/web/admin, 1 in mobile), `@deprecated` (13 files), `console.*` in API (9), `eslint-disable` (9 total), unbounded `.find({...})` repository calls, and duplication between `apps/web/src/lib` and `apps/admin/src/lib`.
- Spot-checked ~22 files directly with `Read`/`grep -n -A` across api modules, web `lib`/`components`, admin `lib`, and mobile `core`/`features`.
- Confirmed no dead-code tooling (`knip`/`ts-prune`/`depcheck`) is wired into any `package.json`.

Every finding below cites a real path opened during this session. Line numbers are given where they were captured directly; some are approximate ranges from `grep -n` output rather than a single line.

---

## Critical Findings

### C1. `CommunitiesService` is a 2,035-line god object with ~20 injected dependencies

- **File(s):** `apps/api/src/modules/communities/communities.service.ts` (2,035 lines, lines 78–2035 constructor+body)
- **Severity:** Critical
- **Current implementation:** The constructor (lines 78–114) injects **7 TypeORM repositories** (`Community`, `CommunityCategory`, `Channel`, `ChannelMember`, `CommunityMember`, `ChannelMessage`, `CommunityRole`, `Stream`, `CommunityRoom`), **8 services** (`EntitlementsService`, `AccessSessionsService`, `CommunityModerationService`, `AiModerationService`, `AiCommunityService`, `CommunityModerationQueueService`, `ChannelMigrationService`, `CommunityRoomMessagesService`, `FeatureFlagsService`), plus `EventEmitter2`, `Redis`, and `DataSource` directly. It exposes 57 public/private async methods spanning: community CRUD, legacy **deprecated** channel CRUD (`createChannel`, `updateChannel`, `deleteChannel`, `reorderChannels`, `sendChannelMessage`, `deleteChannelMessage` — all guarded by `CHANNELS_DEPRECATED_FLAG`), category CRUD, permission/access assertion logic (`canViewCommunity`, `assertCommunityAccess`, `canModerateCommunity`, `canCoachCommunity`), community search/discovery, **creator business analytics** (`getCreatorBusinessAnalytics`, `getCreatorAttention`, `getCreatorBusinessAnalyticsCsv`, `getSubscriberCohortRetention`, `getCommunityRetentionMetrics` — lines 1342–1779), an "ecosystem tree" builder, badge config, and ownership transfer.
- **Problem:** This single class mixes at least six distinct bounded contexts (community/channel CRUD, access control, legacy-channel migration shim, creator analytics/CSV export, badge/gamification config, ownership transfer) that have nothing to do with each other beyond sharing the `Community` entity. It is the textbook Single Responsibility Principle violation and the largest hand-written service file in the codebase.
- **Why it matters:** Every change to any of these six concerns — e.g. a CSV export tweak or a permission-matrix change — requires re-reading and re-testing a 2,000-line file, increases merge-conflict surface for the whole communities team, and makes the class nearly impossible to unit test in isolation (its `.spec.ts` companion is 487 lines and still cannot exercise it without mocking ~20 collaborators). It is also why `forwardRef()` proliferates around this module (see C2) — a service this central to the graph forces cyclic imports on anything that needs even one of its many capabilities.
- **Recommended solution:** Split along the boundaries that already exist elsewhere in the module (the module already has `CommunityPostsService`, `CommunityRoomsService`, `CommunityMembersService`, etc. — this pattern just wasn't applied to `CommunitiesService` itself). Extract: `CommunityAnalyticsService` (lines ~1243–1779, all analytics/CSV/retention/ecosystem-tree methods), `ChannelLegacyService` (the deprecated channel CRUD, already flagged via `CHANNELS_DEPRECATED_FLAG`/`CHANNELS_MIGRATION_HINT` in `community-deprecation.constants.ts` — a strong signal this code is mid-migration and should be isolated, not left in the core service), and `CommunityAccessService` (the `can*`/`assert*` predicate methods, which are cross-cutting and used by guards). Leave `CommunitiesService` as thin CRUD + orchestration.
- **Best-practice reference:** Single Responsibility Principle (Martin, *Clean Architecture*); NestJS docs recommend one service per cohesive responsibility, not one per entity.
- **Estimated effort:** High (3–5 days) — requires careful extraction with full regression on `communities.service.spec.ts` and dependent controllers/guards.
- **Expected impact:** Smaller, independently testable services; breaks part of the forwardRef cycle in C2; reduces blast radius of communities changes.

### C2. Tangled module graph forces circular dependencies (`forwardRef`) across 26 files, including a genuine two-module cycle

- **File(s):** `apps/api/src/modules/billing/billing.module.ts:75`, `apps/api/src/modules/entitlements/entitlements.module.ts:27-29`, `apps/api/src/modules/communities/communities.module.ts:119,121`, `apps/api/src/modules/stream-chat/stream-chat.module.ts:25`, plus 22 more files (`grep -rln forwardRef apps/api/src`, 68 total occurrences).
- **Severity:** Critical
- **Current implementation:** Verified via `codegraph_explore` verbatim source:
  - `BillingModule` imports `forwardRef(() => EntitlementsModule)` (billing.module.ts:75).
  - `EntitlementsModule` imports `forwardRef(() => BillingModule)` (entitlements.module.ts:29) — **a direct two-module cycle**, plus `forwardRef(() => EngagementModule)` and `forwardRef(() => UsersModule)` in the same `imports` array.
  - `CommunitiesModule` imports `forwardRef(() => EntitlementsModule)` and `forwardRef(() => NotificationsModule)` (communities.module.ts:119,121).
  - `StreamChatModule` imports `EntitlementsModule` directly *and* `forwardRef(() => BillingModule)` (stream-chat.module.ts:23,25) — inconsistent (why does one edge need `forwardRef` and the sibling import doesn't, from the same module?).
  - The `communities` module alone accounts for 12 of the 26 files using `forwardRef` (service-level and listener-level, not just module-level), meaning individual services reach for `forwardRef(() => X)` on constructor params too.
- **Problem:** `forwardRef` is NestJS's escape hatch for a dependency graph that shouldn't be circular in the first place. Having it needed in 26 files — including a direct `Billing ⇄ Entitlements` cycle — means the module boundaries don't reflect a real layered architecture (e.g., "billing is below entitlements" is violated by entitlements also depending back on billing for tier-Stripe sync).
- **Why it matters:** Circular module dependencies (a) make NestJS's DI container do extra work resolving providers lazily, occasionally producing hard-to-diagnose "provider not yet available" bugs at boot; (b) signal that responsibilities are misplaced — e.g., `EntitlementsService` directly imports `StripeTierSyncService` from billing (`entitlements.service.ts:31`) while `BillingModule` needs `EntitlementsModule` back for entitlement checks during checkout, meaning the two are really one bounded context split incorrectly; (c) make it very easy to introduce a *third* module into the cycle without anyone noticing, since `forwardRef` masks the smell instead of failing loudly.
- **Recommended solution:** Extract the shared surface each cyclic pair actually needs into a narrow interface/module. For Billing⇄Entitlements specifically: the entitlements side needs `StripeTierSyncService` (a leaf service, no back-reference to entitlements) — move `StripeTierSyncService` into its own module or into `EntitlementsModule` itself so `EntitlementsModule` no longer needs to import `BillingModule` at all; `BillingModule` can keep importing `EntitlementsModule` one-way. For Communities⇄Notifications, emit domain events (`EventEmitter2`, already used elsewhere in `communities.service.ts:107`) instead of a direct service call so Communities doesn't need to import Notifications synchronously.
- **Best-practice reference:** NestJS circular-dependency docs explicitly call `forwardRef` a workaround, not a pattern — "try to avoid circular dependencies where possible."
- **Estimated effort:** High (1 week+) — touches module boundaries across 5+ modules; needs staged rollout with full API test suite green at each step.
- **Expected impact:** Faster, more predictable Nest bootstrap; removes a class of DI-ordering bugs; makes the module graph legible again (currently it cannot be reasoned about without a tool like codegraph).

---

## High Findings

### H1. `EntitlementsService` is a second god object (1,482 lines, ~55 methods) mixing tier CRUD, access-control, Stripe sync, and analytics

- **File(s):** `apps/api/src/modules/entitlements/entitlements.service.ts`
- **Severity:** High
- **Current implementation:** One service owns: subscription tier CRUD + Stripe product/price sync (`createTier`, `syncTierToStripe` at line 282), the actual access-control decision engine (`checkAccess`, `checkAccessMany`, `checkChannelAccess`, `checkChannelAccessMany`, `verifyMediaTierEntitlements` — lines 499–1010, the highest-stakes code in the file since it gates paid content), subscription lifecycle/webhook reconciliation (`markSubscriptionFailedPayment`, `markSubscriptionRefunded`, `updateSubscriptionStatusByExternalRef`), and creator-facing analytics/CSV export (`exportSubscribersCsv`, `getSubscriberAnalytics` — lines 1370–1424).
- **Problem:** Same SRP violation pattern as C1. The access-control "hot path" (called on nearly every content view) is bundled in the same class and same file as admin/creator reporting code that runs rarely and does heavy aggregation — different performance profiles, different callers, different failure-tolerance requirements, but one class.
- **Why it matters:** The access-check path is the most performance- and correctness-sensitive code in the platform (gates paid content); burying it in a 1,482-line file with unrelated CSV-export logic makes it harder to isolate for the kind of scrutiny/caching work it deserves (there is already a caching layer here — `bustSubscriptionCache`, `readCachedAccess`, `writeCachedAccess` at lines 166–223 — increasing the cost of reasoning about a 1,500-line file for cache-correctness review).
- **Recommended solution:** Extract `EntitlementsAccessService` (the `checkAccess*`/`verify*` decision engine + its cache helpers) as its own injectable, keep `EntitlementsService` for tier/subscription CRUD, and move `exportSubscribersCsv`/`getSubscriberAnalytics` into a `SubscriberAnalyticsService` alongside the similar analytics extraction recommended in C1.
- **Best-practice reference:** Command-Query Separation + SRP; hot-path/cold-path code should not share a class when the hot path has a caching contract to maintain.
- **Estimated effort:** Medium-High (2–3 days).
- **Expected impact:** Easier to unit-test and reason about the access-control cache invalidation logic in isolation; reduces risk of a CSV-export change accidentally touching the paid-content gate.

### H2. Duplicated, drifting HTTP-client/auth/CSRF infrastructure between `apps/web` and `apps/admin`

- **File(s):** `apps/web/src/lib/{api.ts,auth-storage.ts,csrf.ts,app-check.ts,sentry-init-options.ts}` vs. `apps/admin/src/lib/{api.ts,auth-storage.ts,csrf.ts,app-check.ts,sentry-init-options.ts}`
- **Severity:** High
- **Current implementation:** Diffed directly:
  - `csrf.ts` — 16 lines in both, differ by exactly one comment word ("(F-802)").
  - `sentry-init-options.ts` — differ by 4 lines (web has an extra `sentryEnabled()` export admin lacks).
  - `api.ts` — both build an axios instance with a request interceptor that attaches a bearer token from `auth-storage`, but web additionally wires Firebase App Check headers for specific routes (`APP_CHECK_ROUTES`) while admin's interceptor is synchronous and doesn't. Different `API_URL` resolution strategy too (web reads `process.env` inline; admin goes through a typed `@/env` module).
  - Five files, same names, same job, hand-copied.
- **Problem:** There is no shared package for cross-cutting frontend infra (`packages/shared-types` only has type/utility exports, `packages/design-system` is UI-only). Both Next.js apps hand-roll their own copy of auth-token storage, CSRF handling, Sentry init, and the API client.
- **Why it matters:** These files have already drifted (App Check wiring exists in web but not admin — is that intentional or a gap?). Every future bugfix (e.g., a token-refresh race condition fix in `auth-storage.ts`) must be applied twice and will silently skip the app the engineer forgot about. This is exactly the kind of duplication `packages/shared-types` and `packages/design-system` exist to prevent, but the pattern wasn't extended to HTTP/auth plumbing.
- **Recommended solution:** Create `packages/api-client` (or extend `shared-types`) exporting a configurable axios factory (base URL, token accessor, and an optional App-Check-routes list as parameters), a shared CSRF helper, and shared Sentry init options with an app-specific override point. Both apps consume it with app-specific config instead of maintaining parallel copies.
- **Best-practice reference:** DRY; monorepo package-extraction pattern already proven in this repo by `packages/design-system`.
- **Estimated effort:** Medium (1–2 days).
- **Expected impact:** One place to fix auth/CSRF/Sentry bugs; removes silent drift risk between web and admin security-adjacent code.

### H3. No dead-code/unused-export tooling wired into CI despite a ~1,800-file API surface

- **File(s):** `package.json:19`, `apps/api/package.json:10`, `apps/web/package.json:9` (lint scripts checked; no `knip`, `ts-prune`, or `depcheck` present in any workspace)
- **Severity:** High
- **Current implementation:** `lint` scripts run ESLint (`eslint "{src,apps,libs,test}/**/*.ts" --fix` for API, `next lint` for web) but nothing checks for unused exports, unreachable code, or orphaned modules across the monorepo.
- **Problem:** At this scale (49,630 total lines just counted across non-spec `.ts` files in `apps/api/src`), exports that stop being referenced (e.g., after the C1/H1 refactors, or after the channel-deprecation migration referenced by `CHANNELS_DEPRECATED_FLAG` completes) will not be flagged and will accumulate silently.
- **Why it matters:** Combined with the ongoing "deprecated channel API" migration visible in `community-deprecation.constants.ts` and the 13 files carrying `@deprecated` markers, this codebase already has a live example of migration debt that needs a mechanism to detect when the old path is finally dead and removable. Without tooling, "deprecated" code tends to become permanent.
- **Recommended solution:** Add `knip` (monorepo-aware) as a scheduled/optional CI job (per `forge-testing.md`'s guidance to keep such checks out of default PR-blocking CI) reporting unused exports/files, run manually before major cleanup passes.
- **Best-practice reference:** Standard monorepo hygiene tooling (knip, ts-prune) recommended for TypeScript workspaces of this size.
- **Estimated effort:** Low (half a day to wire up, non-blocking).
- **Expected impact:** Visibility into dead code; supports safe removal of the deprecated channel-API path once migration completes.

### H4. `CommunitiesService`'s legacy "channel" API is deprecated but still fully implemented and load-bearing inside the god object

- **File(s):** `apps/api/src/modules/communities/communities.service.ts` (methods `createChannel` L416, `updateChannel` L448, `deleteChannel` L460, `reorderChannels` L467, `sendChannelMessage` L613, `deleteChannelMessage` L712), `apps/api/src/modules/communities/community-deprecation.constants.ts`, `apps/api/src/common/decorators/deprecated-channel-api.decorator.ts`, `apps/api/src/common/interceptors/deprecated-channel-api.interceptor.ts`
- **Severity:** High
- **Current implementation:** A `DeprecatedChannelApiInterceptor` and `@deprecated` decorator exist specifically to flag the legacy channel API, and `CHANNELS_DEPRECATED_FLAG`/`CHANNELS_MIGRATION_HINT` constants gate behavior — yet the deprecated methods remain first-class citizens inside the 2,035-line core service rather than isolated behind the module boundary the deprecation infrastructure implies.
- **Problem:** Deprecation is being tracked (good — there's a decorator and interceptor for it) but not architecturally isolated. Anyone editing `CommunitiesService` for unrelated reasons must still scroll past and understand the legacy channel CRUD.
- **Why it matters:** This is a completeness gap in an otherwise good practice — the team clearly intends to remove this code path (the naming and interceptor make that obvious) but the current structure doesn't make it easy to delete cleanly when the time comes; it's entangled with live methods via shared private helpers (`getChannelWithCommunity` L1088, `getOwnedChannel` L1097).
- **Recommended solution:** Fold into the C1 extraction — pull all `*Channel*` methods into a dedicated `LegacyChannelService` that can be deleted as one unit (one file, one module registration) once the migration hint's target date passes.
- **Estimated effort:** Folded into C1's effort estimate.
- **Expected impact:** Clean, single-commit removal path for the legacy API when ready.

---

## Medium Findings

### M1. Controllers carry substantial size, suggesting some business logic lives outside services

- **File(s):** `apps/api/src/modules/streaming/streaming.controller.ts` (497 lines), `apps/api/src/modules/admin/admin.controller.ts` (464 lines), `apps/api/src/modules/content/videos.controller.ts` (444 lines), `apps/api/src/modules/communities/communities.controller.ts` (393 lines)
- **Severity:** Medium
- **Current implementation:** These are the four largest controller files in the API, each in the same size range as a mid-size service.
- **Problem:** Not confirmed as fat-controller anti-pattern for all four (large controllers can legitimately just have many thin endpoints — `streaming` and `admin` both expose broad surfaces), but the size warrants a targeted check the parent team should do: verify these controllers still delegate all logic to services and are large purely from endpoint *count*, not inline logic. This audit spot-checked `events.gateway.ts` (772 lines, 21 `@SubscribeMessage` handlers, 12 injected services) and confirmed it correctly delegates to services per `forge-backend.md`'s "do not put heavy logic in gateway handlers" rule — the same check should be applied to these four controllers.
- **Why it matters:** If any of these do contain inline business logic, it duplicates the service layer's responsibility and makes the logic untestable without spinning up HTTP.
- **Recommended solution:** Quick audit pass on each of the four files for inline `try/catch` + multi-step logic vs. pure delegate-and-map-DTO patterns.
- **Estimated effort:** Low (audit only, ~2 hours); fixes if found would be Medium.
- **Expected impact:** Confirms or clears a suspected anti-pattern.

### M2. TypeORM repositories injected directly into fat services — no repository-pattern abstraction layer

- **File(s):** Pervasive — e.g. `communities.service.ts:78-95` (7 raw `Repository<T>` injections), `entitlements.service.ts`, `videos.service.ts` (21 injected deps total)
- **Severity:** Medium
- **Current implementation:** Every service directly injects `Repository<Entity>` via `@InjectRepository` and calls `.find()`/`.findOne()`/query builders inline, rather than going through a dedicated repository/query-object layer that would encapsulate query construction separately from business logic.
- **Problem:** This is common and arguably idiomatic for small-to-medium NestJS services, but at the scale of `CommunitiesService` (7 repos) and `videos.service.ts` (21 total deps), inline query logic interleaved with business rules makes both harder to test (must mock raw TypeORM repository methods rather than a narrow domain-repository interface) and harder to optimize (query shape changes require touching business-logic files).
- **Why it matters:** Compounds C1/H1 — part of why those services are so large is that query-building logic (`where` clauses, joins) is inline rather than factored into named, reusable query methods.
- **Recommended solution:** For the largest services only (post C1/H1 split), introduce narrow custom repository classes (`CommunityRepository extends Repository<Community>` with named query methods) so business logic calls `this.communityRepo.findVisibleForViewer(...)` instead of building `where` clauses inline.
- **Best-practice reference:** Repository pattern (Fowler, *PoEAA*); NestJS custom repository docs.
- **Estimated effort:** Medium, best done incrementally alongside C1/H1.
- **Expected impact:** Smaller service files, reusable/testable query logic.

### M3. A few unbounded `.find()` queries without pagination on collections that can grow with platform success

- **File(s):** `apps/api/src/modules/courses/courses.service.ts:65-69` (`listForCreator`), `apps/api/src/modules/courses/courses.service.ts:615-619` (`getMyCertificates`)
- **Severity:** Medium
- **Current implementation:**
  ```ts
  async listForCreator(creatorId: string) {
    return this.courseRepository.find({
      where: { creatorId, isBundle: false },
      order: { createdAt: 'DESC' },
    });
  }
  ```
  No `take`/`skip`. (Note: an initial broader grep of 130 `.find({` call sites flagged many false positives where `take` is destructured as a bare variable, e.g. `users.service.ts:76` — `take,` — those are correctly paginated; this finding is narrowed to the two genuinely unbounded call sites confirmed by direct reading.)
- **Problem:** `listForCreator` returns every course a creator has ever published with no limit, and `getMyCertificates` returns every certificate a user has ever earned. Both are naturally bounded today (creators publish dozens of courses, not thousands) but violate the platform's own stated principle in `forge-backend.md`: "pagination on all list endpoints" and "avoid unbounded queries."
- **Why it matters:** `forge-performance.md` mandates assuming significant growth; a prolific creator or long-tenured learner years into the platform's life is exactly the scenario this rule exists for.
- **Recommended solution:** Add `take`/cursor pagination to both, matching the pattern already used correctly elsewhere in the same file (e.g. `listFeaturedCourses` at line 71 which does `Math.min(limit, 24)` + `take`).
- **Estimated effort:** Low (under an hour each).
- **Expected impact:** Removes two latent scalability risks; brings the file into full self-consistency (the pattern already exists two methods away).

### M4. Admin app has no shared `hooks/` directory equivalent visible; web's `hooks/` has only one file — hook logic likely scattered/co-located inconsistently

- **File(s):** `apps/web/src/hooks/useLiveStreamsQuery.ts` (only file in the directory), `apps/admin/src/` (no top-level `hooks/` dir found)
- **Severity:** Medium
- **Current implementation:** `find apps/web/src/hooks -maxdepth 1` returns exactly one file. React Query usage is present in 70 files across `apps/web/src`, meaning most query hooks are defined inline in component files or under `components/**` rather than in a discoverable shared location.
- **Problem:** Without a convention for where data-fetching hooks live, reuse is harder to discover — a new engineer won't know to check inside component subfolders for existing hooks before writing a duplicate one.
- **Why it matters:** `forge-frontend-ux.md` calls for "business logic in hooks/services (`apps/web/src/lib`), not in presentational components" — the intent is there, but the actual discoverability of those hooks isn't enforced by structure.
- **Recommended solution:** Establish (and lint/document) a convention: co-locate component-specific hooks next to their component, but promote any hook used by 2+ features into `apps/web/src/hooks`. Low-cost, mostly a documentation/convention fix, not a rewrite.
- **Estimated effort:** Low.
- **Expected impact:** Marginal but compounding improvement to reuse discoverability.

---

## Low Findings

### L1. Nine remaining `eslint-disable` comments and nine `console.*` calls in API source

- **File(s):** 6 files in `apps/api/src`, 3 files in `apps/web/src` (eslint-disable); 9 `console.log/error/warn` call sites in `apps/api/src` (non-spec)
- **Severity:** Low
- **Current implementation:** Small, bounded counts — not a systemic problem, but each `console.*` call in the API bypasses the structured logger the platform otherwise uses (per `forge-infra-docs.md`'s "structured logging; correlate API ↔ worker ↔ socket events").
- **Why it matters:** Structured-logging correlation (request/user IDs) is lost for these 9 call sites, creating small blind spots in observability.
- **Recommended solution:** Replace with the existing `Logger`/structured logging utility already used elsewhere in the same files.
- **Estimated effort:** Trivial (under an hour, mechanical find-replace with review).
- **Expected impact:** Small observability completeness improvement.

### L2. `apps/mobile` has exactly one TODO in the entire `lib/` tree, documenting a genuine backend gap

- **File(s):** `apps/mobile/lib/features/onboarding/data/onboarding_storage.dart:24` — `/// TODO(backend): no client-side "user preferences" endpoint exists yet`
- **Severity:** Low
- **Current implementation:** A single, well-documented TODO explaining that onboarding preferences are stored locally because no backend endpoint exists yet.
- **Why it matters:** This isn't a code-quality problem — it's a legitimate, tracked gap. Flagging it only so it's not lost: if a "user preferences" API endpoint is added elsewhere (check `apps/api/src/modules/users`), this client-side workaround should be revisited.
- **Recommended solution:** No action needed beyond tracking; not a defect.
- **Estimated effort:** N/A.
- **Expected impact:** N/A — informational.

### L3. Near-zero technical-debt comment markers platform-wide is itself worth flagging for verification

- **File(s):** N/A (repo-wide grep result)
- **Severity:** Low
- **Current implementation:** `grep -rn "TODO\|FIXME\|HACK"` returns 0 hits in `apps/api/src`, 0 in `apps/web/src`, 0 in `apps/admin/src`, and 1 in `apps/mobile/lib`.
- **Problem:** This is unusually clean for a codebase this size (49,630+ lines in API alone) and most likely reflects genuine discipline reinforced by prior audit rounds (per git log: `2cc73f6`, `2a6c124`, `b0d1af2`, `c90faaf` show an active audit/fix cadence) — but it's worth the team explicitly confirming this isn't from a lint rule silently stripping such comments, versus actual debt being tracked in an external issue tracker instead of inline.
- **Recommended solution:** No action required; noting for confidence-calibration only.
- **Estimated effort:** N/A.
- **Expected impact:** N/A — informational, supports overall score below.

---

## Architecture score: 6.5/10

The platform demonstrates real architectural maturity in several places — the events gateway correctly delegates to 12 services instead of holding logic (`events.gateway.ts`), the module system is genuinely feature-based with 31 well-named domains, deprecation of the legacy channel API is being tracked deliberately rather than silently, and technical-debt markers are near-zero. The score is held down by two concrete, load-bearing god objects (`CommunitiesService` at 2,035 lines / ~20 dependencies, `EntitlementsService` at 1,482 lines mixing hot-path access control with cold-path analytics) and a module graph that requires `forwardRef` in 26 files — including a direct two-module cycle between Billing and Entitlements — which together make the core of the API meaningfully harder to change safely than its otherwise-clean module boundaries suggest.
