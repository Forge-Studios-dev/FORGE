# Moderation, Safety, Copyright & Admin — Platform Research

> **Partially superseded, 2026-08-13.** This doc's §4.2/§5 "High severity" gaps — no account-strike
> ladder, no appeals mechanism, no copyright/rights pipeline — are **resolved**: `account-strikes/`
> and `copyright/` modules shipped 2026-08-12 (see [COPYRIGHT_DMCA.md](../COPYRIGHT_DMCA.md) and
> [ESCALATION_RULES.md](../ESCALATION_RULES.md), the current sources of truth for those systems).
> The rest of this doc's analysis (Discord/Twitch-shaped community moderation vs. YouTube's actual
> model, ban-evasion, admin IA gaps) is still current as of the 2026-08-13 zero-trust re-audit.
> Ground-truthed against code on 2026-08-09.
> Legal/branding note: per `forge-youtube-replica.md`, this describes **functionality and UX
> patterns only** — no trademarks, proprietary names, or asset references.

## 1. Overview & scope

This domain covers everything that keeps the platform safe and legally defensible:

- **Reporting** — how users flag videos, comments, users, and community content.
- **Moderation workflows** — human review queues, AI-assisted triage, escalation tiers, SLAs.
- **Trust & safety** — account-level enforcement (warnings, strikes, suspension, termination),
  abuse/rate-limit controls, appeals.
- **Copyright / content-rights** — automated rights-matching (Content-ID-style), claims,
  disputes, monetization holds, formal takedown (DMCA-style) notices and counter-notices.
- **Admin/platform management** — the admin app's ability to manage users, creators, videos,
  reports, communities, streams, and platform config; audit trail for privileged actions.
- **Escalation rules** — who can act on what, at which severity, with which SLA.

## 2. YouTube reference model

### 2.1 Reporting flow
- Any signed-in viewer can flag a video, comment, channel, or live chat message from the
  overflow menu with a reason picked from a fixed taxonomy (spam, hate speech, harassment,
  sexual content, violent/graphic content, child safety, promotes terrorism, misinformation,
  copyright, privacy). Reason taxonomy feeds directly into reviewer tooling and, for some
  categories (child safety, terrorism), triggers legally-mandated fast paths (e.g., NCMEC
  reporting for CSAM) that bypass normal queueing.
- Flags do not directly remove content; they enqueue a job for automated classifiers first,
  human review queue second. Reporters get a generic "thanks, we'll review" response and
  (usually) no visibility into outcome, to prevent gaming/harassment via mass-reporting.
- Anti-abuse: reporting is rate-limited per-account and weighted by the reporter's own
  trust score (repeat bad-faith reporters are down-weighted or silently ignored).

### 2.2 Automated moderation
- Multi-modal classifiers score uploaded video/audio/thumbnail/title/description against
  policy categories at ingest time (pre-publish) and continuously in the background
  (post-publish, since abuse patterns and policy shift over time).
- High-confidence, high-severity matches (CSAM, terrorism) are auto-removed and reported to
  law enforcement / NCMEC without human review. Lower-confidence matches are held for human
  review before either action or restoration. Borderline-but-not-violating content is
  algorithmically down-ranked in recommendations ("borderline content" policy) rather than
  removed.
- Comment/live-chat spam and toxicity filtering runs synchronously at write-time with a
  local (per-channel) "held for review" queue creators can approve/reject, plus creator-set
  blocked-words and blocked-user lists.

### 2.3 Strikes & account-level enforcement
- **Community Guidelines strikes** (behavior/content violations): first violation = warning
  (no restriction); each subsequent strike inside a rolling 90-day window escalates — upload
  restriction for ~1 week, then ~2 weeks, and a 3rd strike within the window terminates the
  channel. Strikes expire independently after 90 days if no further violation.
  Deleting a struck video does not clear the strike; a struck video can still be appealed.
  Appeal window: several months. One appeal per strike — a denied appeal is final.
- **Copyright strikes** are a separate, more severe track from a formal legal takedown
  request (not the same as a Content-ID claim). 3 copyright strikes in 90 days terminates the
  channel and all channels linked to that person, and blocks the uploader from creating new
  channels. Copyright strikes can be resolved by retraction from the claimant, a successful
  counter-notification, or expiry (~90 days) — copyright strikes do not silently expire the
  way Community Guidelines strikes do without one of those events.
- Termination cascades: banned/terminated accounts cannot simply re-register — device/
  payment/IP signals are used to catch ban evasion (not perfectly, but as a deterrent).

### 2.4 Copyright / rights-matching (Content-ID-style) system
- Rights holders submit reference files (audio/video fingerprints) into a matching database.
  Every new upload is scanned against that database at ingest and matches become **claims**
  (automated, civil) — distinct from **strikes** (formal legal notice, much higher severity).
- On a claim, the rights holder's chosen policy applies automatically: monetize (ads run,
  revenue routes to claimant), track (no visible effect, analytics only), or block
  (region-specific or worldwide takedown of just that content, not the whole channel).
- Uploader is notified and can: do nothing (accept), trim/edit out the matched segment, or
  **dispute** the claim (claiming fair use, license, public domain, or misidentification).
  Disputing pauses monetization-to-claimant; claimant has a bounded window (~30 days) to
  respond by upholding, releasing, or escalating the dispute to a formal takedown (which
  converts it into copyright-strike territory with legal consequences).
- Multiple simultaneous claims can exist on one asset (e.g., different rights holders for
  different audio segments); revenue can be split proportionally among valid claimants.
- Only accounts in a rights-management program (vetted) can issue Content-ID-style claims;
  everyone else uses the standard formal-notice (DMCA-style) flow, which requires a sworn
  legal statement and identity, and which carries strike consequences and a counter-notice
  right for the uploader (with its own waiting period before restoration, e.g. ~10–14
  business days, to allow the claimant to file suit).

### 2.5 Admin/ops tooling
- Internal reviewer queues are prioritized by severity/urgency, not FIFO; reviewers see
  the flagged content, reporter's stated reason, classifier confidence score, uploader's
  history (repeat offender signals), and one-click enforcement actions (remove, age-restrict,
  demonetize, strike, dismiss) plus templated user-facing notices.
- Full audit trail of every moderator/admin action against content and accounts, including
  who, what, when, and the policy citation — needed for both internal QA and legal defense
  of appeals.
- Impersonation/support tooling: authorized support/ops staff can view an account's state to
  help with a ticket, always logged, scoped and time-boxed.
- Bulk actions and saved policy templates exist for handling coordinated abuse
  (spam waves, brigading) efficiently rather than one item at a time.

### 2.6 Scalability & failure-mode considerations
- Report volume vastly exceeds human review capacity — automated triage/scoring is not
  optional at scale; it's the only thing that makes the queue tractable.
- Classifier false positives/negatives are unavoidable — the design compensates with tiered
  confidence thresholds (auto-act only at very high confidence), human-in-the-loop for the
  middle band, and a working appeals path so wrongful actions are correctable without
  eroding trust.
- Every irreversible action (termination, permanent deletion) needs a grace/appeal window;
  legal takedowns need retention of evidence in case of subpoena/counter-notice litigation.
- Rate limiting and reporter trust-scoring prevent the flagging system itself from becoming
  an abuse vector (review-bombing, false mass reporting to silence a creator).

## 3. Secondary-platform notes

- **Twitch** — moderation is heavily *channel-operated*: streamers appoint moderators with
  granular permissions, run bot-driven auto-mod (regex/ML phrase filtering with severity
  sliders per-channel), and timeouts/bans are channel-scoped, not platform-wide by default.
  Platform-wide suspension is reserved for severe/cross-channel violations. This
  channel-devolved model with configurable auto-mod sensitivity is worth adopting for
  live-chat/community-room moderation specifically — it's a better fit than YouTube's
  simpler blocked-words list. **FORGE's community-moderation stack (below) already leans
  this direction** (per-community roles, mute/ban, configurable AI threshold) more than it
  leans toward plain YouTube — see the parity tension in §6.
- **TikTok** — pushes far more toward pre-publish automated review (much of the risky
  content is screened before it ever goes live, with human review as backstop) given short-
  form volume; also publishes a public transparency report cadence and has faced regulatory
  scrutiny requiring more proactive (vs. reactive/report-driven) moderation. Relevant if
  FORGE's upload pipeline wants a pre-publish moderation gate rather than only post-publish
  admin review (today FORGE has no pre-publish scan of video content at all — see gap table).
- **Vimeo** — smaller trust & safety surface, DMCA-first (formal notice/counter-notice) with
  no automated Content-ID-equivalent; useful minimal baseline if a full rights-matching system
  is judged out of scope near-term, since a Content-ID-style database of reference fingerprints
  is a heavy, ongoing investment (ingesting rights-holder reference files, fingerprinting every
  upload, running a claims/dispute UI) that a bootstrap platform may reasonably defer in favor
  of a compliant DMCA-only pipeline first.

## 4. Current FORGE state (grounded in code + existing docs)

### 4.1 What the existing docs claim
- `docs/ESCALATION_RULES.md` — well-developed for **community** (chat/post) moderation only:
  4-tier queue (P0–P3) with SLAs, an AI moderation pipeline (`ai-moderation.service.ts`,
  `llm-router.service.ts`, `AiBudgetService`) that scores content 0–100 and
  auto-approves/holds/blocks/escalates, human escalation paths (community moderator → creator
  → admin), chat rate limits, XP anti-gaming limits, and session-sharing controls. It does
  **not** mention video-level reports, copyright, strikes, or appeals anywhere.
- `docs/phases/07-admin/PHASE_07_ADMIN.md` / `PHASE_07_REPORT.md` — describe only the admin
  **shell IA** (nav groups Overview/Moderation/Community/Platform, theme, search shortcut).
  Explicitly states deeper "admin workflow UX (report queues, bulk actions)" was **deferred**,
  and that mentorship/channel-points tooling is deliberately kept off the primary nav as
  "non-YouTube oversight" — see tension in §6.
- `docs/QA.md` — lists demo accounts/roles and a smoke flow ("admin reports") but no detail
  on moderation logic; access tiers table has no distinct "moderator" role, only
  guest/viewer/creator_pending/creator/admin.
- `docs/LEGAL.md` — covers Terms/Privacy pages and acceptance only. **No DMCA/copyright
  policy page, no designated agent, no counter-notice process are documented**, despite
  "Copyright infringement" being an available report reason in the product
  (`apps/web/src/lib/report-reasons.ts`).
- `docs/phases/20-qa/*` — generic testing infra notes; no moderation-specific QA coverage
  called out.

### 4.2 What the code actually implements
- **Platform-wide reports** (`apps/api/src/modules/reports/`): a single `reports` table
  (`Report` entity) with `targetType` ∈ {video, user, comment}, free-text `reason`, and
  `status` ∈ {pending, reviewed, dismissed}. No severity, no auto-action, no linkage to
  strikes or account state. Admin lists/filters/bulk-updates status via
  `admin.controller.ts` (`GET /admin/reports`, `PATCH /admin/reports/:id`,
  `PATCH /admin/reports/bulk`) → `reports.service.ts`.
- **Video moderation** (`apps/api/src/modules/content/entities/video.entity.ts`): a single
  `moderationStatus` enum — `none | held | blocked` — plus a free-text `moderationNote`, set
  only via admin `PATCH /admin/videos/:id` → `admin.service.ts#moderateVideo`. No automated
  scanning of uploaded video content, no pre-publish gate, no rights-matching, no strikes.
- **Community moderation** (`apps/api/src/modules/communities/`) is the most mature layer:
  `community-moderation.service.ts` / `.controller.ts` implement report → resolve, ban/unban
  (with optional `expiresAt`), role assignment, and a unified moderator inbox
  (`GET /creators/me/moderation/inbox`); `community-members.service.ts` /
  `.controller.ts` implement per-member suspend/unsuspend; `ai-moderation.service.ts` +
  `ai-community.service.ts` implement the scored AI pipeline described in
  `ESCALATION_RULES.md`. This is **community/chat-scoped only** — it has no relationship to
  the platform-wide `reports` table or to video `moderationStatus`, i.e. **two parallel,
  non-integrated moderation systems exist** (see gap table).
- **Account-level enforcement** (`apps/api/src/modules/admin/admin.service.ts`): binary
  `isActive` flag (disables sign-in, forces logout-all via `authService.logoutAll`) and
  creator-status approve/reject. No warning/strike ladder, no time-boxed suspension, no
  appeals endpoint anywhere in the codebase (confirmed: no matches for "appeal" or "strike"
  in `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`).
  Admin role escalation requires re-entering the caller's password
  (`assertAdminEscalationAllowed`, step-up auth) — a good existing security pattern to reuse
  for other high-risk moderation actions (e.g., channel termination).
- **Admin impersonation** (`admin.service.ts#createImpersonation`, `auth.service.ts`) issues
  a short-lived, purpose-scoped token (`purpose: 'impersonate'`) explicitly rejected by the
  normal JWT bearer strategy (`jwt.strategy.ts`) so it can't be reused as a session token —
  solid pattern, but the impersonation event only emits `admin.impersonate`; no audit log
  table was found (no `audit_log` entity under `apps/api/src/modules/admin`), though
  `docs/ESCALATION_RULES.md` references a *creator* audit log
  (`GET /creators/me/audit-logs`) that is a different, narrower thing.
- **Admin app** (`apps/admin/src/app/reports`) has a reports UI; `apps/mobile/lib/features/
  studio/presentation/studio_moderation_screen.dart` gives creators a mobile moderation
  surface — presumably wrapping the community moderation inbox, not the platform reports
  table.
- **Report reason taxonomy** (`apps/web/src/lib/report-reasons.ts`) already mirrors YouTube's
  categories closely (spam, hate/harassment, sexual, violent, harmful acts, child abuse,
  terrorism, copyright, privacy, other) for videos, and a shorter list for comments — the UX
  intent is YouTube-aligned even though the backend has no differentiated handling per reason.

## 5. Gap analysis

| Gap | Severity | Current state | Target state | Recommendation |
|---|---|---|---|---|
| No copyright/rights-matching or DMCA-style takedown pipeline | High | "Copyright infringement" is a selectable report reason with no special handling; `docs/LEGAL.md` has no DMCA policy or designated-agent info | A documented notice-and-counter-notice flow at minimum (legal baseline); Content-ID-style fingerprint matching as a stretch goal | Ship DMCA-style flow first (low engineering cost, closes legal exposure); scope rights-matching as a separate, later initiative given its cost (see §3 Vimeo note) |
| No account-level strike/warning ladder | High | Binary `isActive` disable only; no escalation state machine | Warning → timed restriction → termination ladder per violation type (content vs. copyright), matching severity tiers already defined in `ESCALATION_RULES.md` for communities | Add a `strikes` table keyed by user + type (`content`/`copyright`), reuse existing P0–P3 severity tiers, wire into existing `isActive`/creator-status transitions |
| No appeals mechanism anywhere | High | Confirmed absent in API/web/admin/mobile | User-facing appeal on any strike/removal/ban, admin queue to adjudicate, one-appeal-per-action rule, audit of decision | Add `appeals` table + `POST /appeals`, `GET/PATCH /admin/appeals`; block a second appeal on the same action at the DTO/service layer |
| Platform-wide `reports` and community-moderation are two disconnected systems | Medium | `reports` table has no `communityId`/tier/severity; community reports live in a separate `community_reports`-style entity with its own resolve endpoints | Either a shared severity/tier model across both, or an explicit documented boundary (video/user/global-comment vs. community content) | At minimum, document the boundary explicitly; consider a shared `ModerationAction` audit trail across both so admin has one place to see a user's full history |
| No pre-publish content scan for videos | Medium | Video moderation is 100% reactive (admin sets `moderationStatus` after the fact, usually after a report) | At minimum automated flags (thumbnail/title/description text classifier reusing the existing `llm-router.service.ts` judge) at ingest, holding high-risk uploads pre-publish | Reuse the existing AI-judge pattern from community moderation (`ai-moderation.service.ts`) against video metadata/transcript instead of building a new pipeline |
| No admin-side audit log for privileged actions (ban, terminate, impersonate, moderate video) | Medium | Only a Prometheus counter for AI calls and a narrower *creator* audit log; no queryable admin action log | Persisted `admin_audit_log` (actor, action, target, reason, timestamp), surfaced in admin UI | Emit alongside existing `admin.impersonate`-style events into a durable table, not just eventing |
| No distinct "moderator" role between creator-moderator and platform admin | Low–Medium | Access tiers in `docs/QA.md` are guest/viewer/creator_pending/creator/admin only; `UserRole.ADMIN` is all-or-nothing at platform scope | A scoped trust-and-safety reviewer role (queue access, enforcement actions, no billing/infra access) | Extend `UserRole` or add a permissions bitset consistent with `packages/shared-types/src/access.ts` pattern already used for creator tiers |
| Copyright strikes vs. content strikes not modeled as separate tracks | Medium (once strikes exist) | N/A today | Two independent counters/expiry windows per YouTube's model, since copyright strikes have harsher, legally-driven consequences | Model as `strikeType` enum with separate rolling-window and termination-threshold config, not a single shared counter |
| Reporter abuse / mass-reporting not mitigated | Low–Medium | No rate limit or trust-weighting found on `POST /reports` or `POST communities/:id/reports` beyond generic auth | Per-account rate limit + down-weighting of chronically-dismissed reporters | Reuse existing rate-limit guard patterns already in the API (per `forge-backend.md`) |
| No CSAM/terrorism fast-path or law-enforcement reporting hook | High (compliance) | Not present; P0 tier in `ESCALATION_RULES.md` is community-chat-scoped, not global | A documented, legally-reviewed fast path independent of the standard queue, for both video and community content | Flag as a legal/compliance item, not purely engineering — needs counsel sign-off (`forge-infra-docs.md` legal caution) |
| `docs/LEGAL.md` has no copyright/DMCA content despite it being the platform's "legal pages" source of truth | Medium | Only Terms/Privacy tracked | Add a Copyright Policy page + designated agent contact, mirroring the existing `LEGAL_LAST_UPDATED` pattern | Extend `apps/web/src/content/legal/` with a `copyright.ts` following existing `terms.ts`/`privacy.ts` structure |

## 6. Conflicts / tension to surface, not resolve

- `docs/FORGE_PROJECT_MASTER.md` (executive summary, line 12) frames FORGE as a
  "skill-first creator platform" (lessons, live teaching, communities, mock memberships) and
  explicitly states (line 196) **"familiar video IA, distinct visual identity (not a YouTube
  clone)"** — this is a direct, in-repo contradiction of `forge-youtube-replica.md`'s mandate
  to prefer YouTube parity and to *remove or refactor* divergences rather than extend them as
  "FORGE-unique." This domain sits right on that fault line:
  - The **community-moderation system** (roles: owner/admin/moderator/coach; per-member
    mute/ban with `expiresAt`; channel-points-adjacent XP anti-gaming) is architected more
    like **Discord/Twitch** channel-moderation than YouTube's actual moderation model
    (channel-level comment holding, blocked-words/blocked-users lists, live-chat moderators —
    no member "roles," no ban durations, no per-community XP system on YouTube). Under strict
    parity, this system would need to be refactored toward YouTube's simpler comment/held-for-
    review + blocked-user model; under the current "skill-first platform" framing it's
    arguably intentional and fine as-is. **This document does not choose a side** — flagged
    per the task's explicit instruction not to silently resolve it.
  - `PHASE_07_ADMIN.md` itself already acknowledges the tension operationally: mentorship and
    channel-points admin tooling is called "non-YouTube oversight" and deliberately kept off
    the primary admin nav "by design," rather than removed — i.e., the admin IA is already
    hedging between both product framings instead of picking one.
  - Copyright/Content-ID-style tooling is a **pure-YouTube concept** with no equivalent in the
    "skill-first" framing at all (a lesson-platform's rights-management need looks more like
    plagiarism/DMCA-on-uploaded-video than a music-rights-matching marketplace) — whichever
    framing wins should determine whether a full rights-matching system is worth building or
    whether a DMCA-only baseline is the permanently-correct scope, not just a phase-1 stopgap.
- Two independent moderation stacks (platform `reports` vs. community moderation, §4.2/§5)
  are themselves a duplication the project's own `forge-core.md` "avoid duplicated logic"
  guidance would flag once someone looks at both side by side — worth a deliberate merge-or-
  boundary decision rather than continued organic divergence.

## 7. Recommended flows / data model / API additions

These are scoped to be incrementally buildable — DMCA-baseline and strikes first (highest
legal/trust impact, lowest engineering cost), rights-matching and pre-publish scanning later.

### 7.1 Data model additions

```
strikes
  id                uuid PK
  user_id           uuid FK -> users
  strike_type       enum('content','copyright')
  severity_tier     enum('P0','P1','P2','P3')     -- reuse ESCALATION_RULES.md tiers
  source_report_id  uuid FK -> reports (nullable)  -- what triggered it, if a report
  source_video_id   uuid FK -> videos (nullable)
  reason            varchar(500)
  issued_by         uuid FK -> users (admin/mod actor)
  issued_at         timestamptz
  expires_at        timestamptz null              -- content strikes expire; copyright ones
                                                    -- only clear via retraction/counter-notice
  status            enum('active','expired','overturned')
  INDEX (user_id, strike_type, status)

appeals
  id                uuid PK
  strike_id         uuid FK -> strikes (nullable)
  report_id         uuid FK -> reports (nullable)  -- appeal can target a strike or a takedown
  appellant_id      uuid FK -> users
  statement         text
  status            enum('pending','upheld','overturned')
  reviewed_by       uuid FK -> users null
  reviewed_at       timestamptz null
  decision_note     varchar(1000) null
  created_at        timestamptz
  UNIQUE (strike_id)   -- enforce one appeal per strike

copyright_claims
  id                uuid PK
  video_id          uuid FK -> videos
  claimant_id       uuid FK -> users (rights-holder account) OR claimant_name for external
  policy            enum('monetize','track','block')
  territory         varchar(2)[] null              -- null = worldwide
  status            enum('active','disputed','released','upheld','escalated_to_strike')
  disputed_at       timestamptz null
  claimant_response_due_at timestamptz null         -- ~30 day SLA once disputed
  created_at        timestamptz

admin_audit_log
  id            uuid PK
  actor_id      uuid FK -> users
  action        varchar(100)      -- e.g. 'video.moderate', 'user.suspend', 'user.impersonate'
  target_type   varchar(32)
  target_id     uuid
  reason        varchar(500) null
  metadata      jsonb null
  created_at    timestamptz
  INDEX (target_type, target_id, created_at)
```

`reports.severity_tier` (new nullable column, enum P0–P3) should be added to the existing
`reports` table so the platform-wide queue can reuse `ESCALATION_RULES.md`'s tiers instead of
inventing a second scheme — the cheapest fix for the "two disconnected systems" gap.

### 7.2 Flows

**Content strike issuance (reactive path)**
1. Report(s) accumulate against a video/user past a per-tier threshold, or a P0/P1 item is
   confirmed by human review.
2. Reviewer (community mod for community content, admin for platform-wide) takes an
   enforcement action from a fixed menu: dismiss / remove content / issue strike / issue
   strike + remove / escalate to platform ops.
3. On "issue strike": insert `strikes` row, evaluate the user's active-strike count within the
   rolling 90-day window for that `strike_type`; if it now crosses the termination threshold,
   trigger the existing `isActive = false` + `logoutAll` path used today by
   `admin.service.ts#updateUser`, reusing that code path rather than duplicating it.
4. Notify user (email + in-app) with the reason, policy citation, and appeal link/expiry date.

**Copyright claim path (baseline, no fingerprint matching)**
1. Rights holder (or DMCA-style external party) submits a formal notice via a new
   `POST /copyright/notices` endpoint (public form + required attestation fields — identity,
   good-faith statement, signature — mirroring the legal minimum for a notice-and-takedown
   regime).
2. System creates a `copyright_claims` row with `policy = 'block'` and immediately sets the
   target video's `moderationStatus = 'blocked'` (reuse the existing enum — no new video-side
   state needed).
3. Uploader is notified, may submit a **counter-notice** (`POST /copyright/notices/:id/counter`)
   attesting good-faith belief of error; this starts the legally-required waiting period
   before FORGE may restore the video absent a lawsuit filing — enforced by
   `claimant_response_due_at` and a cron/worker check (BullMQ, per `forge-backend.md`
   guidance to offload async work) rather than a synchronous timer.
4. Repeated upheld notices against one uploader roll into the strike ladder (`strike_type =
   'copyright'`), separate from content strikes.

**Appeal flow**
1. `POST /appeals` with `strikeId` or `reportId` + statement; service enforces the one-appeal
   rule via the `UNIQUE(strike_id)` constraint above.
2. Appears in a new admin queue `GET /admin/appeals` (mirrors existing `GET /admin/reports`
   pagination/filter conventions in `admin.controller.ts`).
3. Admin resolves via `PATCH /admin/appeals/:id` → `upheld` (strike stands, appeal closed,
   no further appeal) or `overturned` (strike row set to `status = 'overturned'`, any account
   restriction from step above is reversed, `admin_audit_log` entry written).

### 7.3 API additions (summary)

- `POST /reports` — extend existing DTO with optional `severityHint` (server still
  authoritative; hint only affects queue ordering).
- `GET/PATCH /admin/reports` — add `severityTier` to filters/response (existing endpoints,
  additive field).
- `POST /copyright/notices`, `POST /copyright/notices/:id/counter`,
  `GET /admin/copyright/notices`, `PATCH /admin/copyright/notices/:id` (admin adjudication).
- `POST /appeals`, `GET /admin/appeals`, `PATCH /admin/appeals/:id`.
- `GET /admin/users/:id/strikes`, `POST /admin/users/:id/strikes` (manual issuance path for
  cases not driven by a report).
- `GET /admin/audit-log?targetType=&targetId=` — surfaces the new `admin_audit_log` table;
  reuse existing admin pagination helpers (`clampPage`/`clampLimit` already used throughout
  `admin.service.ts`).

### 7.4 Admin UI additions
- `apps/admin/src/app/reports` gains a severity column/filter and a "history for this user"
  drill-in (strikes + past reports) — the summary aggregation pattern already exists in
  `admin.service.ts#getUserSummary` and can be extended rather than rebuilt.
- New `apps/admin/src/app/copyright` and `apps/admin/src/app/appeals` sections under the
  existing "Moderation" nav group from `PHASE_07_ADMIN.md`.

## 8. Assumptions & open questions

**Assumptions made in this analysis:**
- FORGE is US-jurisdiction-first for the DMCA-style baseline (notice/counter-notice timing
  above follows the US safe-harbor shape); actual legal timing must be confirmed by counsel
  per the caution already in `docs/LEGAL.md`.
- "Rights-matching / Content-ID-style" automated fingerprinting is treated as a later-phase,
  optional investment, not a near-term requirement, given FORGE's current scale and the
  Vimeo-style minimal-baseline alternative noted in §3.
- The existing community-moderation AI pipeline (`ai-moderation.service.ts`,
  `llm-router.service.ts`) is assumed reusable for video pre-publish scanning rather than
  needing a new ML system, since it already does score-threshold-based judgment.

**Open questions for product/eng to resolve (not answered here per task instructions):**
1. Does FORGE commit to strict YouTube parity for moderation surfaces (§6), meaning the
   Discord/Twitch-shaped community moderation system gets refactored toward YouTube's
   simpler model — or is "skill-first platform" the accepted permanent framing, in which case
   this doc's YouTube-parity recommendations should be re-scoped as "inspired by" rather than
   "match exactly"?
2. Is a full Content-ID-style rights-matching system in scope at all, or is a DMCA-only
   baseline the intended permanent state given FORGE's content is lesson/skill video rather
   than music/entertainment where rights-matching matters most?
3. Should copyright/DMCA notices support non-users (external rights holders with no FORGE
   account) submitting notices, and if so what identity/anti-fraud verification is required?
4. Who owns the legally-mandated CSAM/terrorism fast-path (NCMEC-equivalent reporting) —
   is there a compliance/legal owner outside engineering to define the actual reporting
   destination and retention requirements before this is built?
5. Should the platform-wide `reports` table and community-moderation reports be merged into
   one system, or is the boundary (global content vs. community-scoped content) intentional
   and just needs documenting?
6. What is the intended new "moderator" role's exact permission surface relative to
   `packages/shared-types/src/access.ts`'s existing tier model — additive role or a
   permissions bitset?
