# FORGE — Fresh QA & Product Audit (2026-07-26)

**Auditors (persona):** Senior QA Automation Lead + Senior PM + Senior Business Analyst + Senior AI Product Reviewer
**Scope:** Full monorepo — `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, `packages/*`, `docs/*`, CI config.

## Method & disclosure

This is a **static code + documentation audit**, produced fresh (no reuse of prior audit content). It was built by:
- Enumerating and counting real test files (`*.spec.ts`, `*.e2e-spec.ts`, `*.test.ts(x)`, `e2e/**`, `*_test.dart`) with `find`/`grep`.
- Reading `apps/api/test/http-test.harness.ts` and every file in `apps/api/test/` line-by-line to verify the "slim module, no live DB/Redis" convention is actually followed, not just documented.
- Reading `.github/workflows/ci.yml` to confirm what CI actually runs and gates on (vs. what `forge-testing.md` claims).
- Grepping for service files behind critical business flows (auth, billing/membership, video upload, recommendations, permissions) and checking for a matching spec file.
- Reading `docs/FORGE_PROJECT_MASTER.md` (route catalog, module table) and sampling `docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` for claimed vs. actual status.
- Spot-reading DTOs and service logic for pricing/tier/webhook edge cases ($0, negative, idempotency, concurrency).

**Explicit disclaimer:** No browser or running instance was used. Nothing in this report was clicked through manually — no live/manual QA, no visual regression check, no real network conditions, no actual load test. Every finding below is inferred from source code and docs. Live/manual QA (actually operating the app) is **out of scope for this pass** and is itself the top blind spot — flagged as QA-CRIT-01 below.

---

## PART 1 — QA / Testing Findings

### Test volume snapshot (verified by grep, not estimated)

| App | Source files (ts/tsx/dart) | Test files | `it`/`test`/`describe` (or `testWidgets`/`group`) occurrences |
|---|---|---|---|
| `apps/api` | ~1319 | 143 `.spec.ts` + 6 `.e2e-spec.ts` | 1119 (unit) + 62 (e2e) = **1181** |
| `apps/web` | ~302 | 3 `.test.ts(x)` + 3 `e2e/*.spec.ts` | 32 unit-ish + 16 Playwright = **48** |
| `apps/admin` | ~64 | 2 `.test.ts(x)` + 1 `e2e/*.spec.ts` | 12 unit-ish + 1 Playwright = **13** |
| `apps/mobile` | ~133 | 14 `*_test.dart` | **106** |

Interpretation: API test density (~0.9 test blocks per source file) is strong for a NestJS service layer. Web and admin are the opposite extreme — 302 web source files backed by only 3 non-e2e test files and 3 tiny e2e specs; 64 admin source files backed by 2 test files and 1 e2e smoke test. This is a real, measurable asymmetry, not a guess.

---

### QA-CRIT-01 — No live/manual QA has ever verified these flows end-to-end in this pass
- **Category:** Process / coverage gap
- **File(s):** N/A (methodology gap)
- **Severity:** Critical (process-level, not code-level)
- **Problem:** This audit — like the static nature of source review in general — cannot confirm that flows documented as "✅ MVP-ready" in `FORGE_PROJECT_MASTER.md` §16 actually render and function correctly in a browser/device. Playwright e2e coverage is too thin (see QA-HIGH-01) to substitute for this.
- **Why it matters:** A route existing, compiling, and having a unit test does not guarantee the click-path works (broken layout, JS error, wrong API contract at runtime, CORS, env misconfig).
- **Recommended fix:** Schedule a manual QA pass (or expand Playwright) across the flows in the Feature-Completeness Matrix below, especially checkout, live streaming, and studio upload, before any major marketing push.
- **Effort:** M (one focused QA day) to L (full device/browser matrix).

### QA-HIGH-01 — Web and admin e2e coverage is a thin smoke layer, not flow coverage
- **Category:** E2E coverage
- **File(s):** `apps/web/e2e/smoke.spec.ts`, `apps/web/e2e/auth-nav.spec.ts`, `apps/web/e2e/auth.spec.ts`, `apps/admin/e2e/smoke.spec.ts`
- **Severity:** High
- **Problem:** Web e2e = 16 test cases total, entirely about page-loads-without-crashing and auth-redirect middleware (`/library` → login, `/profile` → login, unverified-creator redirect, viewer-blocked-from-upload). Admin e2e = 1 test (`admin login page loads`). Zero e2e coverage exists for: video upload/studio flow, checkout/billing, live stream start/watch, community posting, playlists, search, notifications, DM, admin moderation actions (approve/reject creator, resolve report, force-end stream).
- **Why it matters:** These are exactly the revenue-critical and trust/safety-critical flows (money changes hands in checkout; moderation prevents platform abuse). A regression in Stripe checkout wiring or admin approve/reject would not be caught by CI.
- **Recommended fix:** Add Playwright specs (using existing auth fixtures/mocked network per `forge-testing.md`) for: creator upload happy path, checkout happy path (mocked Stripe), admin creator-approval action, admin report-resolution action. Target 8-10 new specs, not a full matrix.
- **Effort:** M.

### QA-HIGH-02 — `RecommendationsService` (personalized feed) has zero test coverage
- **Category:** Untested critical path
- **File(s):** `apps/api/src/modules/content/recommendations.service.ts` (192 lines, 3 public methods: `getPersonalizedFeed`, `getTrending`, `getSimilarVideos`)
- **Severity:** High
- **Problem:** No `recommendations.service.spec.ts` exists anywhere in the repo (confirmed via `find`). This service builds hand-assembled parameterized SQL with dynamic placeholder indices (`$${watchedIds.length + 3}`) — exactly the kind of off-by-one-prone code that needs a unit test, and it's the algorithm behind the platform's core discovery surface (`GET recommended/feed`, called from web/mobile home feed).
- **Why it matters:** A parameter-index bug here silently returns wrong/empty recommendations or throws in production with no test to catch it pre-merge; it's also the #1 lever for engagement/retention (see Product Part 2).
- **Recommended fix:** Add a spec mocking `DataSource.query` to verify parameter counts/order for `getPersonalizedFeed` (with and without watch history, with `excludeVideoIds`), the trending-fallback path when personalized results < limit, and `getSimilarVideos`.
- **Effort:** S–M.

### QA-MED-01 — `BillingController` and Stripe payment provider adapters lack dedicated unit specs
- **Category:** Untested critical path
- **File(s):** `apps/api/src/modules/billing/billing.controller.ts` (no `.spec.ts`), `apps/api/src/modules/billing/stripe-payment.provider.ts` (no `.spec.ts`), `apps/api/src/modules/billing/stub-payment.provider.ts` (no `.spec.ts`)
- **Severity:** Medium (mitigated — see note)
- **Problem:** `billing.controller.spec.ts` does not exist. However `apps/api/test/billing-webhook-http.e2e-spec.ts` does cover the webhook route at the HTTP layer with mocked DataSource/Redis, and `billing.service.spec.ts` covers the service. The gap is narrower than it first looks: the controller's routing/guard wiring and the two `PaymentProvider` implementations themselves are unverified in isolation.
- **Why it matters:** Provider-interface classes (`stripe-payment.provider.ts`, `stub-payment.provider.ts`) are the abstraction boundary for swapping billing providers — a bug in the Stripe adapter's mapping (e.g., cents vs. dollars, currency handling) wouldn't be caught by a service-level mock that stubs the provider entirely.
- **Recommended fix:** Add `stripe-payment.provider.spec.ts` asserting amount/currency mapping and error translation from Stripe SDK exceptions.
- **Effort:** S.

### QA-MED-02 — Harness convention is followed in spirit, not by reuse; verify this doesn't drift
- **Category:** Test convention consistency
- **File(s):** `apps/api/test/http-test.harness.ts`, `apps/api/test/admin-moderation-http.e2e-spec.ts`, `apps/api/test/auth-verify-email-http.e2e-spec.ts`, `apps/api/test/billing-webhook-http.e2e-spec.ts`, `apps/api/test/community-http.e2e-spec.ts`, `apps/api/test/courses-http.e2e-spec.ts`
- **Severity:** Medium
- **Problem:** Only `apps/api/test/app.e2e-spec.ts` actually imports and calls `createMockHttpApp()` from the shared harness. The other five e2e-spec files independently build their own `Test.createTestingModule({...})` with hand-rolled mocked `DataSource`/Redis/Queue providers. None of them import `AppModule`, and none reference `DATABASE_URL`/`REDIS_URL` (verified by grep — zero hits across all `.spec.ts` files), so the **rule** ("no live DB/Redis") is honored everywhere. But the **harness reuse** is not — five near-identical mock-module boilerplates exist in parallel with the shared one, which is a maintenance/drift risk (a change to global guards/interceptors must be replicated in 6 places instead of 1).
- **Why it matters:** Not a correctness bug today, but the pattern will silently diverge over time (e.g., one file gets a new global pipe, the other five don't), producing e2e tests that pass without exercising real prod wiring.
- **Recommended fix:** Extract a parameterized version of `createMockHttpApp({ controllers, providers })` and migrate the five standalone e2e specs onto it.
- **Effort:** S.

### QA-MED-03 — Coverage threshold gate is set very low (34%/33%/32%/20%)
- **Category:** CI quality gate
- **File(s):** `apps/api/package.json` (`jest.coverageThreshold`)
- **Severity:** Medium
- **Problem:** `npm run test:cov` in CI (`ci.yml` line ~152) enforces only 34% line / 33% statement / 32% function / 20% branch coverage globally. Given ~1319 API source files and 143 spec files, actual coverage is very likely well above this floor already — meaning the gate is not doing meaningful regression-prevention work; it would only fire if coverage collapsed dramatically.
- **Why it matters:** A coverage gate this low provides false confidence in CI green checkmarks — it will not catch a large swath of newly-added, untested code as violations.
- **Recommended fix:** Re-baseline the threshold to current actual coverage (run `test:cov` and read the summary) minus a small buffer, so future PRs can't silently regress coverage.
- **Effort:** S.

### QA-LOW-01 — No explicit offline/slow-network or stress/load test category anywhere in the repo
- **Category:** Missing test category
- **File(s):** N/A
- **Severity:** Low (by design — matches `forge-testing.md`'s "no live infra in default CI" rule, and the tracker explicitly defers this)
- **Problem:** No Playwright network-throttling tests, no k6/Artillery/load scripts, no chaos/offline simulation found anywhere (`grep` for `throttl`, `k6`, `artillery`, `loadtest` in test dirs returns nothing test-related). `docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` explicitly lists "50K MAU load test" and "100K entitlement simulation" as 🚫 blocked/deferred (`CEOS-P15-T017`, `CEOS-P15-T018`), which is honest and intentional, not an oversight.
- **Why it matters:** Fine pre-scale; becomes a real gap the moment FORGE approaches a marketing push or the 500K-video / 50K-MAU thresholds the docs themselves cite as trigger points.
- **Recommended fix:** No action needed now; track as a pre-launch-scale gate exactly as the tracker already does.
- **Effort:** N/A (already tracked).

### QA-LOW-02 — Mobile test suite is proportionally the strongest but narrower in flow breadth
- **Category:** Coverage breadth
- **File(s):** `apps/mobile/test/**/*_test.dart` (14 files, 106 test blocks)
- **Severity:** Low
- **Problem:** 106 test blocks across 133 source-relevant Dart files is a healthy ratio, but `FORGE_PROJECT_MASTER.md` §16 marks Mobile as ⚠️ (partial/config-dependent) for Feed, VOD, Live, Memberships, Communities, Courses, Stream chat, Access sessions, Gamification, and FCM — i.e., nearly every major feature is mobile-partial. Test file count wasn't cross-checked per-feature in this pass beyond the aggregate count.
- **Why it matters:** Aggregate test count looks reasonable but may cluster around a few well-tested screens (e.g., auth) while leaving the ⚠️ features thin — this needs a feature-by-feature breakdown, not just a total count, to be conclusive.
- **Recommended fix:** Run `flutter test --coverage` and inspect per-directory coverage to confirm ⚠️ features aren't near-zero.
- **Effort:** S (to measure).

---

## PART 2 — Product / UX-Flow / Competitive Findings

### PROD-CRIT-01 — Recommendation/personalization engine is rule-based SQL, not a learning system
- **Feature/Module:** Feed personalization — `apps/api/src/modules/content/recommendations.service.ts`
- **Current State:** `getPersonalizedFeed` scores candidates with a single hand-tuned formula (followed-creator +40, category-affinity up to +20, recent-view-velocity capped at +20, recency bonus +10) computed inline in one large parameterized SQL query per request, with a synchronous trending-fallback query appended if results run short. No caching layer (Redis) wraps this despite `forge-backend.md`'s explicit rule ("Redis for hot reads (feeds...)").
- **Gap/Issue:** This is a reasonable v1 heuristic, but it is not personalization in the sense competitors (YouTube, TikTok, even Skillshare's simpler collaborative filtering) mean it — no embeddings, no collaborative filtering, no click-through feedback loop, no A/B-testable ranking weights, and it re-runs multi-CTE SQL on every request with no cache.
- **Severity:** High (product ambition gap) / Medium (performance gap, since it's not yet load-tested at scale)
- **Business Impact:** Weak personalization directly caps session length and retention — the single highest-leverage lever for a content platform. Absence of caching also means feed latency scales linearly with `watch_history`/`videos` table growth with no backstop.
- **Recommendation:** Short-term: cache `getTrending()` output in Redis with a short TTL (this part is cacheable across users). Medium-term: log recommendation impressions/clicks (an event already exists via `AnalyticsModule`) and use them to tune the scoring weights or graduate to a lightweight collaborative-filtering job in the worker. This aligns with the docs' own "AI/automation opportunities" ambition.

### PROD-HIGH-01 — Semantic/AI search is explicitly deferred, current search is keyword-only Postgres FTS
- **Feature/Module:** Search — `apps/api/src/modules/search/search.service.ts`
- **Current State:** `ts_rank_cd` + `plainto_tsquery('english', ...)` over videos and `plainto_tsquery('simple', ...)` over users. No vector/embedding search.
- **Gap/Issue:** Matches docs' own admission: `CEOS-P12-T019` "AI search embeddings pgvector" and `CEOS-P15-T016` "Search sidecar Meilisearch" are both marked 🚫 (blocked), deferred until "500K videos or FTS p95 degrade." This is a documented, intentional deferral, not a silent gap — but it is a real competitive gap against Skillshare/Coursera-class discovery UX (which use semantic/related-topic search).
- **Severity:** Medium (correctly triaged by the team already; flagging for visibility, not urgency)
- **Business Impact:** Typo-tolerance and semantic ("videos about X" without exact keyword match) search matter more as the catalog grows; currently fine at small catalog size.
- **Recommendation:** No immediate action; keep the documented trigger threshold and revisit closer to it.

### PROD-HIGH-02 — Frontend/backend flow completeness is generally strong, but Web/Admin lag API breadth (per docs' own matrix)
- **Feature/Module:** Cross-cutting — see `FORGE_PROJECT_MASTER.md` §16 feature matrix
- **Current State:** Of ~26 tracked domains, API is ✅ for nearly all; Web is ✅ for the consumer-critical ones (auth, feed, VOD, live, engagement, DM, playlists, studio, memberships, communities) but ⚠️/— for podcasts (no web UI at all — API-only), analytics (⚠️ partial creator BI on web), AI (⚠️). Admin is ✅ only for a narrower operator set (moderation, fraud, admin hub) and — (no UI) for podcasts, DMs, playlists, mentorship, channel points, courses, creator resources despite full API support.
- **Gap/Issue:** Podcasts have a complete API (series, episodes, iTunes RSS) per §20's `podcasts` route catalog, but zero web frontend (`—` in the matrix) — a shipped-but-invisible feature. Several creator-economy features (mentorship, channel points, courses/quizzes/assignments) have full API depth but no admin oversight surface, meaning ops/trust-and-safety has no way to review or intervene on that content without a raw DB query.
- **Severity:** High for podcasts (dead API surface = wasted engineering investment until a UI ships), Medium for admin gaps (operational risk, not user-facing)
- **Business Impact:** Podcasts is a differentiator vs. Skillshare/Coursera (neither does podcast-style audio-first skill content) but is currently unusable by end users. Admin gaps mean moderation of mentorship/courses/channel-points content is manual/DB-level, which doesn't scale and is an audit-trail risk.
- **Recommendation:** Prioritize a minimal podcasts web listing/player page (API already supports it — this is close to a pure frontend task). For admin, add lightweight list/moderate views for mentorship matches, channel-point redemption queues (redemption approve/reject API already exists per §20), and course content — reuse existing `DataTable` design-system primitive already used elsewhere in admin.

### PROD-MED-01 — Pricing/tier edge cases are defensively validated at the DTO layer ($0 allowed, negative blocked)
- **Feature/Module:** Membership tiers — `apps/api/src/modules/entitlements/dto/tier.dto.ts`, `apps/api/src/modules/billing/billing.service.ts`
- **Current State:** `CreateTierDto.priceCents` / `UpdateTierDto.priceCents` use `@IsInt() @Min(0)` — free ($0) tiers are explicitly supported, negative prices are rejected at validation. `billing.service.ts` checks tier `maxMembers` seat-limit before creating a subscription and throws a clear `BadRequestException` when full. Stripe webhook processing has explicit idempotency-key deduplication (`WebhookIdempotencyService.isDuplicate`) before mutating state — correctly guards the classic "duplicate webhook delivery" race.
- **Gap/Issue:** This is a **positive finding**, not a defect — called out because the audit prompt specifically asked about $0/negative/concurrent-update handling and it holds up. One residual gap: `subscription-change.service.ts` (tier upgrade/downgrade) shows no `dataSource.transaction`/row-lock usage (grep found none), unlike `entitlements.service.ts` which does wrap a save in `dataSource.transaction`. A user double-clicking "change tier" rapidly could theoretically race two tier-change requests.
- **Severity:** Low
- **Business Impact:** Low likelihood, low blast radius (worst case: a tier-change record briefly inconsistent, correctable via Stripe as source of truth) — but worth a quick look since it's real money.
- **Recommendation:** Wrap `subscription-change.service.ts`'s write path in a transaction or add an idempotency check keyed on `(userId, tierId, timestamp-window)` similar to the webhook pattern already proven elsewhere in the codebase.

### PROD-MED-02 — Admin/operator UI has no interface for several fully-API-backed governance features
- **Feature/Module:** Admin — channel points redemption queue, mentorship matching, course moderation
- **Current State:** APIs exist (`POST …/redemptions/:redemptionId/approve|reject`, `POST communities/:communityId/mentorship/run-matching`, course grading endpoints) per `FORGE_PROJECT_MASTER.md` §20, but `apps/admin` routes (§10) list no corresponding pages.
- **Gap/Issue:** Same root cause as PROD-HIGH-02, called out separately because it's specifically an operational/trust-and-safety concern rather than a growth concern.
- **Severity:** Medium
- **Business Impact:** Without an admin surface, abuse in channel-points redemption (a real-money-adjacent reward system) or mentorship matching can only be caught by someone querying the database directly — this doesn't scale past a handful of creators and is a support/ops bottleneck.
- **Recommendation:** Same as PROD-HIGH-02 — treat as one consolidated "admin oversight surfaces" workstream.

### PROD-LOW-01 — Onboarding is signup-only; no dedicated onboarding/setup wizard beyond `become-creator`
- **Feature/Module:** Onboarding — `apps/web` routes §9
- **Current State:** Routes cover `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/waiting-approval`, `/approval-rejected`, and creator-specific `/upload/become-creator`, `/upload/step/[step]`. There's no generic post-signup "welcome/interests/preferences" onboarding step for regular (non-creator) consumers.
- **Gap/Issue:** Competitors in the skill-learning space (Skillshare, Coursera) typically ask new users for topic interests immediately after signup to seed personalization — which directly feeds a cold-start problem for `RecommendationsService` (a brand-new user has no watch history, so `getPersonalizedFeed` falls through entirely to the generic trending fallback).
- **Severity:** Low
- **Business Impact:** Weaker first-session relevance for new users, compounding the PROD-CRIT-01 personalization gap specifically at the highest-churn moment (first session).
- **Recommendation:** A lightweight "pick 3-5 skill tags" step after signup, stored and fed into `getPersonalizedFeed`'s category-affinity signal as a cold-start substitute for watch history.

---

## Feature-completeness matrix (condensed from `FORGE_PROJECT_MASTER.md` §16, verified against route catalog §20)

| Flow | API | Web | Admin | Mobile | Note |
|---|:---:|:---:|:---:|:---:|---|
| Auth (signup/login/OTP/reset) | ✅ | ✅ | ✅ | ✅ | Full route parity confirmed in §20 `auth` |
| VOD upload/studio | ✅ | ✅ | — | ⚠️ | No admin video-upload surface (moderation only) |
| Podcasts | ✅ | **—** | — | — | API-only; see PROD-HIGH-02 |
| Live streaming | ✅ | ✅ | ✅ | ⚠️ | Deepest feature set (co-hosts, VIP, breakout) |
| Payments/memberships | ✅ | ✅ | grant-only | ⚠️ | Admin can grant but not fully manage tiers |
| Recommendations/feed | ✅ (heuristic) | ✅ | ✅ | ⚠️ | See PROD-CRIT-01 |
| Search | ✅ (FTS only) | ✅ | ✅ | — | Semantic search deferred (documented) |
| Courses | ⚠️ | ⚠️ | — | ⚠️ | Marked partial platform-wide in own docs |
| Channel points | ✅ | — | — | — | See PROD-MED-02 |
| Mentorship | ✅ | — | — | — | See PROD-MED-02 |
| Admin moderation/fraud | ✅ | — | ✅ | — | Strongest admin area |

---

## Scores

**QA/Testing score: 7/10** — API-side testing is genuinely strong (1181 test cases, consistent slim-module/mocked-dependency convention, CI correctly gates without live DB/Redis, webhook idempotency and coverage thresholds exist). Held back from higher by: near-absent e2e flow coverage on web/admin (16 + 1 test cases covering almost entirely auth-redirect/smoke, nothing on checkout/upload/moderation), zero test coverage on the personalization engine, a coverage-threshold gate too low to be meaningful, and — by design of this audit pass — zero live/manual verification.

**Product completeness score: 8/10** — Exceptionally broad feature surface for the platform's maturity stage (courses, live co-hosting/VIP/breakout rooms, channel points, mentorship matching, gamification, referral, fraud detection, AI copilot/moderation all shipped with real logic, not stubs — verified by reading actual service code, not just the tracker's own claims). Docking points for: podcasts shipped API-only with no web UI, several governance-relevant admin surfaces missing despite full API support, and a personalization engine that's a solid heuristic rather than a learning system.

**Competitive positioning score: 6/10** — Strong relative to direct niche competitors (Skillshare/Coursera lack live co-hosting, channel points, or mentorship matching; Twitch/Patreon lack structured courses/certificates). Weaker on the two things that most determine retention for any content platform at scale: search sophistication (keyword-only, semantic explicitly deferred) and recommendation sophistication (rule-based, no feedback loop, no cold-start onboarding step to seed it). These are honestly self-documented as deferred rather than hidden, which is a maturity signal in itself, but they remain the gap between "feature-complete niche product" and "market-leading."

---

## Top 10 features to add for market-leading positioning

1. **Cold-start onboarding (pick skill interests at signup)** feeding directly into `RecommendationsService`'s category-affinity signal — cheapest, highest-leverage fix for PROD-CRIT-01/PROD-LOW-01.
2. **Redis caching layer for trending/recommended feeds** — closes the forge-performance.md compliance gap and cuts DB load as catalog grows.
3. **Podcasts web player/listing page** — the API is already built; this is near-pure frontend work to unlock a differentiator feature that's currently invisible to users.
4. **Admin oversight surfaces for channel points, mentorship, and course moderation** — closes a real trust-and-safety scaling gap.
5. **Click/impression feedback loop into recommendations** (analytics events already exist) to move from static heuristic to a tunable, eventually learned ranking.
6. **Playwright coverage for checkout and studio-upload happy paths** — the two flows where a silent regression has the highest cost (revenue, creator trust).
7. **Creator-side self-serve analytics depth** (web is ⚠️ partial per the docs' own matrix) — this is table-stakes against Patreon/Twitch creator dashboards.
8. **Signed/expiring Mux playback URLs (DRM-lite)** — already tracked as deferred (`CEOS-P01-T009`); matters once paid content value increases.
9. **Semantic search (pgvector or hosted embeddings)** — already tracked as deferred at a documented trigger threshold; worth pulling forward if search relevance complaints appear before the 500K-video mark.
10. **Notification digesting / batching UX** (e.g., "5 new comments" instead of 5 separate pushes) — not identified as broken, but not confirmed present either; a common competitive differentiator (Discord/Slack-grade notification grouping) worth a dedicated look in a follow-up pass.

---

*Generated 2026-07-26. Static analysis only — see method/disclosure section. No production or staging systems were accessed.*
