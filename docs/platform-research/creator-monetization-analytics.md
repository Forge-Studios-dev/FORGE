# Platform Research — Creator Monetization & Analytics

> **Historical (Aug 2026).** Framing tension below is **closed** (ADR-001 skill-first; ADR-005 no ads). Not SSOT.
>
> Domain slug: `creator-monetization-analytics`
> Covers: ads, memberships/subscriptions, tips (Super Chat/Super Thanks), courses, creator analytics dashboards & KPI definitions, payouts, membership tiers & entitlements.
> Written per `forge-youtube-replica.md`: functionality/UX patterns only — no YouTube trademarks, branding, or proprietary internals restated here.

---

## 0. The framing tension (read first)

`docs/FORGE_PROJECT_MASTER.md` §1 (Executive summary, line 12) still describes FORGE as:

> "a skill-first creator platform: on-demand lessons, live teaching, categories/skill tags, communities, and mock memberships"

This directly conflicts with `.claude/rules/forge-youtube-replica.md`, which mandates a **faithful YouTube replica** — channels, videos, subscriptions, memberships, live, communities tab — and says any existing FORGE behavior that diverges from YouTube's model should be **removed or refactored toward YouTube**, not extended as "FORGE-unique."

The good news: **the codebase has already partially resolved this**, ahead of the docs. `apps/api/src/common/features/skill-economy-lms.ts`:

```ts
/**
 * Skill-economy LMS (courses / podcasts / programs).
 * Default OFF for YouTube-replica mode. Opt in with FEATURES_SKILL_ECONOMY_LMS=true.
 */
export function isSkillEconomyLmsEnabled(): boolean {
  return process.env.FEATURES_SKILL_ECONOMY_LMS === 'true';
}
```

`CommunityAnalyticsService.getCreatorBusinessAnalytics()` (`apps/api/src/modules/communities/community-analytics.service.ts:121`) branches on this flag: with it off (the default), the engagement-score funnel is **chat 55% + posts 45%** and there is no "course enrolled" stage; with it on, courses/XP are folded back in (chat 40% + posts 30% + course enrollments 30%).

**So the code's default posture is already YouTube-parity-first**, gating courses/XP/mentorship behind an explicit opt-in flag. But:

- `FORGE_PROJECT_MASTER.md`'s executive summary still leads with the skill-platform framing, not the flag-gated default.
- `docs/CREATOR_DASHBOARD_WIREFRAMES.md` and `docs/CREATOR_KPI_DEFINITIONS.md` (this domain's own docs) present the LMS-on view (Membership Funnel with "Course enrolled," Engagement Score weights including courses, "Course completion rate" industry benchmark) as if it were the only/default behavior, without noting it's flag-gated and off by default.
- `docs/MEMBERSHIPS.md` and the API route catalog (`FORGE_PROJECT_MASTER.md` §20) still expose `CreatorBundlesController`/`creator_bundles` (a bundle-of-resources concept resembling course/product bundles) only when the flag is on — consistent, but undocumented as conditional anywhere in this domain's docs.

**This document does not resolve the tension** (per task instructions) — it is surfaced explicitly in `conflictsWithOtherDocsOrRules` below, and the gap analysis treats "align docs with the flag's default-off YouTube-parity posture" as a documentation-fix recommendation, not a code change.

---

## 1. Overview & scope

This domain is everything that lets a creator earn money and understand their channel's performance:

1. **Monetization models**: paid channel memberships (subscription tiers), one-off tips (Super Chat during live, Super Thanks on VOD), paid live events/tickets, and — not yet built — advertising revenue.
2. **Payouts**: how money moves from viewer → platform → creator, including platform fee, Stripe Connect, and reconciliation.
3. **Entitlements**: what a paid tier actually unlocks (VOD, live, community channels, bundles).
4. **Creator analytics**: Studio-facing dashboards — revenue, membership/engagement KPIs, content performance, live-stream analytics — and the KPI definitions that back them.
5. **Courses** (flag-gated, `FEATURES_SKILL_ECONOMY_LMS`): enrollment counts feed into engagement KPIs when enabled; full course CRUD/LMS mechanics are out of this domain's primary scope but the flag boundary matters for every KPI/analytics number below.

Out of scope for this doc: video upload/transcode pipeline, feed ranking, moderation (covered by other domain docs).

---

## 2. YouTube reference model

### 2.1 Monetization eligibility gate

YouTube does not let every channel monetize immediately. The Partner Program (YPP) gates access by tiered thresholds:

- **500 subscribers** + (3,000 public watch hours in the last 12 months **or** 3M Shorts views in 90 days) → "limited" tier: channel memberships, Super Chat/Super Thanks, Shopping.
- **1,000 subscribers** + (4,000 watch hours/12mo **or** 10M Shorts views/90 days) → full tier: adds AdSense ad revenue.
- Additional gates: no active Community Guidelines strikes, 2‑Step Verification on the account, residency in an eligible country, original/advertiser-safe content.

This is a **graduated, metric-driven eligibility system**, not a single binary "approved creator" flag.

### 2.2 Revenue streams and how they're split

| Stream | Mechanism | Typical split to creator |
|---|---|---|
| Ad revenue | Pre-roll/mid-roll/display/overlay ads served against a video; revenue pooled and divided by watch-time-weighted ad impressions | ~55% creator / 45% platform (video ads) |
| Channel memberships | Recurring monthly tiers ($1.99–$49.99), up to 6 levels, 1–5 perks per level; perks include custom loyalty badges that *evolve* with tenure (1mo/2mo/6mo/1yr/2yr), custom emoji, members-only posts/videos/streams | ~70% creator / 30% platform |
| Super Chat / Super Thanks | One-time tip during live chat (Super Chat, pinned/highlighted by amount) or on VOD (Super Thanks, plays a small animation) | ~70% creator / 30% platform |
| Channel Store / Shopping | Merch shelf | Varies |

Revenue-per-mille (**RPM**) is the creator-facing composite metric: total revenue (ads + memberships + Super Thanks + Premium revenue share) per 1,000 views, i.e. what a creator actually nets — distinct from **CPM**, which is what advertisers pay before the platform's cut. Studio analytics reports both.

### 2.3 Analytics dashboard structure

The creator-facing analytics surface is organized into four tabs, each with its own metric family:

- **Reach**: impressions, click-through rate, views, unique viewers, traffic source breakdown.
- **Engagement**: watch time, average view duration, average percentage viewed, likes/comments/shares.
- **Audience**: returning vs. new viewers, subscriber growth, geography, device type.
- **Revenue**: estimated revenue, RPM, CPM, ad types breakdown, playback-based CPM, monetized playbacks.

Data has a known, disclosed lag: general engagement metrics ~48 hours behind real-time; revenue metrics ~24–72 hours behind (ad network settlement + fraud/click-invalidation windows). A **live** view exists for concurrent viewers during a stream, separate from the lagged historical dashboard.

### 2.4 Payout mechanics

- Payout threshold (commonly $100 equivalent) before a payout is issued.
- Monthly payout cycle, ~21st of the month for the prior month's finalized earnings, net of ad-fraud/dispute holds.
- Tax form collection (e.g., US: W-9/W-8BEN equivalent) required before payouts start; withholding applied absent a tax treaty.
- Multi-currency payout via linked payment processor account, verified via identity/bank verification flow.

### 2.5 Edge cases / failure modes YouTube's model has to handle

- **Content ID / rights claims** reassigning ad revenue mid-flight (a claimed video's ad revenue can go to the claimant, partially or fully).
- **Ad-invalid traffic** clawbacks after payout (fraud detection retroactively voids earnings).
- **Demonetization / limited ads** on a specific video (advertiser-unfriendly content) without de-monetizing the whole channel.
- **Membership perk downgrade/removal**: existing members grandfathered at prior perks for some window when a creator changes tiers.
- **Refunded Super Chat/membership** (chargeback) after the creator has already been paid — requires a clawback or negative-balance carry mechanism.
- **Multi-channel networks / brand deals** revenue sitting outside the core RPM pipeline entirely (out of scope here, noted for completeness).
- **Scale**: revenue aggregation must be near-real-time-safe at billions of playback events/day — implemies event-sourced, idempotent ingestion with async settlement, never synchronous per-view billing writes.

### 2.6 Secondary-platform notes (where they diverge usefully)

- **Twitch**: subscriptions ($4.99/$9.99/$24.99 fixed tiers) pay a flatter, often better creator split at scale via "affiliate"/"partner" tiers; **Bits** (micro-tip currency) decouple the tip amount from real currency, simplifying chat-tip UX versus YouTube's real-currency Super Chat. Worth considering: a virtual-currency tip abstraction (buy credits once, spend across many creators) reduces per-tip payment friction versus a full checkout each time — FORGE's current Super Chat/Super Thanks both go through a fresh Stripe Checkout session per tip, which is closer to YouTube's model than Twitch's Bits model, and is the right choice for parity but worth noting as a scalability/UX tradeoff (checkout latency on live chat vs. pre-funded balance).
- **Patreon**: unlimited tiers, direct patron email/export ("audience portability" — a patron list a creator can take off-platform), lower platform fee (5–12%) than YouTube's membership cut. FORGE currently has **no member-list export for creators** (no "download your members' contact info" flow) — worth flagging as a gap if member portability matters for creator trust, independent of the YouTube-parity question (YouTube itself doesn't offer this either, so it is *not* required for parity, but is worth an explicit product decision).
- **Vimeo**: creator payouts are usage/tip based (Vimeo On Demand rentals/sales) rather than ad-supported — not directly relevant since FORGE is pursuing the ad+membership YouTube model, not the pay-per-video model.

---

## 3. Current FORGE state (ground-truthed against code)

### 3.1 Docs reviewed

| Doc | Claims | Currency vs. code |
|---|---|---|
| `docs/phases/14-monetization/PHASE_14_MONETIZATION.md` | "Complete for viewer/creator voice + existing Stripe stack"; membership tiers + Connect checkout/portal shipped; ad platform and tip jar/Super Thanks-for-VOD marked **deferred** | **Outdated**: Super Thanks for VOD is fully implemented (`billing.controller.ts` `POST /billing/checkout/super-thanks`, `super_thanks` table/migration, mobile `StudioSuperThanksScreen`) — contradicts the "deferred" note in the same doc's own report file, which says "Super Thanks checkout... verified." Ad platform genuinely absent (confirmed: no `AdsModule`/ad-serving code anywhere in `apps/api/src`). |
| `docs/phases/14-monetization/PHASE_14_REPORT.md` | ~90% complete; Super Thanks ledger/CSV/summary verified; ad platform deferred | Consistent with code. The two Phase 14 files contradict each other on Super Thanks status — internal doc inconsistency. |
| `docs/phases/16-analytics/PHASE_16_ANALYTICS.md` | Creator + business analytics + stream analytics/health + admin analytics events present; real-time Studio charts parity with YouTube deferred | Consistent with code — `AnalyticsModule`, `KpiService`, `CommunityAnalyticsService.getCreatorBusinessAnalytics` all exist and are wired. |
| `docs/phases/16-analytics/PHASE_16_REPORT.md` | ~65% complete | No detail to verify against; too terse to ground-truth. |
| `docs/CREATOR_DASHBOARD_WIREFRAMES.md` | Studio Home shows MRR/Subs/Churn, Engagement Score, **Membership Funnel with "Course enrolled"** stage, Revenue detail with course-sale line item, AI Copilot insights widget | Funnel/course stage only render when `FEATURES_SKILL_ECONOMY_LMS=true` (confirmed in `getCreatorBusinessAnalytics`) — doc doesn't say this is conditional. "Course sales → $2,400" line item in the Revenue Detail wireframe has **no backing code path found** — no course-purchase revenue aggregation exists in `getCreatorBusinessAnalytics`'s `revenue` object (only `mrr`, `arr`, `liveEvents30d`). This line item appears aspirational/stale. |
| `docs/CREATOR_KPI_DEFINITIONS.md` | Full KPI table incl. MRR/ARR, churn, engagement score (chat 40%+posts 30%+courses 30%), XP thresholds, industry benchmarks incl. "Course completion rate" | Engagement score weights **only match the LMS-enabled branch**; default (LMS off) is chat 55%+posts 45% per code — doc presents only one branch as the definition, silently. "Trial Conversion" and "Lesson Completion" both correctly flagged "Future"/"not yet tracked" in the doc — accurate. |
| `docs/MEMBERSHIPS.md` | Tiers, Stripe Connect destination charges w/ platform fee, entitlements, subscription lifecycle incl. trial/grace_period/dunning, access-session device caps | **Accurate and detailed** — verified against `billing.service.ts` (platform fee calc, `creatorNetCents`), `entitlements.module.ts`, `stripe-connect.service.ts` (Express onboarding, `charges_enabled`/`payouts_enabled` status). This is the most reliable doc in the domain. |

### 3.2 Code modules ground-truthed

- `apps/api/src/modules/entitlements/` — `EntitlementsModule`, `EntitlementsService`, `EntitlementsAnalyticsService`, `SubscriptionTier`, `MemberSubscription`, `TierEntitlement`, `CreatorBundle`/`CreatorBundleItem` (bundle CRUD gated behind `isSkillEconomyLmsEnabled()` at the controller-registration level, not just data-level).
- `apps/api/src/modules/billing/` — `BillingController`/`BillingService`, `StripeConnectService` (Express account creation, onboarding links, `charges_enabled`/`payouts_enabled` status), `SubscriptionChangeService` (tier change with proration), `SuperThanks` entity + migration `1910000000000-super-thanks-ledger.ts`, platform fee computation (`platformFeeCents`, `creatorNetCents` on every charge).
- `apps/api/src/modules/stream-chat/` — `SendSuperChatDto`/`sendSuperChat` — live Super Chat, capped at $1,000/msg, charged via Stripe Checkout with the user's own payment method (not a pre-funded balance).
- `apps/api/src/modules/analytics/` — `AnalyticsModule`, `KpiService` (platform-level churn/engagement dashboards, distinct from the per-creator `CommunityAnalyticsService`), `AnalyticsRetentionService`/scheduler for event retention.
- `apps/api/src/modules/communities/community-analytics.service.ts` — `getCreatorBusinessAnalytics` (the actual engine behind the Studio dashboard and CSV export), `getCreatorAttention` ("today" action queue — comments, moderation, failed payments, processing failures, scheduled videos), `getCreatorBusinessAnalyticsCsv`.
- `apps/api/src/common/features/skill-economy-lms.ts` — the flag gating courses/XP/bundles, default off.
- `apps/api/src/modules/courses/` — exists (not deep-read; flag-gated consumer of engagement KPIs confirmed above).
- Mobile: `apps/mobile/lib/features/studio/presentation/studio_super_thanks_screen.dart` (Super Thanks received list + CSV export via `CsvExportUtil`), sibling `studio_analytics_screen.dart`, `studio_subscribers_screen.dart`, `studio_community_screen.dart` also CSV-export capable.
- No `AdsModule`, no ad-serving/ad-break/ad-impression entities anywhere in `apps/api/src` — confirmed via grep across the codebase. Ads are entirely unimplemented, matching the "ad platform deferred" note.
- No payout-ledger/1099/tax-form module beyond `StripeConnectService.getConnectStatus`/`createOnboardingLink` — payouts are entirely delegated to Stripe Connect's own payout schedule to the Express account; FORGE has no independent payout reconciliation ledger (Super Thanks summary/export exists for *creator-facing* reconciliation, but nothing platform-side for finance ops).

---

## 4. Gap analysis

| Gap | Severity | Current state | Target state | Recommendation |
|---|---|---|---|---|
| No ad revenue model at all | High (blocks core YouTube parity — ads are YouTube's primary revenue stream) | No `AdsModule`, no ad-break/impression entities, no RPM/CPM metrics | Pre-roll/mid-roll ad slots on VOD, RPM/CPM in Studio analytics, ad revenue share in payout ledger | Scope as its own phase: (1) ad-serving integration (own ad network or a real ad-tech partner — do not fabricate ad inventory), (2) `ad_impressions`/`ad_revenue_events` tables, (3) RPM computed alongside existing MRR/ARR in `getCreatorBusinessAnalytics`. This is large; sequence after membership/tips are fully hardened. |
| Doc/code mismatch: LMS-gated KPIs presented as unconditional | Medium | `CREATOR_KPI_DEFINITIONS.md` and `CREATOR_DASHBOARD_WIREFRAMES.md` show the `FEATURES_SKILL_ECONOMY_LMS=true` branch (courses, XP-weighted engagement score) as *the* definition, with no mention of the default-off flag or the alternate chat-55%/posts-45% formula | Docs state both branches explicitly, tied to the flag | Add a "Flag: `FEATURES_SKILL_ECONOMY_LMS`" callout at the top of both docs; show both engagement-score formulas side by side. |
| Executive summary framing ("skill-first creator platform... mock memberships") contradicts both `forge-youtube-replica.md` and the code's own default posture | High (product-direction conflict, not a code bug) | `FORGE_PROJECT_MASTER.md` §1 | Framing consistent with YouTube-replica mandate as the default, skill-economy as an explicit opt-in extension | **Do not silently resolve** — flag for product/eng decision (see conflicts section). If resolved toward YouTube parity, update §1's executive summary to lead with channels/videos/memberships/live, mention skill-economy LMS as an optional module. |
| "Mock memberships" language is stale | Low | `FORGE_PROJECT_MASTER.md` §1 calls memberships "mock" | Memberships are described accurately | Memberships have a real Stripe Connect path with destination charges, platform fees, dunning, and access-session device caps — "mock" only describes the `BILLING_PROVIDER=stub` dev fallback. Update wording so the executive summary doesn't undersell (or mismeasure) monetization maturity. |
| Course-sale revenue line item in wireframes has no backing implementation | Medium | `CREATOR_DASHBOARD_WIREFRAMES.md` Revenue Detail panel shows "Course sales → $2,400"; `getCreatorBusinessAnalytics().revenue` only has `mrr`/`arr`/`liveEvents30d` | Either build course-purchase revenue aggregation (if skill-economy stays) or remove the line item | Given the YouTube-parity mandate, recommend removing rather than building — course sales are not a YouTube revenue stream. |
| No graduated monetization eligibility (YPP-style) | Medium | Any creator passing `CreatorApprovedGuard` can create tiers/collect tips/go live-monetized; no subscriber/watch-hour threshold gating specifically for monetization (as distinct from general creator approval) | Tiered eligibility: baseline creator approval unlocks nothing monetizable; a separate monetization-eligibility check (subscriber count + watch hours, computed from existing `videos`/`view_count`/subscription data) gates memberships/tips/(future) ads | Add a `MonetizationEligibilityService` computing eligibility from existing view/subscriber data; gate `POST /creators/me/tiers` and Super Chat/Thanks behind it. Avoids one creator with zero audience immediately monetizing — matches YouTube and reduces abuse surface. |
| No membership loyalty badges tied to tenure | Low–Medium | Gamification badges exist (streak-based, `Week Warrior`/`Centurion` etc.) but are **not** tied to membership duration; no visual badge in chat/comments for "member for N months" | Tenure-based loyalty badge (1/2/6/12/24 months) surfaced next to username in chat/comments for members | Add `memberSince`/tenure computation off `member_subscriptions.createdAt` (already tracked) and a lightweight badge renderer reusing the existing gamification badge UI components — no new backend entity needed beyond a derived field. |
| No creator-side payout reconciliation ledger beyond Super Thanks | Medium | Membership/tip payouts flow entirely through Stripe Connect's own payout schedule; FORGE has no unified `payouts` table joining membership + Super Thanks + (future) live-event + ad revenue into one statement | Single "Payouts" Studio surface: period, gross, platform fee, net, payout status, matching what actually lands in the creator's bank account | Add a `creator_payout_periods` aggregation view/table (materialized nightly) joining `member_subscriptions` revenue events, `super_thanks`, `stream_event_purchases`; expose `GET /creators/me/payouts`. Needed before ads is even worth adding (ads make manual reconciliation worse, not better). |
| Refund/chargeback clawback path undocumented | Medium (financial correctness) | `billing.service.ts` computes `creatorNetCents` at charge time; no doc or (from what was ground-truthed) code path found reversing `creatorNetCents`/updating a payout ledger on Stripe `charge.refunded`/`charge.dispute.created` webhooks | Refund/dispute webhook handling reverses the creator's net earnings in the (not-yet-built) payout ledger, or — if using pure Connect destination charges — confirm Stripe's own reversal on the connected account is sufficient and document that explicitly | Verify `billing.service.ts` webhook handler list actually includes `charge.refunded`/`charge.dispute.created`. If it doesn't, this is a **financial-correctness gap**, not just a docs gap — recommend a follow-up code audit (may be a separate blast-radius investigation, not a doc-only fix). |
| No member-list export/portability for creators | Low | No endpoint found for a creator to export their paying members' contact info | N/A for strict YouTube parity (YouTube doesn't offer this either) | Not a parity gap — flag as an explicit product decision (differentiator vs. Patreon) rather than a defect. |
| Internal doc self-contradiction | Low | `PHASE_14_MONETIZATION.md` lists Super Thanks-for-VOD as "Deferred" while `PHASE_14_REPORT.md` (same phase) says it was "verified" | One source of truth | Fix `PHASE_14_MONETIZATION.md`'s Deferred section — Super Thanks for VOD is shipped. |
| Analytics data-lag / real-time vs. batch not documented | Low | `CREATOR_DASHBOARD_WIREFRAMES.md` says "5-minute stale time" for React Query and real-time Socket.IO only for live viewer count; no doc states whether `getCreatorBusinessAnalytics` numbers are computed live-on-request (they are — it's a live query, not a materialized snapshot) | Explicit doc statement of freshness/latency per KPI, and a plan for materializing once query volume grows | `getCreatorBusinessAnalytics` runs multiple raw SQL aggregate queries live per request — fine at current scale, but flag as a scaling watch-item (see open questions). |

---

## 5. Recommended flows / data model / API additions

These are scoped to be implementable incrementally without re-architecting the existing (solid) entitlements/billing foundation.

### 5.1 Monetization eligibility gate

**New service**: `apps/api/src/modules/entitlements/monetization-eligibility.service.ts`

```ts
interface MonetizationEligibility {
  eligible: boolean;
  reasons: string[]; // human-readable blockers
  metrics: { subscriberCount: number; watchHours90d: number };
  thresholds: { minSubscribers: number; minWatchHours: number };
}
```

- Compute `subscriberCount` from existing subscription/follow tables; `watchHours90d` from existing `view_count`/watch-session aggregation (already used for `Watch Rate` KPI).
- Config-driven thresholds (env-overridable, so staging/dev can lower them) — do not hardcode YouTube's exact numbers as a legal/product commitment, treat them as a *reference default*.
- Gate: `POST /creators/me/tiers`, `POST /billing/checkout/super-thanks`, `POST billing/checkout` (membership) all check eligibility first; return a typed 403 (`MONETIZATION_NOT_ELIGIBLE`) with `reasons` so Studio UI can render "3 more subscribers needed" style messaging.
- New endpoint: `GET /creators/me/monetization/eligibility`.

### 5.2 Payout ledger / reconciliation

**New table** `creator_payout_ledger_entries`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| creator_id | uuid fk users | |
| source_type | enum(`membership`,`super_thanks`,`super_chat`,`live_event`,`ad_revenue`) | extensible for future ad revenue |
| source_id | uuid | fk to the originating row (subscription payment, super_thanks id, etc.) |
| gross_cents | int | |
| platform_fee_cents | int | |
| net_cents | int | |
| currency | varchar(3) | |
| status | enum(`pending`,`settled`,`reversed`) | `reversed` on refund/dispute webhook |
| occurred_at | timestamptz | |
| settled_at | timestamptz nullable | when Stripe Connect actually paid it out |

- Populate via existing webhook handlers (`billing.service.ts` `handleWebhook`) — write one ledger row per successful charge/subscription-invoice-paid event, and flip to `reversed` on `charge.refunded`/`charge.dispute.created`/`invoice.payment_failed`-after-payout.
- New endpoint: `GET /creators/me/payouts?period=` — aggregates by period, mirrors the existing Super Thanks summary/export pattern (`summarizeReceivedSuperThanks`, `exportReceivedSuperThanksCsv`) but unified across all monetization sources.
- This directly answers "what actually lands in my bank account," which today requires a creator to manually add up three separate surfaces (Memberships MRR, Super Thanks summary, Stripe dashboard).

### 5.3 Membership tenure badges

- Derive from existing `member_subscriptions.createdAt` — no new table needed for MVP. Compute tenure bucket (1/2/6/12/24 months) at read time in comment/chat serialization, same place `EngagementModule`/gamification badges are already rendered.
- If perf requires it later, materialize `member_tenure_months` on a nightly job — not needed at current scale (same caution as engagement score computation below).

### 5.4 Analytics/KPI doc-code alignment (documentation-only, no schema change)

- Add explicit flag callouts to `CREATOR_KPI_DEFINITIONS.md` and `CREATOR_DASHBOARD_WIREFRAMES.md`.
- Document both engagement-score formulas (LMS on/off) side by side, sourced verbatim from `community-analytics.service.ts` comment at the `engagementScore` computation.
- Remove or explicitly mark speculative the "Course sales → $2,400" revenue line in the wireframes doc.

### 5.5 Ads (future phase — sequencing note only, not a build spec here)

Given severity/effort, ads should be its own follow-up research/planning doc once memberships+tips+payouts are hardened (5.1–5.2 above). Minimum shape to anticipate now so the schema doesn't need rework later:
- `ad_impressions` (video_id, viewer_session_id, ad_break_position, served_at) — append-only, high-volume, should go through the same BullMQ ingestion pattern as `AnalyticsModule`'s existing `ANALYTICS_INGEST_QUEUE`, not synchronous request-path writes.
- `ad_revenue_events` (settled asynchronously, likely batch-imported from whatever ad network is chosen — do not attempt to simulate real ad auctions in-house).
- RPM added to `getCreatorBusinessAnalytics().revenue` once ad revenue exists.

---

## 6. Assumptions & open questions

**Assumptions made in this document:**
- "Faithful YouTube replica" (per `forge-youtube-replica.md`) is the standing product mandate, so the gap analysis treats YouTube's model as primary/target and treats skill-economy-only features as extensions requiring explicit justification, not defaults.
- The `FEATURES_SKILL_ECONOMY_LMS` flag's default-off state is intentional evidence of the intended direction, not an oversight — this document takes it as the strongest signal in the repo of the direction leadership actually wants, stronger than the stale executive summary.
- Reference eligibility thresholds (subscribers/watch-hours) are described as YouTube's public program structure for engineering-grounding purposes only; FORGE's actual thresholds should be a product decision, not a copy of YouTube's exact numbers (which are also policy, not just tech).

**Open questions (not resolved here, need product/eng decision):**
1. **The core tension**: should `FORGE_PROJECT_MASTER.md`'s executive summary be rewritten to lead with YouTube parity (channels/videos/memberships/live), demoting courses/cohorts/quizzes/certificates/mentorship/channel-points to an explicitly optional, flagged module? Or is the skill-platform framing the actual current product direction, with `forge-youtube-replica.md` itself needing revision? This document cannot decide that; it is a rule-vs-rule conflict for the user/product owner.
2. Is real ad-serving in scope at all for FORGE, or is "ads" intentionally deferred indefinitely (e.g., for legal/partnership reasons), in which case RPM/CPM parity should be explicitly marked "not applicable" rather than "gap"?
3. Should monetization eligibility thresholds be enforced at all, or is FORGE deliberately more permissive than YouTube (any approved creator can monetize immediately) as a product choice to reduce creator friction?
4. Does the refund/dispute webhook path already reverse creator earnings correctly? This document flagged it as unverified from the code read performed — needs a dedicated, deeper check (git blame / full `billing.service.ts` webhook switch statement read) before treating it as either confirmed-fine or confirmed-broken.
5. At what request volume does `getCreatorBusinessAnalytics`'s live multi-query aggregation need to move to a materialized/cached snapshot? No current doc sets a threshold; flagging as a scaling watch-item rather than a present-day defect given `forge-core.md`'s "don't over-build for hypothetical load" guidance.
6. Should `creator_bundles` (currently flag-gated, courses-adjacent) be repurposed as a YouTube-parity concept (e.g., "membership perks bundle") rather than removed, if the skill-economy flag is ultimately turned off permanently?

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
