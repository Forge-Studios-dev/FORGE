# FORGE — Fresh Backend, Database & API Design Audit (2026-07-26)

## Scope

Independent, from-scratch audit of `apps/api` (NestJS, TypeORM, PostgreSQL/Neon, Redis, BullMQ,
Socket.IO) covering: NestJS layering/DTO validation/exception handling, database schema/indexes/
transactions/migrations, REST API design consistency, Redis caching, BullMQ queues/retries/DLQ,
cron/scheduled jobs, Socket.IO gateway architecture, rate limiting, and backend code quality.
Security (OWASP-style) is covered by a parallel audit and is not duplicated here except where a
finding is architecturally security-adjacent (missing transaction, unbounded query, etc.). A
parallel architecture/code-quality audit (`FRESH_AUDIT_2026-07-26_ARCHITECTURE.md`) already covers
the `CommunitiesService`/`EntitlementsService` god-object and `forwardRef` cycle findings in depth;
this report cross-references rather than re-deriving them, and focuses its own weight on
database/API-design/backend-operational findings unique to this audit's mandate.

## Method

Read real code via `Read`/`Grep`/`Bash` (no `.codegraph` index present in this repo). Ran `wc -l`
across all `*.service.ts`/`*.controller.ts` to find the largest, highest-risk files; enumerated all
78 migrations for `down()` reversibility; enumerated all 72 entities for `@Index` coverage; grepped
query patterns (`createQueryBuilder`, `.find(`, `.findOne(`), pagination usage, transaction usage,
BullMQ queue registration, `@Cron`, Socket.IO gateway files, and throttling. Spot-checked ~30
representative files across auth, billing/entitlements, content/video, feed, communities, search,
gamification, engagement, reports, workers, and the Socket.IO gateway, reading full method bodies
rather than snippets wherever a finding is claimed.

---

## Findings

### HIGH

**H1 — No API versioning strategy beyond a static URL prefix**
- File(s): `apps/api/src/main.ts:71`
- Current implementation:
  ```ts
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'metrics', method: RequestMethod.ALL }] });
  ```
  No `app.enableVersioning()`, no `@Version()` decorators anywhere in `src/modules`.
- Problem: `api/v1` is a hardcoded string baked into every route, not a NestJS versioning strategy
  (URI/header/media-type). There is no mechanism to run `v1` and `v2` of a single controller side by
  side, or to deprecate one endpoint's contract without bumping the whole API.
- Why it matters: FORGE ships a Next.js web app, an admin app, and a Flutter mobile app that pin to
  API contracts independently (mobile especially — old app builds stay in the wild). Any breaking
  change today requires either a synchronized multi-client release or duplicating whole controllers
  under new names, which is exactly the kind of ad-hoc versioning NestJS's built-in versioning
  exists to prevent.
- Recommended solution: adopt `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
  and use `@Controller({ path: 'videos', version: '1' })` / `@Version('2')` on individual handlers
  going forward, so future breaking changes are additive, not replace-in-place.
- Reference: NestJS Versioning docs (`https://docs.nestjs.com/techniques/versioning`).
- Effort: Medium (mechanical once decided; low regression risk since v1 stays the default).
- Impact: Removes a real blocker to ever shipping a breaking API change safely against a live mobile
  install base.

**H2 — Self-hosted ffmpeg transcoding remains the default video pipeline unless explicitly reconfigured to Mux**
- File(s): `apps/api/src/modules/workers/video-processor/video-processor.worker.ts`,
  `apps/api/src/modules/content/videos.service.ts:260-262`
- Current implementation:
  ```ts
  private usesMuxTranscode(): boolean {
    return this.configService.get<string>('video.transcodeProvider') === 'mux';
  }
  ```
  When this returns `false` (the default unless `video.transcodeProvider=mux` is set), every upload
  is transcoded by `VideoProcessorWorker#process()`, which downloads the raw file to local disk
  (`os.tmpdir()`), runs `fluent-ffmpeg` synchronously through 4 HLS renditions (240p–1080p) inside the
  same worker process that also runs every other BullMQ consumer (`WorkersModule`), then walks the
  output directory and uploads every segment to S3 one file at a time (`uploadHlsToS3` → sequential
  `PutObjectCommand` per file, no concurrency).
- Problem: this is CPU- and disk-bound work running inline in a general-purpose worker process
  alongside analytics ingest, push dispatch, moderation, and reconciliation jobs. It does not scale
  horizontally the way a managed pipeline (Mux, already integrated as an alternative) does, ties
  transcode throughput to local disk/CPU on a single Fly machine, and a machine restart mid-job loses
  the temp directory (mitigated by BullMQ retry, but the retry re-downloads and re-transcodes the
  entire file from scratch — no resumability).
- Why it matters: this directly conflicts with the platform's own stated direction ("video pipeline:
  chunk/resumable/ABR" via async queues, `forge-core.md`) and performance mandate. As upload volume
  grows this worker becomes a noisy-neighbor CPU hog for every other queue sharing the process, and
  large 1080p transcodes risk exceeding the container's memory/CPU budget and starving unrelated jobs
  (push notifications, moderation) that share the same worker pool.
- Recommended solution: flip the default to Mux (`video.transcodeProvider=mux`) in all environments
  and keep the ffmpeg path only as an explicit emergency fallback; if ffmpeg must stay a supported
  path, isolate it into its own dedicated worker deployment/queue concurrency limit so it cannot
  starve lightweight jobs, and parallelize `uploadHlsToS3`'s per-file `PutObjectCommand` loop.
- Reference: 12-Factor "concurrency via process model"; AWS S3 `Promise.all` batched uploads.
- Effort: Low (config default flip) to Medium (isolating the worker pool / parallelizing uploads).
- Impact: Removes a scalability single point of contention and aligns with the platform's documented
  video-pipeline direction.

**H3 — `reports` table has no index on the columns its only list query filters and sorts by**
- File(s): `apps/api/src/modules/reports/entities/report.entity.ts`,
  `apps/api/src/modules/reports/reports.service.ts:61-73`
- Current implementation:
  ```ts
  // report.entity.ts — no @Index at all
  @Entity('reports')
  export class Report { ... }

  // reports.service.ts
  async listForAdmin(page = 1, limit = 20, status?: ReportStatus) {
    const qb = this.reportRepository.createQueryBuilder('r')
      .leftJoinAndSelect('r.reporter', 'reporter')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit);
    if (status) qb.andWhere('r.status = :status', { status });
    ...
  }
  ```
- Problem: the admin moderation queue's only read path is `WHERE status = :status ORDER BY
  created_at DESC LIMIT/OFFSET`, and `reports` has zero indexes beyond the implicit PK. Every page of
  the moderation dashboard (and every un-filtered "all reports" view) forces a full sequential scan +
  sort.
- Why it matters: moderation report volume scales with total platform user activity (every video,
  comment, and user is reportable), not with any bounded per-user cardinality the way most of this
  codebase's other unbounded-looking `.find()` calls are — this is the one genuinely-growing,
  admin-facing table found in this audit that lacks a supporting index for its actual query shape.
- Recommended solution: add a composite index `(status, created_at DESC)` (covers the filtered+sorted
  case) and, since `create()` checks whether a target was already reported, consider `(target_type,
  target_id)` too if duplicate-report lookups are added later.
- Reference: PostgreSQL composite-index-for-filter-and-sort pattern (leading equality column, trailing
  sort column).
- Effort: Low (one migration).
- Impact: Keeps the admin moderation queue fast as report volume grows; currently invisible in
  low-traffic staging/early-production data but will regress silently.

### MEDIUM

**M1 — Pagination is reimplemented ad hoc across modules instead of consistently using the shared utility**
- File(s): `apps/api/src/common/utils/pagination.util.ts` (the canonical `clampPage`/`clampLimit`,
  `DEFAULT_LIST_LIMIT = 20`, `MAX_LIST_LIMIT = 50`), vs. the ~190+ `@Get()` handlers across
  `src/modules/**/*.controller.ts`.
- Problem: only 5 modules (`grep -rln "clampPage\|clampLimit"`) actually import the shared pagination
  utility; the rest either hand-roll their own `page`/`limit` parsing and clamping inline, use
  cursor-based pagination with different envelope shapes (`{ data, meta: { cursor, hasMore } }` in
  feed/engagement) or, in a few spots, page-based (`{ data, pagination: { page, limit, total,
  hasMore } }` in `videos.service.ts`) with no single documented convention for which endpoints use
  which style.
- Why it matters: inconsistent pagination envelopes make client integration (web/admin/mobile) harder
  than necessary and mean the platform-wide max-page-size guard (`MAX_LIST_LIMIT = 50`) is not
  actually enforced everywhere it should be — any list endpoint that didn't adopt the shared util can
  silently accept an unbounded/very large `limit` query param.
- Recommended solution: make `clampPage`/`clampLimit` (or a shared `PaginationQueryDto` using
  class-validator `@Max(50)`) the required pattern for every list endpoint, and standardize on one
  response envelope shape (cursor-based is the right choice for feed-like infinite scroll; page-based
  for admin tables) documented once in `forge-backend.md`.
- Reference: this codebase's own existing convention, `pagination.util.ts` (comment: "F-602 — Hard
  cap: prevents unbounded DB reads / large payloads" — the intent already exists, adoption doesn't).
- Effort: Medium (mechanical per-module sweep, ~190 call sites to check, not all need changes).
- Impact: Closes silent unbounded-limit gaps and reduces client-integration inconsistency across 3
  frontends.

**M2 — Sequential per-row writes in scheduled/reconciliation jobs will not scale linearly with data growth**
- File(s): `apps/api/src/modules/entitlements/entitlements.service.ts:1449-1455`
  (`expireDueSubscriptions`), `apps/api/src/modules/engagement/engagement-reconciliation.service.ts:55-135`
- Current implementation:
  ```ts
  const due = await this.subscriptionRepository.find({ where: {...}, take: 500 });
  for (const sub of due) {
    sub.status = MemberSubscriptionStatus.EXPIRED;
    await this.subscriptionRepository.save(sub);        // 1 UPDATE per row
    await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId); // 1+ Redis round trip
    this.emitCommunityAccessChanged(...);
    this.revokeCommunityMembershipIfNeeded(sub, ...);    // may issue further queries
  }
  ```
- Problem: each subscription-expiry or reconciliation cycle processes its (currently capped) batch
  with one `await` per row, each doing its own DB write + Redis round trip + event emission, fully
  serialized. The `take: 500` cap prevents an unbounded single run today, but as the subscriber base
  grows, more 500-row batches are needed per cron tick and each one takes proportionally longer
  end-to-end (DB + Redis latency multiplied by row count, not batched).
- Why it matters: `forge-performance.md` mandates assuming significant platform growth for every
  change. A capped-but-serial loop is safe today and will quietly become the long pole in the nightly
  subscription-maintenance queue as the creator/subscriber count grows, delaying access revocation for
  churned subscribers.
- Recommended solution: convert the status flip to a single bulk `UPDATE ... WHERE id = ANY($1)`
  (already used elsewhere in the codebase, e.g. `communities.service.ts`'s raw `dataSource.query`
  patterns) and batch the Redis cache-busts with a pipeline; keep per-row side effects (event
  emission, membership revocation) only where they can't be batched.
- Reference: PostgreSQL bulk `UPDATE ... WHERE id = ANY(...)`; ioredis `.pipeline()`.
- Effort: Medium.
- Impact: Keeps subscription-maintenance and engagement-reconciliation cron cycles bounded in wall
  time as the platform scales, rather than growing linearly with subscriber/content count.

**M3 — Socket.IO gateway is a single 772-line class fielding 7+ unrelated real-time domains**
- File(s): `apps/api/src/gateway/events.gateway.ts` (772 lines; handlers for live-stream viewing,
  video watch rooms, community channels/rooms, direct-message conversations, stream chat, stream VIP
  access, stream reactions, and creator analytics subscriptions all in one `@WebSocketGateway`).
- Problem: the gateway itself does correctly delegate business logic to services (`streamingService`,
  `communitiesService`, `directMessagesService`, etc. — no heavy logic leaks into handlers, which is
  good), but the class is still the single point of coupling for every real-time feature the platform
  has. A change or regression in any one domain's connect/auth/room-join flow touches a file every
  other real-time feature also depends on, and the shared `handleConnection`/JWT-verify path (lines
  ~136-270) is a single choke point for all socket traffic.
- Why it matters: this is a lower-severity variant of the same god-object risk flagged for
  `CommunitiesService`/`EntitlementsService` in the parallel architecture audit — worth calling out
  separately here because it is the *only* Socket.IO entry point (`find src -name "*.gateway.ts"`
  returns exactly one file), so gateway-level bugs have platform-wide blast radius (live viewers, DMs,
  community chat, and stream VIP access all break together if this file regresses).
- Recommended solution: split by domain into feature-scoped gateways (or at minimum feature-scoped
  handler classes composed into one gateway) — e.g. `StreamGateway`, `CommunityGateway`,
  `DirectMessageGateway` — sharing one connection/auth middleware, following the same feature-module
  boundary the rest of the codebase already uses for HTTP.
- Effort: Medium-High (behavioral risk on live real-time paths — should be a dedicated, well-tested
  branch per `forge-testing.md`/`forge-production-stability.md`, not a quick refactor).
- Impact: Reduces blast radius of real-time regressions and makes ownership of individual real-time
  features clearer.

**M4 — Swagger/OpenAPI is fully disabled in production, leaving no machine-readable API contract for internal tooling**
- File(s): `apps/api/src/main.ts:103-117`
- Current implementation:
  ```ts
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()... .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  }
  ```
  43/44 controllers carry `@ApiTags` (good coverage of the annotations themselves), but the generated
  document is never produced or exported in production at all — not even to a private/authenticated
  path.
- Problem: there is no way to pull the true production API contract (used by 3 different client
  apps) without redeploying with `NODE_ENV` overridden. Client SDK generation, contract testing, and
  API-diffing for breaking-change detection all have to rely on the dev-mode document, which can
  silently drift from what's actually deployed if a hotfix changes a DTO without a corresponding
  non-prod verification pass.
- Recommended solution: keep the interactive Swagger UI disabled in production (reasonable, avoids
  exposing an explorable endpoint list publicly), but still generate and persist the OpenAPI JSON
  document on every prod deploy (e.g., write it to an S3/artifact path or expose it behind the
  existing admin auth guard) so client-codegen and contract-diff tooling has a real source of truth.
- Effort: Low.
- Impact: Enables API-contract diffing/codegen against what's actually running in production, closing
  a gap between documented and deployed behavior.

### LOW

**L1 — Entity `@Index` annotations don't consistently mirror indexes actually created via raw-SQL migrations**
- File(s): `apps/api/src/modules/engagement/entities/watch-history.entity.ts` (no `@Index`, but
  `IDX_watch_history_user_watched_at` / `IDX_watch_history_user_watched` exist via raw SQL in
  `1739120000000-enhancement-indexes-and-fts.ts` and `1780000000001-production-readiness-indexes.ts`).
- Problem: the entity class is the schema-as-code source of truth developers read first; when an
  index only exists via a raw-SQL migration and isn't mirrored with `@Index(...)` on the entity, a
  future refactor that regenerates or reviews entities against migrations can miss it, and
  `synchronize`-based tooling (even if only used in tests) won't reflect the real index set.
- Recommended solution: add matching `@Index` decorators on entities whose indexes were created via
  raw SQL, purely for documentation/consistency — no schema change needed since the index already
  exists.
- Effort: Low (documentation-only, no migration).
- Impact: Small, but improves schema-as-code trustworthiness for future contributors.

**L2 — `VideoProcessorWorker.uploadHlsToS3` uploads every HLS segment to S3 sequentially**
- File(s): `apps/api/src/modules/workers/video-processor/video-processor.worker.ts:325-354`
- Current implementation: `walkDir` recurses the local HLS output directory and does
  `await uploadFile(...)` one file at a time for every rendition segment (4 renditions × many `.ts`
  segments each, for a several-minute video this can be dozens of sequential S3 `PutObjectCommand`
  round trips).
- Problem: purely serial network I/O with no concurrency, when the ffmpeg fallback path is already
  the highest-latency step in the upload pipeline (see H2).
- Recommended solution: batch uploads with bounded concurrency (e.g. `p-limit(8)` around
  `uploadFile`), consistent with how `videos.service.ts` already parallelizes other I/O elsewhere.
- Effort: Low.
- Impact: Meaningfully shortens time-to-ready for the ffmpeg fallback path specifically.

**L3 — Two `UpdateXDto` classes and a couple of query DTOs read as "no validators" in a blunt grep, but are actually fine**
- Noted for completeness: `update-category.dto.ts` and `connect-onboard.dto.ts` extend
  `PartialType(CreateCategoryDto)` / use inherited decorators respectively — class-validator coverage
  across the 57 DTO files audited is genuinely strong (55/57 have explicit decorators, the other 2
  inherit them). No action needed; recorded so this isn't silently re-flagged by a future automated
  sweep using the same grep pattern.

---

## What's already solid (context for the scores below)

To calibrate severity fairly: migrations all have real `down()` implementations (78/78, verified);
webhook handling (`billing.service.ts`) is properly idempotent via a dedicated
`webhookIdempotency` check keyed on the provider event ID; multi-step subscription grants
(`entitlements.service.ts#grantSubscription`) correctly wrap the cancel-then-create sequence in a
`dataSource.transaction`; every BullMQ queue in `WorkersModule` has explicit `attempts`/`backoff`/
`removeOnComplete`/`removeOnFail`, and video processing has a real dead-letter queue
(`VIDEO_PROCESSING_DLQ_QUEUE`) fed from an `@OnWorkerEvent('failed')` handler once retries are
exhausted; the Socket.IO gateway uses the Redis adapter for multi-instance scale; global rate
limiting is wired through `ThrottlerGuard` with Redis-backed storage plus tighter per-route
`@Throttle` overrides on every sensitive auth endpoint; the response envelope
(`{ success, data, correlationId }` / `{ success: false, statusCode, message, errors, correlationId
}`) is applied globally and consistently via `TransformInterceptor` + `GlobalExceptionFilter`, with
correlation IDs threaded through CLS; hot-path entities (`videos`, `notifications`,
`analytics_events`) are properly indexed for their actual query shapes; and DTO validation
(`class-validator` + global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`) is
applied consistently. This is a codebase that has already been through multiple audit/remediation
cycles (see recent commit history), not a from-scratch buildout — the findings above are the
remaining gaps on top of a genuinely solid foundation, not evidence of a shaky one.

---

## Scores

**Backend score: 7.5/10** — Strong queue/retry/DLQ discipline, correct transaction usage on the
critical billing/entitlements path, consistent global exception handling and response envelopes, and
good separation of concerns in most services. Held back by the self-hosted ffmpeg transcode path
sharing a general worker pool by default (H2) and one real single-point-of-coupling in the Socket.IO
gateway (M3); the two god-service files are tracked in the parallel architecture audit and factored
in here at reduced weight to avoid double-penalizing the same evidence.

**Database score: 8/10** — Migrations are 100% reversible, hot-path tables are properly indexed, FK
relationships use appropriate `onDelete` cascades, and multi-step writes that need transactions have
them. Docked for the one genuinely under-indexed growing table found (`reports`, H3), the sequential
per-row batch-update pattern that won't scale linearly (M2), and minor entity/migration index
documentation drift (L1).

**API design score: 7/10** — Consistent envelope, strong DTO validation coverage, proper HTTP
exception mapping, and well-throttled auth endpoints. Docked for the lack of a real versioning
strategy (H1 — the single biggest structural API-design gap given three independent client apps),
inconsistent pagination conventions across list endpoints (M1), and Swagger being entirely absent in
production with no alternative contract-export path (M4).
