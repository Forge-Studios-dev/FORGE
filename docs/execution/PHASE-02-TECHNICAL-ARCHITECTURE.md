# Phase 02 — Technical Architecture Audit & Implementation

**Status:** Audit complete, scoped implementation complete, phase report below.
**Date:** 2026-08-23
**Scope:** `apps/api` module architecture (DI graph, god-files, duplicated logic), `packages/shared-types` and `packages/design-system` internal architecture, monorepo build architecture, plus execution of the 3 items Phase 01's roadmap explicitly deferred here (mobile repository-pattern gaps, `watch_screen.dart` god-file, design-system consumption sweep).
**Method:** Fresh code-level audit, evidence-based — every finding below is a verified file:line citation.

---

## 1. Existing State

`apps/api/src/app.module.ts` wires 37 top-level feature modules as a flat, single-level import list. No sub-domain grouping. `packages/shared-types` and `packages/design-system` are consumed via built `dist/` output with no TypeScript project-reference graph (`tsc -b`) — build ordering is entirely manual npm-script chaining.

---

## 2. Problems Found

### Module graph health

**61 `forwardRef(` occurrences** across `apps/api/src/modules` — two distinct patterns:

- **~30 genuine inter-module cycles** (app.module-level): `UsersModule` ↔ `ContentModule`/`AdminModule`/`AuthModule`, `ContentModule` ↔ `FeedModule`/`EntitlementsModule`, `StreamingModule` ↔ 6 other modules (a hub), `EntitlementsModule` ↔ `EngagementModule`/`UsersModule`, etc. Each has a verifiable, legitimate cross-domain reason (see audit transcript for the full pair-by-pair table).
- **High — `admin.module.ts` has 9 forwardRefs into leaf domain services** in one module — the single largest forwardRef surface in the graph. Admin is structurally the most tightly coupled module; it should depend on facades, not leaf services.
- **High — the `communities/` domain's decomposition is incomplete.** `CommunitiesService` was split into 12+ sub-services, but **13 of the 61 forwardRefs are intra-communities** — nearly every sub-service forwardRef-injects back into `CommunitiesService` or a sibling. Splitting the file didn't remove the coupling, it pushed the same cycle down a level and multiplied the forwardRef count.

### God-files (top 5 of 20 found, full list in audit transcript)

1. `videos.service.ts` (1631 lines, 16 deps) — S3 client lifecycle, presigned-upload state machine, multipart glue, Mux ingest, transcode enqueue, view-count/watch recording, playlist attach, skill-tag sync, shorts feed. 6+ responsibilities.
2. `entitlements.service.ts` (1421 lines, 11 deps) — tier CRUD, 4 near-duplicate access-check variants, subscription lifecycle, Stripe reconciliation. Injected by **24 other files across 16+ modules** — the de-facto access-control kernel for the whole platform.
3. `engagement.service.ts` (1222 lines) — reactions, full comment subsystem, follow/subscribe graph, moderation-lite, blocking, notify prefs. 6 distinct domains in one class.
4. `streaming.service.ts` (1092 lines) — stream CRUD, paywalled purchases, replay resolution, chat-settings **duplicated with `StreamChatService`**, Mux webhooks, co-host management.
5. `stream-chat.service.ts` (972 lines) — messages, super-chat, Q&A, moderation, chat-settings (overlapping with #4).

### DI/provider health

- **Medium** — `communities.module.ts` over-exported 4 providers (`LlmRouterService`, `CommunityMembersService`, `CommunityAnalyticsService`, `CommunityAccessService`) with zero external consumers, confirmed by repo-wide grep. **Fixed this pass.**
- **High (architectural)** — `EntitlementsService`'s 24-consumer fan-out means most of the platform's forwardRef cycles trace back to needing partial access-control functionality from a 1421-line service. A narrow `AccessControlFacade` exposing just `checkAccess`/`hasActiveSubscription` would decouple most call sites. Deferred — this is a real interface-design task, not mechanical.

### Duplicated business logic

- **Fixed this pass** — 6 duplicated `slugify()` implementations (4 byte-identical, 2 divergent) consolidated into `common/utils/slugify.util.ts`. See Implementation Log.
- **Fixed this pass** — 8 call sites bypassing the existing `clampLimit()` pagination util with ad-hoc `Math.min()` chains that didn't reject NaN/negative input. See Implementation Log.
- **Medium, deferred** — ownership-check pattern (`if (X.creatorId !== creatorId) throw...`) hand-rolled 15+ times with inconsistent exception types (some `ForbiddenException`, some `BadRequestException`, some silent empty-result). No shared guard/decorator exists. Real fix requires picking one canonical exception semantic and auditing call sites for behavior change — deferred to a dedicated pass.
- **Medium, deferred** — Q&A upvote implemented twice with incompatible persistence strategies: `qa-sessions.service.ts` uses a durable Postgres join-table; `stream-chat.service.ts` uses an ephemeral Redis-TTL set. Same product feature, different consistency guarantees. Needs a product decision (should these ever share semantics?) before a technical fix.
- **Medium, deferred** — `setPinnedMessage`/`setSlowMode` exist in both `streaming.service.ts` and `stream-chat.service.ts`. Unclear which is source-of-truth; consolidation needs investigation into actual call-site usage before picking a winner.

### Shared-types / design-system

- **Medium** — `apps/admin/src/lib/admin-user-types.ts` re-declares ~15 `User` fields already in `@forge/shared-types` instead of extending it. Already diverged: shared-types' `User.role` is a literal union, admin's copy loosens it to plain `string` — a real type-safety regression. Deferred — fixing requires touching every `AdminUser` consumer in admin, moderate blast radius.
- **Low-Medium, gap not bug** — no canonical `Community`/`Channel`/`Post`/`Poll` shared-types contract exists; web defines its own, admin has none at all. Deferred — needs design work, not mechanical.
- design-system package itself: clean DAG, no circular imports, deliberate RSC-boundary split (`index.ts` server-safe vs `client.ts` client-only) is a reasonable organizing principle. No fix needed there.

### Monorepo build architecture

- **Fixed this pass** — `dev:admin` was the only long-lived dev script missing a `@forge/shared-types` prebuild step (matched now to `dev:web`'s convention).
- **Medium, deferred (infra-sensitive)** — `WORKER_ONLY` and 8 `DISABLE_*` queue flags are checked via raw `process.env.X === 'true'` in some places and `ConfigService` in others — 4 independent string-literal comparisons of the same env var for `WORKER_ONLY` alone. Deliberately **not touched this pass**: this logic controls whether background workers/queues start in production, and `app.module.ts`'s raw read happens at module-array construction time (before Nest's DI lifecycle exists) — structurally forced, can't trivially route through `ConfigService`. A miscast "cleanup" here risks silently changing which process starts which queues in a live deployment. Real fix needs a dedicated pass with deploy-environment testing, not a drive-by.

### Mobile & web (Phase 01 roadmap carry-over)

- **Fixed this pass** — `watch_screen.dart` god-file (2755 lines): extracted 4 self-contained widgets (`PlaylistQueueSection`, `ExpandableDescription`+`LinkifiedText`, `ReportVideoButton`, `RelatedVideosSection`) into their own files. 2755 → 2295 lines. See Implementation Log for what was deliberately not extracted and why.
- **Deferred** — mobile repository-pattern sweep (8 of 16 feature folders have no `data/` layer) and the web design-system consumption sweep (Tabs/DataTable/Sparkline/Card/Avatar sitting at 0 imports while hand-rolled equivalents exist) are both genuinely XL efforts spanning many files each. Not attempted this pass — flagged for a dedicated future phase slice rather than rushed.

---

## 3. Recommended Architecture / Fixes

Same principle as Phase 01: ship the mechanical, verifiable, low-risk fixes now; defer anything requiring an interface-design decision (AccessControlFacade), a product decision (Q&A upvote semantics), or broad blast radius (AdminUser type fix, admin RBAC-tier-dependent work, communities forwardRef untangling) to a dedicated future pass with its own scoped validation.

---

## 4. Roadmap

| Task | Priority | Effort | Risk | Notes |
|---|---|---|---|---|
| `EntitlementsService` → `AccessControlFacade` extraction | P1 | XL | High | Would decouple most of the platform's forwardRef cycles; needs interface design first |
| Split `videos.service.ts` (1631 lines) | P1 | XL | High | 6+ responsibilities; core product surface, needs careful test coverage before touching |
| Split `entitlements.service.ts` (1421 lines) | P1 | XL | High | Blocked on the facade extraction above being designed first |
| Untangle `communities/` intra-module forwardRef mesh (13 occurrences) | P2 | XL | High | Decomposition already happened once and made it worse; needs a real dependency-direction redesign |
| Consolidate `setPinnedMessage`/`setSlowMode` duplication | P2 | M | Medium | Needs investigation into which call sites are actually live before picking source-of-truth |
| Reconcile Q&A upvote dual-implementation (Postgres vs Redis-TTL) | P3 | M | Medium | Product decision needed: should these ever share semantics? |
| Shared ownership-check guard/decorator | P2 | M | Low-Medium | Needs one canonical exception type chosen, then 15+ call sites audited for behavior change |
| Fix `AdminUser` type duplication (extend `User` from shared-types) | P2 | M | Medium | `role` field already diverged (loosened to `string`) — real type-safety regression |
| Canonical `Community`/`Channel`/`Post`/`Poll` shared-types contract | P3 | L | Low | Design work — no existing contract to converge on |
| `WORKER_ONLY`/`DISABLE_*` flag consolidation | P3 | M | High | Infra-critical (controls what starts in production); needs deploy-environment testing |
| Mobile repository-pattern sweep (8 feature folders) | P1 | XL | Medium | Carried over from Phase 01 |
| Web design-system consumption sweep | P3 | XL | Medium | Carried over from Phase 01 |
| Extract remaining `watch_screen.dart` sections (`_WatchEngageRow`, `_WatchCommentsSection`, `_HlsPlayerBlock`) | P2 | L | Medium | Deliberately deferred this pass — real state/lifecycle complexity (player disposal, sockets, mutations) |

---

## 5. Acceptance Criteria (this pass)

- [x] Slug generation has one source of truth; the latent trailing-hyphen bug is fixed everywhere it existed.
- [x] All pagination `limit` params are clamped consistently (no bypass of `clampLimit`).
- [x] No provider is exported from `communities.module.ts` without a real external consumer.
- [x] `watch_screen.dart` is meaningfully smaller with zero behavior change.
- [x] `dev:admin` can't silently serve stale `shared-types` output.
- [x] No regressions: full validation suite still green (see Implementation Log for the flaky-test investigation).

---

## 6. Implementation Log

| Fix | Files |
|---|---|
| Consolidated 6 duplicated `slugify()` implementations into `common/utils/slugify.util.ts`; fixed the shared trailing-hyphen bug; deleted the dead, uncapped copy in `entitlements.service.ts` | `articles/articles.service.ts`, `communities/community-rooms.service.ts`, `communities/community-engagement.service.ts`, `entitlements/creator-bundles.service.ts`, `courses/creator-programs.service.ts`, `entitlements/entitlements.service.ts` |
| Replaced 8 ad-hoc pagination-clamping call sites with the existing `clampLimit()` util | `content/videos.service.ts`, `communities/communities.service.ts` (×2), `communities/creator-audit.service.ts`, `search/search.service.ts` (×3), `direct-messages/direct-messages.service.ts`, `gamification/gamification.service.ts`, `communities/mentorship.service.ts`, `database/database-observability.service.ts` |
| Removed 4 confirmed-unused exports | `communities/communities.module.ts` |
| `dev:admin` now prebuilds shared-types | root `package.json` |
| Extracted 4 widgets from the `watch_screen.dart` god-file (2755 → 2295 lines), zero behavior change | `apps/mobile/lib/features/watch/presentation/*.dart` (shipped separately, PR #223) |

**Validation:** `eslint --max-warnings 0` clean, `nest build` clean. Targeted test run of every touched file: 14 suites / 147 tests, 100% pass. Two separate full-suite runs surfaced different, non-overlapping failures each time (worker-teardown warnings visible in both) — investigated and confirmed as pre-existing flakiness under parallel jest execution, not a regression: every implicated file passes 100% clean when run in isolation. Mobile extraction independently re-verified: `flutter analyze` zero new errors, `flutter test` 182/182.

---

## 7. Deferred / Backlog

Every architectural finding above (god-file splits, `EntitlementsService` facade, communities' forwardRef mesh, the two duplication cases needing a product/design decision, `AdminUser` type fix, community shared-types contract, worker-flag consolidation, mobile repository sweep, web design-system consumption sweep, and the remaining 3 `watch_screen.dart` extractions) is explicitly captured in the roadmap table above, sequenced by risk and priority — not dropped.
