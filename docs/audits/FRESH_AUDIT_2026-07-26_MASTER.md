# FORGE — Master Enterprise Audit (Fresh, From-Scratch)

**Date:** 2026-07-26
**Requested by:** `MASTERPROJECTAUDITPROMPT.md` + `prompt.md` (merged scope, both applied in full)
**Method:** 7 independent, parallel, from-scratch domain audits — each performed by re-reading current source directly (no reliance on prior audit docs as ground truth), covering ~1,800 source files across `apps/api` (NestJS), `apps/web` + `apps/admin` (Next.js), `apps/mobile` (Flutter), `packages/*`, infra, and CI/CD. This document synthesizes all 7 into one deliverable. Full evidence, code snippets, and every finding's complete write-up live in the linked sub-reports — this document is the executive layer on top of them.

**Sub-reports (full detail, cite every file/line):**
| Domain | Report |
|---|---|
| Architecture & Code Quality | [FRESH_AUDIT_2026-07-26_ARCHITECTURE.md](./FRESH_AUDIT_2026-07-26_ARCHITECTURE.md) |
| Backend, Database & API Design | [FRESH_AUDIT_2026-07-26_BACKEND_DB.md](./FRESH_AUDIT_2026-07-26_BACKEND_DB.md) |
| Security (OWASP, all apps) | [FRESH_AUDIT_2026-07-26_SECURITY.md](./FRESH_AUDIT_2026-07-26_SECURITY.md) |
| Web + Admin Frontend (UI/UX/perf/a11y/SEO) | [FRESH_AUDIT_2026-07-26_FRONTEND.md](./FRESH_AUDIT_2026-07-26_FRONTEND.md) |
| Mobile (Flutter) | [FRESH_AUDIT_2026-07-26_MOBILE.md](./FRESH_AUDIT_2026-07-26_MOBILE.md) |
| DevOps / AWS / Infra / CI-CD | [FRESH_AUDIT_2026-07-26_DEVOPS_AWS.md](./FRESH_AUDIT_2026-07-26_DEVOPS_AWS.md) |
| QA/Testing + Product/Competitive | [FRESH_AUDIT_2026-07-26_QA_PRODUCT.md](./FRESH_AUDIT_2026-07-26_QA_PRODUCT.md) |

**Explicit disclosure (carried from the QA/Product audit, applies platform-wide):** every finding below is a **static code + documentation audit**. No browser or device was used; nothing was clicked through manually; no live network/load conditions were exercised; no live AWS/production credentials were available. Where an agent verified something live (e.g., GitHub branch-protection API, `flutter analyze`), it's called out explicitly. Manual/live QA across the flagship user flows (checkout, live streaming, studio upload, admin moderation) remains the single largest blind spot this audit cannot close — see QA-CRIT-01.

---

## Executive Summary

FORGE is a genuinely mature, feature-rich creator-economy platform — not an early-stage prototype. Independent verification found: 1,181 backend test cases across 143 spec files, 100%-reversible database migrations (78/78), a release pipeline with automatic rollback and a quarterly-drilled disaster-recovery runbook, zero hardcoded secrets anywhere in the tracked tree, zero SQL injection surface across 81 parameterized query-builder call sites, and an unusually broad, **real** (not stubbed) feature set — live co-hosting, VIP rooms, channel points, mentorship matching, fraud detection, courses, gamification — that already exceeds most direct niche competitors (Skillshare, Coursera, Patreon).

Against that foundation, this audit found **6 Critical, 23 High, 37 Medium, and 22 Low** findings (88 total) across the 7 domains. None of the Critical findings are an exploitable-today, unauthenticated security vulnerability — the Security audit alone came back at 0 Critical / 0 High, the strongest domain score in this audit. The Critical findings instead cluster around **governance and architecture debt that will compound as the platform scales**: `main` has no technical branch-protection backstop despite the entire release model assuming one; two backend services have grown into 1,400–2,000-line god objects with a genuine circular module dependency between billing and entitlements; a whole content vertical (courses) is invisible to search engines; and live/manual QA has not verified the flagship flows end-to-end in this pass.

**Bottom line:** this is a platform that could support real production traffic today without an external attacker compromising it, but it is not yet in a state where a major scale-up or marketing push is safe without closing the branch-protection gap, the god-object/circular-dependency debt, and the e2e coverage gap on revenue-critical flows.

### Biggest strengths
- Security posture (8/10) — fail-closed auth, refresh-token reuse detection, signed/idempotent webhooks, secure token storage on both web and mobile, real CSP with nonces.
- Database discipline (8/10) — every migration reversible, hot-path tables indexed, transactions on multi-step writes, proper FK cascades.
- CI/CD pipeline mechanics (part of DevOps 6/10) — fail-closed secret audit, automatic rollback on deploy failure, a DR runbook that's actually been drilled, not just written.
- Product breadth (8/10) — an unusually complete creator-economy feature set for this stage, verified by reading real service code, not just tracker claims.
- Mobile networking/security foundation (part of Mobile 6.5/10) — cert-pinned API client, secure token storage, bounded offline cache, correct HLS lifecycle/dispose.

### Biggest weaknesses
- `main` branch has zero technical protection despite being the sole production-deploy gate (DevOps C-1).
- Two backend god-object services (`CommunitiesService` 2,035 lines/~20 deps, `EntitlementsService` 1,482 lines) plus a confirmed `BillingModule ⇄ EntitlementsModule` circular dependency (Architecture C1/C2).
- Accessibility is the weakest cross-cutting dimension: web a11y scored 5.5/10, mobile has zero `Semantics()` widgets and 92% of icon buttons unlabeled.
- Web/admin e2e test coverage is a thin smoke layer (17 total test cases) with **zero** coverage on checkout, studio upload, live streaming, or admin moderation actions.
- 71% of Flutter presentation-layer files bypass the mandated repository pattern and call the API client directly.
- Personalization/recommendations is a static SQL heuristic with no cache, no feedback loop, and no cold-start onboarding — the single biggest gap between "feature-complete" and "competitively sticky."

---

## Overall Scorecard

| Category | Score /10 | Source |
|---|---|---|
| Architecture | 6.5 | Architecture audit |
| Code Quality | 6.5 | Architecture audit (derived: low debt-marker count, but 2 god objects + pervasive duplication) |
| Backend | 7.5 | Backend/DB audit |
| Database | 8.0 | Backend/DB audit |
| API Design | 7.0 | Backend/DB audit |
| Security | 8.0 | Security audit |
| Web UI | 7.0 | Frontend audit |
| Web UX | 7.0 | Frontend audit |
| Admin UI/UX | 6.5 | Frontend audit |
| Accessibility | 5.5 | Frontend audit (web); mobile a11y separately worse — see Mobile report |
| SEO | 6.0 | Frontend audit |
| Frontend Performance | 7.0 | Frontend audit |
| Mobile (Flutter) | 6.5 | Mobile audit |
| DevOps | 6.0 | DevOps/AWS audit |
| AWS/Cloud | 7.0 | DevOps/AWS audit |
| QA/Testing | 7.0 | QA/Product audit |
| Product Completeness | 8.0 | QA/Product audit |
| Competitive Positioning | 6.0 | QA/Product audit |
| Maintainability | 6.0 | Derived (Architecture god objects + web/admin infra duplication weigh heaviest) |
| Scalability | 6.5 | Derived (self-hosted ffmpeg on shared worker pool, single-worker SPOF, unindexed `reports` table, no API versioning) |
| Documentation | 6.5 | Derived (DevOps found doc/reality drift: `docker-compose.prod.yml` documented as prod but broken/unused; branch protection documented as done, isn't) |
| Production Readiness | 6.5 | Derived — see Production Readiness Assessment below |
| **Overall** | **6.9 / 10** | Mean of the 17 directly-scored sub-domains above |

**Overall Grade: B-** — Production-capable, not yet production-hardened for scale. Strong technical foundations (security, database, CI mechanics) undercut by governance gaps (branch protection), architecture debt (god objects, circular deps), and thin coverage on the highest-consequence user flows (revenue, live, moderation).

---

## Findings by Domain — Critical & High (full list; Medium/Low live in sub-reports)

### 🔴 Critical (6 total)

| # | Domain | Finding | File(s) | Effort |
|---|---|---|---|---|
| 1 | DevOps | `main` has **zero** GitHub branch protection/rulesets — verified live via `gh api` (404) — despite `release.yml` auto-deploying production on every push. The entire "PR-gated release" model is a social convention with no technical backstop. | GitHub repo config, `release.yml` | 15 min |
| 2 | Architecture | `CommunitiesService` is a 2,035-line god object, ~20 injected dependencies, 57 methods spanning 6 unrelated bounded contexts (CRUD, deprecated legacy channels, access control, creator analytics/CSV export, badges, ownership transfer). | `apps/api/src/modules/communities/communities.service.ts` | 3–5 days |
| 3 | Architecture | Tangled module graph forces `forwardRef` in 26 files, including a **direct two-module cycle**: `BillingModule ⇄ EntitlementsModule`. | `billing.module.ts:75`, `entitlements.module.ts:27-29` | 1 week+ |
| 4 | Frontend | Course catalog + course detail pages are 100% client-rendered, zero metadata, absent from `sitemap.ts` — a whole monetizable content vertical is invisible to search, despite the correct SSR/metadata pattern already existing on `watch/[id]`. | `apps/web/src/app/discover/courses/page.tsx`, `apps/web/src/app/courses/[id]/page.tsx` | 1–2 days |
| 5 | Mobile | Confirmed, 100%-reproducible leaked `TextEditingController` on every "create playlist" dialog open — never disposed. | `lib/features/playlists/presentation/playlists_screen.dart:44` | 15 min |
| 6 | QA (process) | No live/manual QA has verified flagship flows (checkout, live streaming, studio upload, admin moderation) end-to-end; Playwright coverage is too thin to substitute. | N/A — process gap | 1 day (M) – full matrix (L) |

### 🟠 High (23 total — grouped by domain, full detail in sub-reports)

**Architecture (4):** `EntitlementsService` is a second god object (1,482 lines, ~55 methods) mixing the paid-content access-control hot path with cold-path CSV analytics · Duplicated, already-drifting HTTP-client/auth/CSRF infra hand-copied between `apps/web` and `apps/admin` (5 files each) · No dead-code/unused-export tooling (`knip`/`ts-prune`) wired anywhere despite ~1,800 files · Deprecated legacy-channel API remains fully entangled inside the god object instead of isolated for clean deletion.

**Backend/API (3):** No real API versioning strategy — just a hardcoded `api/v1` prefix — a real risk with 3 independently-releasing clients · Self-hosted ffmpeg transcoding is the *default* video pipeline (Mux integration exists but isn't the default), running CPU/disk-bound work inline in a shared general-purpose worker process · `reports` table (admin moderation queue) has **zero indexes** on its only filter+sort query shape, and is the one genuinely-unbounded-growth table found.

**Frontend (5):** No `focus-visible` treatment on the shared `Button` primitive — a systemic keyboard-nav gap since every button in both apps uses it · `aria-label` coverage present in only 10/224 web files and 1/37 admin files · No `dark:` variants anywhere — single fixed dark theme, undocumented as a deliberate choice · Forms hand-roll `useState` validation with zero `react-hook-form`/`zod` adoption despite `Input` already supporting it · Admin has zero loading-skeleton usage anywhere (web has 18).

**Mobile (4):** 71% of presentation files (42/59) call the API client directly, bypassing the mandated repository pattern entirely · 47 silent `catch (_) {}` blocks with **zero** Sentry capture despite Sentry being configured for uncaught errors only · Zero `Semantics()` widgets codebase-wide; 92% of `IconButton`s missing `tooltip` · 20+ deprecated `DropdownButtonFormField` usages concentrated on creator-monetization Studio screens, plus one live `use_build_context_synchronously` crash risk.

**DevOps/AWS (3):** GitHub Actions supply chain uses `@master` (mutable branch, not even a tag) for `superfly/flyctl-actions` in workflows holding `FLY_API_TOKEN`/`VERCEL_TOKEN` · Long-lived static AWS IAM keys with no rotation automation, despite the repo already proving it knows OIDC (used for GCP) · `docker-compose.prod.yml` + nginx config describe a self-hosted topology that doesn't match and can't run as real production (broken SSL mount) — flagged as broken in the 2026-07-22 audit and still unfixed.

**QA/Product (4):** Web+admin e2e is a thin smoke layer (17 cases total) with zero coverage on checkout/upload/live/moderation · `RecommendationsService` (core discovery surface) has zero test coverage despite fragile hand-indexed parameterized SQL · Semantic/AI search is explicitly deferred — keyword-only Postgres FTS today (self-documented, not hidden) · Podcasts ships with a complete API but **zero web UI** — a dead, invisible feature; several creator-economy features (mentorship, channel points, courses) have full API depth but no admin oversight surface.

*(Security contributed 0 Critical / 0 High — its most severe finding, the impersonation-token audit-trail bypass, is Medium; see below.)*

---

## Findings by Domain — Medium & Low (summary; full write-ups in sub-reports)

- **Security (3 Medium, 3 Low):** admin-impersonation JWT works as a full bearer token because `JwtStrategy.validate()` never checks `payload.purpose` (bypasses session audit trail, requires admin-level precondition) · CSRF check on cookie refresh is disabled outside `NODE_ENV === 'production'` (environment-string-gated, not fail-safe) · no server-enforced upload size limit on presigned S3 PUT URLs · SVG allowed in creator-resource uploads (latent stored-XSS surface, not currently exploitable) · CSRF/session cookies share the parent domain · password-reset/email-verify tokens ride in URL query strings while the impersonation flow already solved this with a hash fragment.
- **Architecture (4 Medium, 3 Low):** four large controllers warrant an inline-logic spot-check · repositories injected raw everywhere instead of a query-abstraction layer · two genuinely unbounded `.find()` queries (course listing, certificates) · thin/undiscoverable shared-hooks convention on web.
- **Backend/DB (4 Medium, 3 Low):** pagination reimplemented ad hoc across ~190 list endpoints instead of the shared clamp utility · sequential per-row writes in subscription-expiry/reconciliation cron jobs won't scale linearly · the Socket.IO gateway is a single 772-line class fielding 7+ real-time domains · Swagger fully disabled in production with no contract-export fallback.
- **Frontend (6 Medium, 3 Low):** high `'use client'` density on otherwise-static pages · inconsistent SEO metadata coverage across public routes · JSON-LD structured data exists in exactly one place · orphaned `offline/page.tsx` with no PWA manifest · no `React.memo` on feed list rows · one admin screen bypasses the shared `DataTable`.
- **Mobile (7 Medium, 4 Low):** no localization scaffolding (467 hardcoded strings) · no responsive/tablet layout despite iPad being a declared platform target · hardcoded dark-only theme, undocumented as intentional · no `errorBuilder` on the router for bad deep links · a dead/unused `feedProvider` alongside duplicate manual state · two `Image.network` call sites bypassing the app's own image cache · very large `build()` methods concentrating complexity in Studio/Community screens.
- **DevOps/AWS (7 Medium, 2 Low):** no `CODEOWNERS` file · worker Dockerfile missing a `HEALTHCHECK` · no `.dockerignore` anywhere · the critical-severity `npm audit` CI gate silently no-ops on registry outages with no flakiness tracking · worker runs `--ha=false` (single machine, no HA) · Terraform state has no remote backend/locking · emergency deploy workflow silently diverges from the routine deploy's region topology.
- **QA/Product (6 Medium, 4 Low):** `BillingController`/Stripe provider adapters lack dedicated unit specs (partially mitigated by existing e2e/service coverage) · the shared HTTP test harness is followed in spirit but reused by only 1 of 6 e2e specs · coverage threshold gate is set very low (34%/33%/32%/20%) and likely provides false confidence · tier-change flow lacks the transaction wrapping used elsewhere for money-adjacent writes · several fully-API-backed admin governance surfaces (channel points, mentorship, course moderation) have no UI · no dedicated onboarding/interest-picking step to seed cold-start personalization.

---

## Prioritized Improvement Roadmap

### Critical — must fix before any major scale-up or marketing push
1. **Enable GitHub branch protection on `main`** (require PR + passing `ci-ok` + CodeQL, dismiss stale approvals, block force-push) — 15 min, closes the single biggest governance gap in the audit.
2. **Fix the leaked `TextEditingController`** in `playlists_screen.dart` — 15 min.
3. **Split `CommunitiesService`** into `CommunityAnalyticsService`, `ChannelLegacyService`, `CommunityAccessService` — 3–5 days.
4. **Break the `Billing ⇄ Entitlements` circular dependency** by relocating `StripeTierSyncService` — 1 week+.
5. **Ship SSR + metadata + sitemap entries for course pages** — 1–2 days.
6. **Schedule a real manual/live QA pass** across checkout, live streaming, studio upload, and admin moderation before any marketing push — 1 day minimum.

### High Priority
- Split `EntitlementsService`'s hot-path access-control engine from its cold-path analytics/CSV export.
- Extract shared `packages/api-client` for the duplicated web/admin auth+CSRF+Sentry infra.
- Adopt NestJS API versioning (`enableVersioning`) before the next breaking change forces a synchronized 3-client release.
- Flip the video pipeline default to Mux (or isolate ffmpeg into its own worker pool) so transcoding stops sharing a process with every other queue.
- Add the missing `(status, created_at)` index on `reports`.
- Migrate the 71% of Flutter presentation files onto the repository pattern (phased, feature-by-feature, starting with community/studio/live).
- Wire all 47 silent mobile `catch` blocks through a shared Sentry-capturing helper.
- Add accessibility labels: `focus-visible` on the shared web `Button`, `aria-label` sweep on web/admin icon buttons, `tooltip`/`Semantics()` sweep on mobile `IconButton`s.
- Pin GitHub Actions to release tags (stop using `@master`) and move toward SHA pinning.
- Migrate AWS creds off long-lived static keys onto the OIDC pattern already proven for GCP, or add a documented rotation runbook.
- Delete or clearly relabel `docker-compose.prod.yml` as non-production reference material.
- Add Playwright coverage for checkout, studio upload, and admin approve/reject actions — the four highest-consequence untested flows.
- Add unit tests for `RecommendationsService` before its next change.
- Ship a minimal podcasts web listing/player page (API is already built) and admin oversight views for channel points / mentorship / course moderation.
- Fix the deprecated Flutter form-field APIs and the one live `use_build_context_synchronously` crash risk in Studio.

### Medium Priority
Pagination-utility adoption across ~190 endpoints · batch the sequential subscription-expiry/reconciliation writes · split the 772-line Socket.IO gateway by domain · persist the OpenAPI document in production even with Swagger UI disabled · fix the impersonation-JWT purpose check and make the CSRF check fail-safe by default · enforce presigned-upload size limits via S3 POST policies · add `CODEOWNERS`, worker `HEALTHCHECK`, `.dockerignore`, Terraform remote state · re-baseline the Jest coverage threshold to something meaningful · add a light onboarding/interest step to seed cold-start recommendations · add Redis caching to the trending/recommended feed queries.

### Low Priority / Polish
SVG upload-type removal, entity/migration `@Index` documentation drift, hex-color/`eslint-disable` cleanup, mobile localization scaffolding, tablet-responsive layout audit, dark-mode-as-explicit-decision documentation (web and mobile both), `ListView.builder` audit on the ~5 genuinely-unbounded mobile lists, script `set -eu` consistency, emergency-deploy region-flag parity.

---

## Top 20 Highest-Priority Improvements (ranked by impact ÷ effort)

1. Enable `main` branch protection (15 min / closes the biggest governance gap)
2. Fix leaked `TextEditingController` (15 min / eliminates a confirmed leak)
3. SSR + sitemap for course pages (1–2 days / unlocks a whole content vertical's search visibility)
4. `Button` component `focus-visible` fix (<1 day / propagates to every button in both web apps)
5. Add index to `reports` table (1 migration / keeps admin moderation queue fast as it grows)
6. Fix impersonation-JWT `purpose` check (1–2 hrs / closes an audit-trail bypass)
7. Make CSRF check fail-safe by default instead of environment-string-gated (30 min)
8. Pin GitHub Actions off `@master` (1–2 hrs / closes a live supply-chain path to prod credentials)
9. Wire mobile's 47 silent catches to Sentry (0.5–1 day / restores production error visibility)
10. Playwright coverage for checkout + studio upload + admin moderation (few days / covers the 4 highest-cost-of-regression flows)
11. Unit tests for `RecommendationsService` (S–M / covers the core discovery surface)
12. Split `CommunitiesService` god object (3–5 days / unblocks safe iteration on 6 different concerns)
13. Break Billing⇄Entitlements circular dependency (1 week / removes a class of DI-ordering bugs)
14. Migrate 71% of mobile screens onto the repository pattern, phased (1–2 sprints / makes most of the app testable)
15. `aria-label`/`Semantics`/`tooltip` accessibility sweep, web + mobile (2–3 days each / closes the weakest cross-cutting dimension)
16. Extract shared `packages/api-client` for web/admin (1–2 days / stops silent security-adjacent drift)
17. Adopt NestJS API versioning (Medium / de-risks the next breaking change against 3 independent clients)
18. Flip video pipeline default to Mux / isolate ffmpeg worker pool (Low–Medium / removes a scaling single point of contention)
19. Podcasts web UI + admin oversight surfaces for channel points/mentorship/courses (few days / unlocks already-built API investment)
20. Cold-start onboarding step feeding `RecommendationsService` (S–M / cheapest, highest-leverage retention lever identified)

## Quick Wins (under 1 day each)
Branch protection · mobile controller dispose · CSRF fail-safe default · worker `HEALTHCHECK` · `.dockerignore` · emergency-deploy region-flag parity · `CODEOWNERS` · script `set -eu` fix · `Button` focus-visible ring · SVG mime-type removal · mobile `CachedNetworkImage` swap (2 sites) · mobile router `errorBuilder` · Architecture's two unbounded `.find()` pagination fixes · deprecated Flutter form-field mechanical rename + `use_build_context_synchronously` guard.

## Medium-Term (1–4 weeks)
Course SSR + sitemap · `CommunitiesService`/`EntitlementsService` splits · pagination-convention standardization across ~190 endpoints · Playwright coverage for the 4 flagship flows · mobile repository-pattern migration (phased) · web/admin accessibility sweep · shared `packages/api-client` extraction · AWS OIDC migration or rotation runbook.

## Long-Term Roadmap (3–12 months)
Break the Billing⇄Entitlements module cycle properly · move personalization from static heuristic to a feedback-loop-driven ranking system · semantic/AI search (pgvector or hosted embeddings) once the catalog approaches the documented trigger threshold · full podcasts + admin-governance-surface build-out · light theme / true `ThemeMode` support (web + mobile) if not formally deciding to stay dark-only · tablet-adaptive mobile layouts · 50K MAU load test and 100K-entitlement simulation (already tracked as deferred in the platform's own roadmap).

---

## Production Readiness Assessment

**Can this project support:**
- **10K users:** Yes, comfortably. Current architecture, indexing, and caching are well ahead of this scale.
- **100K users:** Yes, with the High-priority items addressed first — specifically the ffmpeg worker-pool contention, the `reports` index, and pagination-convention gaps, none of which are blockers at this scale but all become visible around it.
- **1 Million users:** Conditional. Requires the Critical + High architecture/DevOps items closed first: branch protection, the god-object splits (change velocity and blast-radius containment matter enormously at this scale), API versioning (3 independent clients), the single-worker SPOF, and a real load test — currently deferred, not done.
- **10 Million users:** Not yet assessed as ready — would require the semantic search and learned-ranking work on the long-term roadmap, a fully resolved worker-pool/video-pipeline scaling story, and horizontal worker scaling beyond the current single-machine `--ha=false` deployment.

**High availability:** CI/CD rollback automation and a genuinely-drilled DR runbook (quarterly, verified against real Neon PITR) are strong positives. The single-machine worker deployment and the (now-identified) lack of `main` branch protection are the two biggest gaps against a true HA posture.

**Observability:** Strong on the backend (structured logging, correlation IDs, Prometheus/Grafana, fail-closed metrics auth, BullMQ queue-depth alerting) — weak on mobile (47 silently-swallowed exceptions with no Sentry capture).

---

## Final Verdict

1. **Would you release this product today? Why or why not?** Yes for a controlled/limited launch, not for a full marketing push. No exploitable security vulnerability blocks release — the security audit came back clean of Critical/High findings. What blocks a *confident* major launch is the branch-protection gap (a single accidental or malicious direct push can reach production with zero technical review), the thin e2e coverage on checkout/live/moderation (the flows where a regression is most expensive), and the fact that live/manual QA hasn't verified the flagship flows in this pass.
2. **Is the application user-friendly for first-time users?** Mostly — the consumer web experience (feed, watch, virtualized scroll, skeleton states) is genuinely well-built. The biggest first-session gap is the missing cold-start onboarding step, which also weakens personalization exactly when it matters most.
3. **Is the application optimized for performance?** Backend: yes, largely (proper indexing, caching, queue/retry/DLQ discipline). One real exception: the self-hosted ffmpeg transcode path shares a general worker process with every other queue. Frontend: yes on the consumer web app (real virtualization, ISR, self-hosted fonts); mobile foundation is solid (HLS, resumable uploads) but 71% of screens bypass the intended architecture.
4. **Is the architecture scalable?** Mostly, with two concrete debts that will compound: the `CommunitiesService`/`EntitlementsService` god objects and the `Billing⇄Entitlements` circular dependency both make safe, fast iteration harder as the team and codebase grow, independent of raw traffic scale.
5. **Is the backend production-ready?** Yes — this is the strongest-scoring domain along with database and security. The gaps found (API versioning, `reports` index, pagination consistency) are real but none are launch-blocking at current scale.
6. **Is the mobile experience excellent?** The underlying plumbing (security, networking, offline cache, video, uploads) is excellent. The user-facing experience is held back by accessibility (zero `Semantics`, near-zero icon labels) and architecture debt (raw HTTP in 71% of screens) that doesn't crash the app today but will slow every future feature.
7. **Is the admin panel efficient for administrators?** Partially. The unified triage queue (approvals/reports/fraud in one severity-ranked list) is genuinely good product thinking. But several fully-built API features (channel points, mentorship, course moderation) have no admin surface at all, forcing raw-DB intervention for real trust-and-safety work.
8. **What are the top risks before launch?** (1) No branch protection on `main`. (2) Untested revenue/live/moderation flows. (3) The two backend god objects and their circular dependency. (4) Accessibility gaps across web and mobile. (5) The self-hosted video-transcode worker-pool contention risk under real upload volume.
9. **What are the top opportunities to make this a market-leading product?** Feedback-loop-driven personalization with a cold-start onboarding step (cheapest, highest-leverage lever found); shipping the already-built podcasts feature to the web; closing the admin-oversight gap on channel points/mentorship/courses; semantic search once catalog size justifies it.
10. **If you owned this product, what would you change first?** Branch-protect `main` today (15 minutes, closes the largest single risk in this entire audit), then spend the next sprint on the `CommunitiesService` split and Playwright coverage for checkout/upload/moderation — in that order, because they compound: every subsequent change to the platform's most central module and its most valuable flows gets safer once those two land.

---

*Synthesized 2026-07-26 from 7 independent parallel domain audits. This document supersedes nothing in `docs/audits/` — it stands alongside the 2026-07-22/07-26 audit lineage as a fresh, independent cross-check per explicit user request. Where findings overlap with prior audits, that overlap is evidence a finding is still open, not a rediscovery artifact.*
