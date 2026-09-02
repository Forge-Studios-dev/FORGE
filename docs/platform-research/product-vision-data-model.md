# Platform Research — Product Vision, Personas & Core Data Model

**Slug:** `product-vision-data-model`
**Audience:** Engineering (API/web/mobile), product, docs maintainers.
**Status:** Research/gap-analysis for a documentation overhaul. Not a shipped spec — recommendations require product sign-off, especially where they touch the YouTube-parity-vs-skill-economy tension (see §5).

---

## 1. Overview & scope

This domain covers the identity and content-ownership backbone of FORGE:

- Registration / login (email+password, Google OAuth), email verification, password reset, session/device management.
- Creator onboarding: requesting creator access, admin approval gate, rejection/re-application.
- Profile / "channel" identity: display name, handle (username), avatar, banner, bio, links.
- Core entities and their relationships: `User`, `Follow` (subscription), `Video`, `Channel` (community chat channel — **not** the YouTube sense, see §4.3), `Community`, `Playlist`.
- Product vision/scope as stated across FORGE's docs, and where that vision conflicts with the `forge-youtube-replica` mandate.
- Personas and primary use cases (viewer, creator, admin — and the disputed "learner/mentor/community-member" personas from the Creator-Economy-OS framing).

Out of scope (covered by sibling domains): video upload/transcode pipeline internals, live streaming, monetization/billing internals, community rooms/posts/gamification mechanics, moderation/trust & safety workflows. This doc touches those only where they intersect account/channel identity.

---

## 2. YouTube reference model

### 2.1 Identity: Google Account → Channel

YouTube's actual model separates **the identity you sign in with** from **the channel that owns content**:

- Every Google Account gets one **personal channel** automatically, named after the Google Account by default.
- A **Brand Account** is a separate identity, still tied to a Google Account for sign-in, but structurally independent: it can be renamed independently, have multiple **Owners/Managers** (role-based access, no password sharing), and ownership can be transferred without losing subscribers, watch history, or channel history.
- A single Google Account can create/manage **multiple channels** (one personal + many Brand-Account channels), each with independent subscribers, uploads, and playlists.
- Channel identity fields: channel name, handle (`@handle`, globally unique, renameable with cooldown), description ("About"), links, avatar, banner, "channel keywords" (legacy SEO field), country, and a machine `channelId` distinct from any user id.

Source: Google/YouTube Brand Account documentation (see search summary in this research; no single canonical URL cited by Google beyond Help Center pages).

### 2.2 Sign-up / onboarding flow

1. **Account creation** — via Google Account (no separate FORGE-style "signup form"; YouTube piggybacks on Google identity, so there is no email/password specific to YouTube, no email-verification step, no disposable-email or reserved-username checks — those all happen at the Google Account layer, not YouTube's).
2. **First-run** — country/date-of-birth confirmation (already collected by Google, but YouTube re-confirms for content-rating purposes), interest picker (topics) for cold-start recommendations, and a lightweight "create your channel" step that is really just accepting the auto-provisioned default channel name/handle.
3. **No approval gate.** Anyone can upload immediately. Trust is established *after the fact* through automated content ID / policy scanning, and monetization is a separate, later-earned gate (see 2.4). This is a structural difference from FORGE's current admin-approval-before-any-upload model (see §6).
4. **Channel customization** (optional, later): banner, layout of tabs (Home/Videos/Shorts/Live/Playlists/Community/About), featured video/channel trailer for non-subscribers, section ordering, "channels" links to other creators.

### 2.3 Subscriptions (the "Follow" analog)

- A **Subscription** is a one-directional edge: `subscriber -> channel`. No mutual-follow concept, no request/approve step for a normal channel (private/unlisted differs).
- Each subscriber has a **notification bell level**: All / Personalized (default) / None — this maps almost exactly to FORGE's `FollowNotifyLevel` enum (`all`/`personalized`/`none`) already implemented in `apps/api/src/modules/engagement/entities/follow.entity.ts`. This is a rare case where FORGE code is already at full parity.
- Subscriber count is periodically "fuzzed"/rounded for privacy/anti-spam at high volumes; churn (unsubscribe) is tracked internally for the Partner dashboard but not exposed publicly beyond the aggregate.
- Subscriptions feed a dedicated "Subscriptions" surface (chronological, not algorithmic) as well as feeding signal into the algorithmic Home feed.

### 2.4 Creator ("Partner") status is a monetization gate, not an upload gate

This is the single most important structural difference from FORGE's current model:

- **Uploading and going live require no approval at all.** Every account is a "creator" from account creation.
- **Monetization (YouTube Partner Program)** is the only gated tier, and it is criteria-based, not manually reviewed per applicant up front:
  - Standard tier: **1,000 subscribers** + **4,000 public watch hours in the trailing 12 months**, OR **10M valid Shorts views in the trailing 90 days**.
  - Early-access tier (2023+): **500 subscribers** + **3 public uploads in 90 days** + **3,000 watch hours in 12 months** (or 3M Shorts views/90 days) — grants channel memberships, Super Chat, Shopping, but not ad revenue.
  - Additional gates: two-factor/2-step verification enabled, no active Community Guidelines strikes, residency in an eligible country, and a policy-compliance review (automated + human) before ads actually turn on.
  - Revenue share: ~55% creator / 45% platform on standard ad revenue, 45%/55% on Shorts.
- Non-monetary creator actions (uploading, going live, posting Community-tab content, running polls) are **not** blocked on this review.

### 2.5 Data & APIs involved (for reference — not literal endpoints to copy 1:1)

- `channels.list` / `channels.update` (YouTube Data API v3) — channel resource has `snippet` (title, description, thumbnails, customUrl), `statistics` (viewCount, subscriberCount, videoCount — subscriberCount roundable/hidden), `brandingSettings` (banner, keywords), `contentOwnerDetails` (multi-channel network context).
- `subscriptions.list/insert/delete` — subscriber-to-channel edges, with `subscriberSnippet` denormalized for display.
- Channel handle uniqueness and rename cooldown are enforced server-side; FORGE already has an equivalent (`usernameChangedAt`, `username_history` table cleared on reclaim) which is good parity.

### 2.6 Failure modes / edge cases YouTube explicitly handles that are worth enumerating

- Username/handle squatting and reclaim after rename (**FORGE has this** — `username_history` table, deletion on reclaim in `auth.service.ts` signup/OAuth paths).
- Terminated/suspended channel handle release after a grace period.
- Channel transfer (Brand Account ownership transfer) without breaking subscriber relationships, video IDs, or playlist IDs.
- Multiple managers per channel with different permission levels (Owner / Manager / Communications Manager) — **FORGE has no equivalent**; FORGE's `User` *is* the channel, 1:1, with a single `role` enum (`user`/`creator`/`admin`).
- Blocked/blocking user cannot view each other's channel (**FORGE has this** — `EngagementService.isBlockedEitherWay` gates `GET /users/:id`, `GET /users/by-username/:username`, per `apps/api/src/modules/users/users.controller.ts`).
- Self-referential subscription (subscribing to your own channel) — blocked.
- Deleted/deactivated account: content orphaning policy (video stays up under "Deleted user" placeholder for X period, or removed depending on jurisdiction/DMCA obligations). **FORGE has a version of this** — `AdminService.deleteUser` anonymizes email/username to `deleted+...@removed.invalid` / `deleted_...` and keeps the row (soft delete via `deletedAt`), but does not appear to define what happens to the user's videos/streams/community on deletion (still owned by the anonymized row — worth confirming intentional).

### 2.7 Scalability considerations YouTube's model implies

- Subscriber counts are eventually-consistent, cached, and rounded at scale — never a live `COUNT(*)`. FORGE keeps `followerCount`/`followingCount` as denormalized counters on `User` updated at write time (fast reads, but needs reconciliation — FORGE already runs `EngagementReconciliationWorker` daily for this drift, which is good practice already in place).
- Channel/profile reads are among the hottest paths on the platform (every watch page, every comment, every subscription-feed row denormalizes channel snippet) — YouTube aggressively caches and denormalizes the channel "snippet" (name, handle, avatar) onto videos/comments at write time or via a fast cache, rather than joining `users` per-render. Worth confirming FORGE's `toPublicVideo`/`toPublicComment` mappers do the same (they do call `toPublicUser` inline per the call graph above — fine at current scale, worth a cache/denormalization pass before high QPS).

---

## 3. Secondary-platform notes

- **Twitch**: identity = single account = single channel (no Brand-Account-style multi-channel concept), but roles inside a channel are much richer than YouTube's Owner/Manager — VIPs, Moderators, Editors are per-channel granted roles with scoped permissions, closely resembling FORGE's `CommunityRoles`/moderator system already built for communities. Worth studying Twitch's per-channel role model as a better reference than YouTube's Brand Account model if FORGE ever wants multi-operator channels, since Twitch's is simpler and maps onto FORGE's existing RBAC/permissions patterns.
- **TikTok**: near-zero-friction onboarding (interest picker immediately after install, before login in some flows; "For You" cold start needs no explicit follow graph) and no manual creator-approval step — everyone can post immediately; a separate, criteria-based "Creator Rewards Program" gates monetization (analogous to YPP). Reinforces that gating **all uploading** behind manual review (FORGE's current model) is a YouTube-atypical, TikTok-atypical pattern — none of the reference platforms block basic content creation on manual admin approval.
- **Vimeo**: closer to FORGE's "gated" instinct in one respect — Vimeo historically required a paid plan or review for certain upload volumes/features, and has stronger explicit content-license/ownership metadata per video than YouTube. Not a strong model for the account/channel graph, but worth a glance if FORGE ever needs finer-grained content-licensing metadata per video.

---

## 4. Current FORGE state (grounded in code + existing docs)

### 4.1 What the docs claim

- `docs/FORGE_PROJECT_MASTER.md` §1 (executive summary, line 12): *"FORGE is a skill-first creator platform: on-demand lessons, live teaching, categories/skill tags, communities, and mock memberships."*
- `docs/CLIENT_OVERVIEW.md`: *"Skill-first platform: tutorial video, live teaching, expertise-based audiences."* Roles: `Guest → user → creator (approved) · admin`.
- `docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` and `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` (root) frame FORGE explicitly as a "Creator Economy Operating System combining the strongest capabilities of YouTube, Patreon, Discord, Circle, Kajabi, Mighty Networks, Twitch, Skillshare, Coursera, Facebook Groups, Slack Communities, Skool, Netflix, Disney+, Prime Video" (V3.0 doc, "PRIMARY OBJECTIVE"). This document's Phase 3/4/5 sections define a `Creator → Brands → Communities → Courses → Programs → Cohorts → Membership Products → Channels → Events` ownership tree that has no YouTube analog at all (Brands, Programs, Cohorts, membership-product-as-first-class-entity).
- `docs/phases/05-user-platform/PHASE_05_USER_PLATFORM.md` and `docs/phases/06-creator-platform/PHASE_06_CREATOR.md` (more recent, dated after the master docs) instead describe the goal as **"YouTube-parity viewer account"** and **"YouTube-shaped Creator Studio IA"** — i.e., these phase docs already pivoted toward YouTube parity language, contradicting the older master-doc framing.
- `.claude/rules/forge-youtube-replica.md` (project mandate): *"Prefer YouTube parity over inventing a custom video platform... if existing FORGE behavior conflicts with YouTube parity, remove or refactor toward YouTube."*
- `docs/FORGE_PROJECT_MASTER.md` §8 (design-system section, ~line 198) carries the line **"familiar video IA, distinct visual identity (not a YouTube clone)"**, cross-referencing `.cursor/rules/forge-frontend-ux.mdc` for the source rule. **Correction/re-verification note**: the rule file itself no longer contains this language — its current text (mirrored in `.claude/rules/forge-frontend-ux.md`) reads *"YouTube-replica video platform... Prefer YouTube parity over skill-learning framing in primary chrome"*, which is aligned with `forge-youtube-replica.md`, not a third, divergent framing. The master doc's §8 line is a stale leftover from before that rule was updated and should be corrected or removed when §1 is rewritten (see §6 recommendation), rather than treated as an active third voice in the conflict.

### 4.2 What the code actually does (ground truth)

- **The code has already resolved this tension in one place, quietly, without updating the docs above it:** `apps/api/src/common/features/skill-economy-lms.ts` —
  ```ts
  /**
   * Skill-economy LMS (courses / podcasts / programs).
   * Default OFF for YouTube-replica mode. Opt in with FEATURES_SKILL_ECONOMY_LMS=true.
   */
  export function isSkillEconomyLmsEnabled(): boolean {
    return process.env.FEATURES_SKILL_ECONOMY_LMS === 'true';
  }
  ```
  This flag is checked in `communities.module.ts`, `gamification.module.ts`, `gamification.listener.ts`, `community-analytics.service.ts`, and `referral.service.ts` — i.e., courses/programs/podcasts and parts of gamification are already treated in code as an **optional add-on layer on top of a YouTube-replica default**, not as the platform's core identity. This flag is **undocumented** anywhere in `docs/` (not in `FORGE_PROJECT_MASTER.md` §7 feature-flags table, not in `apps/api/.env.example`) — confirmed by grep.
- **Migration naming already tracks YouTube parity as the active initiative**: `apps/api/src/database/migrations/1850000000000-youtube-replica-wave-1.ts` (adds like/dislike reaction column, `dislike_count` on videos, system playlists `watch_later`/`liked`, playlist video ordering — all straight YouTube-parity primitives), and `docs/phases/03-database/PHASE_03_DATABASE.md` confirms migrations through "185 YoutubeReplicaWave1 → 197 WatchHistoryIndexCleanup" have been applied to production (Neon).
- **`PublicUser` mapper (`apps/api/src/modules/users/user.mapper.ts`) is mid-rename toward YouTube terminology**: `followerCount`/`followingCount` are marked `@deprecated`, with `subscriberCount`/`subscriptionCount` added as the "YouTube-facing alias." `viewerFollowing` is deprecated in favor of `viewerSubscribed`. The underlying `Follow` entity and DB columns are still `follower_count`/`following_count`/`follows` — a naming migration in progress, not finished, and entirely undocumented in `FORGE_PROJECT_MASTER.md` §12 (which still lists `follows` as the table with no note about the alias).
- **Identity = single `User` entity, 1:1 with "channel."** There is no separate `Channel`-for-content entity. `apps/api/src/modules/users/entities/user.entity.ts` carries channel-facing fields directly on `User`: `username` (the handle, unique, `usernameChangedAt` cooldown, `username_history` table for reclaim protection — good YouTube-handle parity), `displayName`, `bio`, `websiteUrl`, `channelLinks` (jsonb, max 5, per code comment), `avatarUrl`, `bannerUrl`, `followerCount`, `followingCount`, `videoCount`. This models classic (pre-Brand-Account) YouTube: one identity = one channel, no multi-manager, no channel transfer, no "create a second channel" capability.
- **A `Channel` entity does exist** (`apps/api/src/modules/communities/entities/channel.entity.ts`), but it means something entirely different: a **Discord-style text/voice channel inside a Community** (`communityId`, `categoryId`, `type`, `requiredTierId` for tier-gating). This is a **naming collision** with the YouTube sense of "channel" (a creator's public content home) that could confuse both engineers and any AI coding agent working from these docs without a disambiguation note. Recommend the docs explicitly disambiguate: "Creator Channel" (= `User`, the YouTube-parity concept) vs. "Community Channel" (= `Channel` entity, the Discord-style chat room).
- **Creator onboarding is a manual, admin-gated review — not a YouTube-model self-serve flow.** `POST /users/me/request-creator` (`UsersController.requestCreator` → `UsersService.requestCreator`, `apps/api/src/modules/users/users.service.ts:466-487`) requires `user.isVerified` (email verified) and sets `role = CREATOR`, `creatorStatus = PENDING` with an optional free-text `bio`/application note. There is **no** application of subscriber/watch-hour/upload-count criteria (unsurprising — those can't exist pre-upload) and **no automated approval path at all**: every applicant sits in `PENDING` until an admin calls `AdminService.bulkApproveCreators`/`bulkRejectCreators` (`admin.service.ts`) or the equivalent single-user admin action. Web UX: `/upload/become-creator` (3-step form: Intent → Focus → Submit, `apps/web/src/app/upload/become-creator/page.tsx`) → `/waiting-approval` → `/approval-rejected` if declined. This blocks **all** upload/live capability, not just monetization — the core structural divergence from YouTube called out in §2.4/§6 below.
- **Auth/session layer is solid and mostly YouTube/industry-standard-adjacent** (not a gap, noting for completeness): custom JWT + rotated, hashed, revoked-on-reuse-detection refresh tokens (`apps/api/src/modules/auth/auth.service.ts`), Google OAuth (account linking by email match, auto-verified), disposable-email blocking, reserved-username blocking, per-account lockout after failed logins, device/session list + login history, admin impersonation (time-boxed 120s token, hash-fragment delivery to avoid URL/log leakage), step-up re-auth (current password) required before granting the `ADMIN` role (`admin.service.ts` `assertAdminEscalationAllowed`). Documented in `docs/AUTH.md`.
- **Follow/subscription model already has bell-level parity**: `FollowNotifyLevel` enum (`ALL`/`PERSONALIZED`/`NONE`) on `apps/api/src/modules/engagement/entities/follow.entity.ts` — ahead of what the docs credit it for (`FORGE_PROJECT_MASTER.md` §12 lists `follows` with no mention of notify levels).
- **Blocking gates channel visibility** — `UsersController.findById`/`findByUsername` throw `ForbiddenException('This channel is not available')` when the viewer is blocked, with an inline comment `// YouTube parity` — direct evidence engineers are already writing YouTube-parity-aware code without the top-level docs reflecting the standard.

### 4.3 Personas as currently documented vs. implied by code

- `CLIENT_OVERVIEW.md` "Roles": `Guest → user → creator (approved) · admin` — a linear YouTube-shaped progression (visitor, signed-in viewer, approved creator, platform admin). This is a good, minimal persona set and matches YouTube's actual roles reasonably well (modulo the approval gate).
- `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` (root) implies a much larger persona set nowhere formalized: **learner** (courses), **mentor/mentee** (mentorship matching — real code: `MentorshipService`, `mentorship_profiles`, `mentorship_matches`), **community member** with per-community roles (`community_roles`), **moderator** (per-community + per-stream), **VIP tier member**, **cohort participant**. These personas exist in shipped code (Communities/Courses/Mentorship modules are ✅/⚠️ in the feature matrix) but are **not described anywhere as personas** — no doc walks through "what does a mentor do, end to end" the way a persona/use-case doc should. This is a genuine documentation gap independent of the YouTube-parity question: whichever way the parity tension resolves, the personas actually exercising the shipped code are undocumented.

---

## 5. The central conflict (surfaced, not resolved here)

Per the task brief, this is flagged rather than silently resolved:

1. **`forge-youtube-replica.md` (project rule, presumably current intent):** "faithful YouTube replica... prefer YouTube parity over inventing a custom video platform... if existing FORGE behavior ≠ YouTube, remove or refactor toward YouTube."
2. **`docs/FORGE_PROJECT_MASTER.md` §1 and `docs/CLIENT_OVERVIEW.md` (both still live, both instruct "update this file when..." / "sync on change"):** describe FORGE as a "skill-first creator platform" with courses, mentorship, channel points, cohorts, certificates — an amalgam of YouTube + Patreon + Discord + Skillshare + Coursera per the root `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md`.
3. **The code has a real, working, tested feature flag (`isSkillEconomyLmsEnabled`, default `false`) that already treats "YouTube-replica" as the default/base state and courses/LMS/some gamification as an optional add-on** — i.e., the codebase's own architecture has quietly sided with rule (1) over docs (2), but nothing in `docs/` says so, the flag isn't documented, and other large swaths of "Creator Economy OS" surface area (Communities 2.0, Channel Points, Mentorship, membership tiers/entitlements, Brands) are **not** gated by this flag or any flag — they ship unconditionally, so "YouTube-replica mode" today is not actually a clean YouTube-only build even with the flag off.
4. Open questions this leaves for product/eng to resolve (not this doc's job to answer):
   - Is `isSkillEconomyLmsEnabled` meant to become the seam that fully separates "YouTube core" from "everything else" (Communities 2.0, Channel Points, Mentorship, Brands, membership tiers)? If so, most of those modules need to move behind it or an equivalent flag, and `docs/` needs one canonical vision statement, not the two (`FORGE_PROJECT_MASTER.md` §1, `CLIENT_OVERVIEW.md`) that currently disagree with `forge-youtube-replica.md` (phase docs and the current frontend rule already agree with it — see §4.1's correction note).
   - Do "Courses," "Mentorship," and "Channel Points" map onto YouTube's actual surfaces at all (YouTube has no courses/cohorts/certificates; the closest analogs are the **Community tab** (posts/polls), **Channel Memberships** (tiered perks, badges, emoji), and creator **Shopping/merch shelf**), or are they intentionally being kept as FORGE-unique differentiators layered *on top of* a YouTube-parity base? `forge-youtube-replica.md` explicitly permits "intentional gaps... when forced by tech or law" but frames divergence-as-differentiator as something requiring the user to explicitly ask for it — which does not appear to have happened for Courses/Mentorship/Channel Points based on the docs available.
   - Should `docs/FORGE_PROJECT_MASTER.md` §1's executive summary be rewritten now to lead with YouTube parity (matching the phase docs and the code flag), demoting "skill-first" framing to a clearly-labeled optional layer? This doc recommends yes, but flags it here for explicit product sign-off rather than editing the master doc unilaterally.

---

## 6. Gap analysis

| Gap | Severity | Current state | Target state (YouTube parity) | Recommendation |
|---|---|---|---|---|
| Product vision stated inconsistently across docs | **High** | 3 different framings live simultaneously: `FORGE_PROJECT_MASTER.md`/`CLIENT_OVERVIEW.md` ("skill-first creator platform"), root `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` ("Creator Economy OS = YouTube+Patreon+Discord+Skillshare+..."), phase docs ("YouTube-parity"), and code (`isSkillEconomyLmsEnabled`, default-off skill-economy) | One documented vision, consistent with `forge-youtube-replica.md` | Get explicit product decision (§5), then rewrite `FORGE_PROJECT_MASTER.md` §1 + `CLIENT_OVERVIEW.md` "Product" section as the single source of truth; mark `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` as historical/superseded if it no longer reflects intent |
| All uploading/live access gated behind manual admin approval | **High** | `requestCreator` → `PENDING` → admin `bulkApproveCreators`/reject; blocks 100% of content creation, not just monetization | YouTube: anyone can upload/go live immediately; only *monetization* (ads, in select markets: memberships) is criteria-gated (1,000 subs + 4,000 watch-hrs, or Shorts equivalent) | Decide if manual approval is an intentional trust/safety divergence (reasonable for a smaller platform pre-automated-moderation) or should be relaxed to auto-approve-with-post-hoc-moderation as FORGE's automated moderation (`AI moderation` row in the feature matrix, ⚠️ partial) matures. If keeping approval, document it explicitly as an intentional gap per `forge-youtube-replica.md`'s allowance, and add a documented, code-enforced monetization-eligibility gate (subscribers + watch-hours) as a *separate* concept from `creatorStatus`, since currently there is none |
| `isSkillEconomyLmsEnabled` flag undocumented | **Medium** | Not in `FORGE_PROJECT_MASTER.md` §7 feature-flags table, not in `apps/api/.env.example` | Documented flag with default and scope | Add to §7 flags table and `.env.example` with the same comment already in the source (`Default OFF for YouTube-replica mode`) |
| "Channel" naming collision (creator/content channel = `User`; Discord-style chat channel = `Channel` entity) | **Medium** | Both called "channel" in code/docs/routes (`/[username]` = creator channel page; `Channel` entity = community chat room) | Disambiguated terminology throughout docs and, ideally, in code/API naming | Docs: always qualify as "Creator Channel" (User-based) vs "Community Channel" (chat room). Consider a future rename of the `Channel` entity/table to `CommunityRoomChannel` or similar if a breaking migration is ever in scope — out of blast radius for a docs pass, flagged for awareness |
| No separate Channel entity distinct from User (no multi-channel-per-account, no multi-manager channel) | **Low/Medium** (parity gap, not urgent) | `User` = channel, 1:1, single `role` enum, no ownership transfer, no "Managers" | YouTube: Brand Account channels independent of any one Google Account; transferable; multi-manager (Owner/Manager/Communications Manager) | Out of scope for near-term parity unless product wants team/agency creator accounts. Document as an explicit, intentional gap for now; revisit if multi-operator channels become a requirement |
| `followerCount`/`followingCount` → `subscriberCount`/`subscriptionCount` rename is half-done | **Medium** | API-response aliasing only (`user.mapper.ts`); DB columns, `Follow` entity, internal service method names (`getFollowers`, `isFollowing`) still use "follow" terminology; `FORGE_PROJECT_MASTER.md` §12 data-model table doesn't mention the alias at all | Fully YouTube-facing "Subscribe/Subscriber" language end-to-end, or a documented decision to keep "Follow" internally and only rename at the API boundary (current de-facto state) | Document the current de-facto convention explicitly ("internal: follow; external: subscribe") in `FORGE_PROJECT_MASTER.md` §12 and `API_SCHEMAS.md` so engineers don't unknowingly reintroduce `follower`-language in new public DTOs |
| Deleted-user content lifecycle unspecified | **Medium** | `AdminService.deleteUser` anonymizes the `User` row (email/username/displayName scrubbed, `deletedAt` set) but does not appear to touch/anonymize/reassign the user's `videos`, `streams`, or owned `communities` — content stays attributed to the now-anonymized row | YouTube: terminated-channel content is removed or handled per policy/DMCA; a clear, documented lifecycle exists | Confirm intended behavior (probably fine — content survives under "Deleted user," similar to many platforms) and **document it explicitly** in this domain's data model section + note any follow-on jobs needed (e.g., does the user's community get orphaned if they were the sole creator/owner?) |
| No documented interest/cold-start onboarding flow despite one existing in code | **Low** | `GET/PUT /users/me/interests` (Redis-backed, 20-category cap, UUID-validated) exists and clearly exists to solve YouTube-style cold-start recommendations, but is not mentioned in `FORGE_PROJECT_MASTER.md` §20 route catalog at all (checked: absent) nor described anywhere as an onboarding step | Documented first-run interest-picker flow, wired into signup/onboarding UX docs | Add to route catalog and to this domain's flow diagram (§7) as step in first-run onboarding |
| No persona/use-case document for Communities/Courses/Mentorship personas | **Medium** | Roles table only covers `Guest/user/creator/admin`; mentor, mentee, cohort participant, community moderator, VIP-tier member are real, shipped roles/flows with zero persona documentation | Each persona has a short "who they are / what they do end-to-end" writeup | Independent of the vision conflict — write minimal persona cards regardless of how §5 resolves, since the underlying code and roles exist either way |
| No monetization-eligibility entity/gate distinct from `creatorStatus` | **Medium** | `creatorStatus` (`pending/approved/rejected`) is the only creator-tier gate; nothing tracks subscriber/watch-hour thresholds for a future ads/monetization-eligibility feature | A distinct `monetizationStatus` (or reuse of `tier_entitlements`) driven by measurable criteria | If/when ad monetization or stricter Partner-Program-style gating is in scope, model it as a separate entity/flag from `creatorStatus`, since today they'd otherwise be conflated (currently moot — FORGE monetizes via Stripe memberships, not ads, so this is forward-looking, low urgency) |
| Multi-channel / brand-account concept absent | **Low** | One user = one channel, always | YouTube allows N channels per account (Brand Accounts) | Explicit non-goal unless product asks; document as intentional gap |

---

## 7. Recommended flows, data model, and API additions

These are additive/clarifying recommendations only — no existing behavior is proposed for removal without explicit product sign-off on §5.

### 7.1 Recommended onboarding flow (viewer → creator), annotated with what already exists

```
1. Sign up (email+pw or Google)                         [EXISTS: POST /auth/signup, /auth/google]
     └─ email verification required for creator step    [EXISTS: isVerified gate]
2. First-run interest picker (cold start)                [EXISTS but undocumented: GET/PUT /users/me/interests]
3. Land on personalized feed                             [EXISTS: /videos/recommended/feed]
4. (Optional) Request creator access                     [EXISTS: POST /users/me/request-creator]
     └─ ADMIN-GATED — pending review                     [DIVERGES from YouTube — see gap table]
     └─ approved -> role=creator, creatorStatus=approved
     └─ rejected -> creatorReviewNote shown, can re-apply
5. Creator sets up channel identity                      [EXISTS: PUT /users/:id — displayName, bio,
                                                            websiteUrl, channelLinks, avatar/banner upload]
6. First upload / go live                                [Covered by content/live domain docs]
7. (Recommendation, not yet modeled) Monetization        [MISSING: no subscriber/watch-hour threshold
   eligibility check, separate from creatorStatus         entity — see gap table row "monetization gate"]
```

### 7.2 Recommended data-model clarifications (docs-only; no schema change implied unless noted)

- **Document explicitly** (in `FORGE_PROJECT_MASTER.md` §12) that "Creator Channel" = the `users` table (one row = one identity = one channel; `username` is the handle/`@handle` equivalent), and "Community Channel" = the `channels` table (Discord-style room inside a `Community`). Use these two qualified terms consistently across all docs and any new engineering-facing spec, including this file's downstream siblings (live/community domain docs).
- **Document the follow/subscribe duality**: `follows` table + `Follow` entity + internal service methods stay "follow"-named; all public API DTOs should prefer `subscriberCount`/`subscriptionCount`/`viewerSubscribed` (already the pattern in `user.mapper.ts`) — extend the same alias pattern anywhere a raw `followerCount`/`viewerFollowing` still leaks in other mappers (`video.mapper.ts`, `stream.mapper.ts`, `community.mapper.ts` all call `toPublicUser` so they inherit it for free — verify no separate ad-hoc serialization bypasses this).
- **Add a documented `FEATURES_SKILL_ECONOMY_LMS` row** to `FORGE_PROJECT_MASTER.md` §7 and `apps/api/.env.example`, with the current default (`false`) and scope (Courses, Podcasts, Programs, and the `isSkillEconomyLmsEnabled`-gated slices of Communities/Gamification/Referral).
- **Recommend (pending product decision on §5)**: extend the same flag pattern to gate the remaining "Creator Economy OS" surface area that ships unconditionally today — Channel Points, Mentorship, Brands, Community 2.0's richer features (wiki/challenges/surveys/rooms) — behind one or more clearly named flags (e.g. `FEATURES_CREATOR_ECONOMY_EXTENSIONS`), so a true "YouTube-replica-only" build is actually achievable by flipping flags, matching what the code comment on `isSkillEconomyLmsEnabled` already implies is the intended end state.
- **Add a `monetizationEligibility` concept** (new, forward-looking; not urgent given Stripe-membership-based monetization today) if/when ads or a Partner-Program-style gate is planned: track `subscriberCountAtEval`, `watchHours12mo`, `publicUploadsLast90d`, `twoFactorEnabled`, `hasActiveStrike` as inputs to an eligibility computation, kept separate from `creatorStatus` (which should arguably become "can upload/go live at all," not "can monetize").

### 7.3 Recommended API additions (additive, non-breaking)

- `GET /users/me/interests` and `PUT /users/me/interests` — **already implemented**; add to `FORGE_PROJECT_MASTER.md` §20 route catalog (currently missing) and to any onboarding-flow doc.
- Consider a `GET /platform/onboarding-steps` or equivalent config endpoint (or extend `GET /platform/config`) so web/mobile/admin don't hardcode the onboarding step order (`Intent → Focus → Submit` on web is currently hardcoded in `apps/web/src/app/upload/become-creator/page.tsx`) — low priority, only worth it if the flow is expected to change per cohort/experiment.
- If the manual-approval gate is kept intentionally (per §5/§6 decision), consider exposing `GET /users/me/creator-application-status` with richer state (`queue position`, estimated review time) to reduce support load — currently the only signal is `creatorStatus` on the user object and the static `/waiting-approval` page.

### 7.4 Explicit non-recommendations

- Do **not** silently rewrite `FORGE_PROJECT_MASTER.md` §1's "skill-first" framing without the product decision flagged in §5 — that framing may be intentional and simply out of date relative to `forge-youtube-replica.md`, or `forge-youtube-replica.md` may itself need updating; this doc does not assume which.
- Do **not** remove Courses/Mentorship/Channel Points modules based on this research alone — they are fully shipped, tested features with real usage surface in the tracker (96.6% complete overall); any removal is a product call with real cost, not a docs-pass call.

---

## 8. Assumptions & open questions

**Assumptions made while writing this doc:**

- The `forge-youtube-replica.md` project rule reflects current, intended direction (it's the rule injected into every session), even though older docs (`FORGE_PROJECT_MASTER.md`, `CLIENT_OVERVIEW.md`, root `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md`) have not been updated to match it.
- `isSkillEconomyLmsEnabled` defaulting to `false` in all environments (not just some) was verified only by reading the function source (`process.env.FEATURES_SKILL_ECONOMY_LMS === 'true'`, unset → false) — did not verify actual deployed Fly/Vercel env-var values, which are outside this doc's read-only, local-only scope.
- Assumed the "waiting-approval"/"approval-rejected" web routes are the full extent of applicant-facing status UX; did not check mobile's equivalent screens in depth (mobile has "creator gates" per `forge-mobile.md` but this doc did not trace them line-by-line).
- Treated `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` (root-level, outside `docs/`) as a **prompt/blueprint document** (it literally reads as an audit-and-build prompt addressed to an AI/architect, per its "Purpose" section) rather than a committed product spec — worth product confirming whether it's historical, aspirational, or still authoritative, since `docs/README.md` still links to it as "Creator Economy OS v3.0 — requirements vision & architecture blueprint" without any superseded/deprecated marker.

**Open questions for product/eng (not answered by this research pass):**

1. Is "faithful YouTube replica" (per `forge-youtube-replica.md`) the platform's actual current direction, or has product intentionally pivoted to "Creator Economy OS," with the project rule now stale? These two documents cannot both be the live source of truth.
2. If YouTube-replica is the direction: what is the plan for the already-shipped Courses/Cohorts/Certificates/Mentorship/Channel-Points/Brands surface area — sunset, keep as an always-on FORGE-differentiator layer (which `FORGE_PROJECT_MASTER.md` §8's now-stale "distinct visual identity, not a YouTube clone" line once hinted at, before the frontend rule itself moved to a YouTube-parity-first framing), or fully flag-gate it off by default (extending the `isSkillEconomyLmsEnabled` pattern)?
3. Should the manual creator-approval gate be relaxed to YouTube's "everyone can upload immediately, only monetization is gated" model now, or is it an intentional trust & safety measure to keep given FORGE's current moderation automation maturity (AI moderation is ⚠️ partial per the feature matrix)? If intentional, it should be documented as such per `forge-youtube-replica.md`'s explicit allowance for documented gaps.
4. Is multi-manager / transferable "Brand Account"-style channel ownership ever going to be a requirement (e.g., for agency/team-run channels), or is 1-user-1-channel a permanent simplification? This changes whether `Channel` should eventually become its own entity distinct from `User`.
5. Who owns keeping `docs/FORGE_PROJECT_MASTER.md` §1, `CLIENT_OVERVIEW.md`, and the root `FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md` in sync going forward, and should the latter be explicitly marked historical/frozen (it already self-describes as "an intentionally frozen blueprint snapshot" at line 707) to stop it from being read as current guidance?

---

*This is a research/gap-analysis document, not an authoritative spec. Written for the docs-overhaul effort on the `product-vision-data-model` domain slice. Cross-check against sibling domain docs (content/upload, live streaming, communities/monetization, moderation) before treating any single recommendation here as final — several gaps identified (manual approval gate, skill-economy flag scope) span domain boundaries.*

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
