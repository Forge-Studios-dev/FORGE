# Platform Research — Engagement, Social & Notifications

**Slug:** `engagement-social`
**Status:** Research / gap analysis for documentation overhaul. Not a spec to implement blindly — see Open Questions before scoping work.

---

## 1. Overview & Scope

This domain covers everything a viewer does *around* a video or a creator, and everything that tells them something happened:

- Comments & replies (create/edit/delete, like/dislike, pin, creator heart, reporting)
- Video-level reactions (like/dislike)
- Shares (external + in-app)
- Saves (Watch Later, playlists, "Save to...")
- Subscriptions/follow graph (subscribe/unsubscribe, notification bell levels, subscriber feed)
- Playlists/collections (user playlists, system playlists)
- Notifications (in-app, push, email digest)
- Direct messaging (1:1 and group DMs)
- Communities (creator community: posts, chat rooms, events, polls, groups, moderation, mentorship)

It intentionally excludes: video ranking/recommendations (Discovery domain), monetization/membership billing (Monetization domain), and core moderation/trust & safety infra beyond what lives inside comments/communities (Trust & Safety domain) — those are flagged only where they intersect.

---

## 2. YouTube Reference Model

### 2.1 Comments

- **Data model:** comment belongs to a video, has an author, text, optional single-level reply thread (YouTube flattens replies to one level — no nested replies-to-replies), like count, heart (creator-only, one heart per comment, toggle), pinned flag (one pinned comment per video, creator/mod only), and moderation state (published / held for review / rejected).
- **Flows:**
  - Post → server-side spam/toxicity classification (Perspective-API-style) runs before the comment is visible to others; borderline comments go to "held for review" in creator's comment moderation queue.
  - Comment ordering: "Top comments" (engagement-weighted: likes, replies, recency decay, author-authority signals) vs "Newest first". Ranking is a lightweight relevance model, not just like-count sort.
  - Creator tools: pin, heart, hide user (shadow-remove for that viewer only), block user from channel, "held for review" queue, approved-commenters allowlist, words to block/auto-hold (creator studio settings), comments-off toggle per video and channel default.
  - Live chat is a *separate* system (ephemeral, high QPS) from persistent VOD comments.
- **Edge cases:** rate limiting per user per video; duplicate/near-duplicate detection; @mention resolution; link/spam heuristics; comment count eventual consistency at scale (denormalized counter + periodic reconciliation); deleted-parent handling (replies survive with "deleted" placeholder, not cascade-deleted); age-restricted/kids content disables comments entirely.
- **Scale:** comment writes fan out to a denormalized `likeCount`/`replyCount` on the parent; counts are eventually consistent under heavy write load and reconciled by background jobs, not read-computed per request at YouTube's volume.

### 2.2 Likes/Dislikes/Reactions

- Video: binary like/dislike, mutually exclusive, one per user. Dislike count has been **hidden from public view since 2021** (still recorded, still used internally for ranking/moderation signal, just not displayed to other viewers — only the video owner sees it in Studio analytics).
- Comments: like only (no visible public dislike count on comments, though a dislike action exists for ranking signal).
- No emoji/multi-reaction system on videos or comments (that's a Community-Tab/Reddit/Slack pattern, not YouTube's video engagement model).

### 2.3 Shares

- Native share sheet (platform share intents) generates a canonical short URL, optionally with a timestamp (`?t=123s`) or clip range.
- Share is **not** a persisted per-user "share" entity/count visible anywhere in the UI — it's an ephemeral client action. (Creator Studio does show aggregate "Shares" as an analytics metric sourced from share-intent telemetry, not a `shares` table.)
- "Clip" (short 5s–60s segment sharing) is a distinct, newer primitive with its own entity, different from a plain share.

### 2.4 Saves / Playlists

- **Watch Later** and **Liked videos** are system playlists, auto-created per user, not user-deletable, always private.
- User playlists: title, description, visibility (public/unlisted/private), collaborative option (co-editors), ordered video list, drag-reorder.
- "Save" is a bottom-sheet/modal listing all playlists + Watch Later with checkboxes — saving is really "add to playlist(s)", not a separate save entity.
- Playlist videos can individually go private/deleted/region-blocked and are skipped at playback with a placeholder, not silently removed.

### 2.5 Subscriptions / Following

- Subscribe = follow-the-channel edge. Notification bell has three levels: **All**, **Personalized** (algorithmic subset), **None** (subscribed but muted).
- Subscriptions feed is a dedicated home tab, reverse-chron-ish with light ranking, distinct from the main recommended feed.
- Subscriber count is rounded/abbreviated publicly (creator can hide count entirely); exact count only visible to the channel owner.
- Unsubscribing has a confirmation step and (in some flows) an immediate "are you sure / see recommended similar channels" nudge.
- Channel memberships (paid) are a separate concept layered on top of the free subscribe relationship — a member is a subscriber plus a billing entitlement plus a distinct chat badge/emoji set.

### 2.6 Notifications

- Categories map roughly to: uploads/live from subscriptions, replies/mentions, activity on your content (likes/comments on your video), channel milestones, recommended-for-you (algorithmic, opt-out), and account/policy notices.
- Delivery channels: in-app bell feed, mobile/web push, and email digest — each independently configurable per category, with a "master" toggle plus per-channel bell for subscriptions specifically.
- Push and in-app share a single generation path so read-state and dedupe are consistent (you don't get a push for something you already saw in-app).
- Fanout for a popular channel's upload notification to millions of subscribers is a background/queued job, not a synchronous per-request write — YouTube explicitly rate-shapes notification delivery for very large channels to avoid a delivery/infra spike at upload time.
- "Personalized" bell level is a real ranking decision (a subset of All, chosen by relevance/engagement prediction) — not a synonym for "less frequent All".

### 2.7 Direct Messaging

- YouTube's own native DM product has actually been **discontinued/deprecated** in favor of "Send" via Community posts/short direct-share flows and integration with Google's messaging surfaces in some markets — history here is instructive: DM was never a core, heavily-invested YouTube pillar the way it is on Instagram/TikTok. Treat DM as a lower-priority, simpler surface architecturally (1:1 + basic group, no disappearing messages, no rich reactions/stickers) rather than a system to over-build.

### 2.8 Communities

- The "Community" tab on a channel is **creator broadcast + light 2-way engagement**: creator posts (text/image/poll/video), viewer comments + one reaction (like) on those posts, no chat rooms, no member roles/permissions system, no events calendar, no mentorship matching. It is *not* a Discord/Skool-style community platform.
- Access to community posts can be gated by membership tier (paid perk), same as videos.

---

## 3. Secondary-Platform Notes

- **Discord** (closest fit to what FORGE's `communities` module actually implements — roles, rooms/channels, permission matrix, moderation queue, events): validates that a role/permission-matrix + rooms model is a legitimate, well-understood pattern — but it is *not* YouTube's Community tab model. If FORGE keeps this depth, it should be framed as an intentional platform capability layered on top of a channel, not as "the YouTube Community tab implemented faithfully."
- **Reddit/Twitch**: multi-emoji chat reactions and channel-points-style loyalty rewards (Twitch Channel Points) are a better reference than YouTube for FORGE's existing `channel-points` module — YouTube has no direct equivalent. Worth documenting as an explicit, acknowledged divergence rather than silently calling it YouTube parity.
- **Instagram/TikTok**: DM is a first-class, heavily used surface with reactions, disappearing content, and share-to-DM as a primary distribution loop. If FORGE's product bet is closer to these platforms for DM engagement, that's a reason to invest more in DM than the YouTube reference model alone would justify — a product decision to flag, not assume.

---

## 4. Current FORGE State (grounded against code)

Docs reviewed:
- `docs/phases/13-subscriptions/PHASE_13_SUBSCRIPTIONS.md`, `PHASE_13_REPORT.md`
- `docs/phases/15-communication/PHASE_15_COMMUNICATION.md`, `PHASE_15_REPORT.md`
- `docs/COMMUNITY-PERMISSION-MATRIX.md`
- `docs/SCALE_MESSAGING.md`
- `docs/FORGE_PROJECT_MASTER.md` (executive summary + module table, cross-checked)

Code checked (via codegraph + targeted reads):
- `apps/api/src/modules/engagement/` — `engagement.service.ts`, `engagement.controller.ts`, entities: `comment.entity.ts`, `like.entity.ts`, `comment-like.entity.ts`, `follow.entity.ts`, `user-block.entity.ts`, `watch-history.entity.ts`
- `apps/api/src/modules/notifications/` — `notification.entity.ts`, `notify-recipients.util.ts`, `push-dispatch.service.ts`, `email-digest.service.ts` + `.scheduler.ts`, `subscription-maintenance.service.ts`, `community-announcement-notify.service.ts`, `premium-content-notify.service.ts`
- `apps/api/src/modules/direct-messages/` — `direct-messages.service.ts`, `direct-messages.controller.ts`, entities: `conversation.entity.ts`, `conversation-member.entity.ts`, `direct-message.entity.ts`
- `apps/api/src/modules/playlists/` — `playlists.service.ts`, `playlists.controller.ts`, entities: `playlist.entity.ts`, `playlist-video.entity.ts`
- `apps/api/src/modules/communities/` — 40+ files: `communities.service.ts`, `community-posts.service.ts`, `community-engagement.service.ts`, `community-rooms.service.ts` (+ LiveKit), `community-room-messages.service.ts`, `community-events.service.ts`, `community-polls.service.ts`, `community-groups.service.ts`, `community-moderation.service.ts` + `-queue.service.ts`, `ai-moderation.service.ts`, `ai-community.service.ts`, `ai-budget.service.ts`, `mentorship.service.ts` + `mentorship.entity.ts`, `channel-legacy.service.ts`, `brands.service.ts`, `creator-copilot.service.ts`, `llm-router.service.ts`, `community-permissions.constants.ts`
- `apps/api/src/modules/courses/` — `courses.service.ts`, `creator-programs.service.ts` (adjacent; cited for the parity-tension finding)
- `packages/shared-types/src/notification-preferences.ts`
- `apps/mobile/lib/features/{subscriptions,messages,notifications,community,playlists}/`
- `apps/web/src/components/{Comments,SubscribeChannelControl}/`

### What's actually built (confirmed in code, not just docs)

- **Comments**: full CRUD, single-level replies, like/dislike (mutually exclusive via `VideoReactionType`), pin (one per video, owner-only), "creator heart" (`creatorHearted` toggle), cursor pagination, sort modes (`newest`/`top`/`oldest`). No spam/toxicity classifier and no held-for-review queue on video comments (only `communities` posts get `ai-moderation.service.ts` treatment) — grep confirmed zero hits for spam/toxicity/profanity in `engagement/*` or `reports/*`.
- **Likes**: `Like` entity is video-level only, `reaction` enum `like`/`dislike`, unique per `(userId, videoId)`. Dislike count is **not confirmed hidden from public API response** — needs verification against the actual DTO/serializer (see Open Questions); YouTube hides it publicly.
- **Shares**: no `Share` entity, no share-tracking endpoint anywhere in `apps/api/src/modules` (grep for `class .*Share` found nothing outside naming collisions). Whatever "share" UI exists client-side is presumably a bare link-copy with no server-side event.
- **Follows/Subscriptions**: `Follow` entity with `notifyLevel` enum (`all`/`personalized`/`none`) — bell levels exist at the data layer. `engagement.service.ts` has both legacy `follow`/`unfollow` and YouTube-facing aliases `subscribe`/`unsubscribe`. Blocking (`isBlockedEitherWay`) gates subscribe. `PHASE_13` docs say "Personalized ranking (distinct from All)" is **deferred** — i.e., the enum value exists but there's no distinct algorithmic behavior behind `personalized` vs `all` yet; confirm before documenting it as shipped.
- **Playlists**: `Playlist`/`PlaylistVideo` entities, system types `watch_later`/`liked` via `PlaylistSystemType` enum, visibility enum matches YouTube (public/unlisted/private). This part is materially YouTube-faithful already.
- **Notifications**: single `notifications` table, `NotificationType` enum (18 values) mapped to a `NotificationCategory` (7 buckets: social/live/content/community/billing/creator/reward) via `packages/shared-types/notification-preferences.ts`. Per-category **mute** exists (`mutedCategories` on `user.notificationPreferences` jsonb) and is enforced pre-dispatch in `push-dispatch.service.ts`. This is *more* than `PHASE_15_COMMUNICATION.md` credits — that doc says "Push preference matrix UI" is deferred, but category-level mute infra (API + shared gate) is already built; only a full per-category × per-channel (push/email/in-app) matrix UI is missing. **Doc is stale/understating what's shipped.**
- **Email digest**: `email-digest.service.ts` + `.scheduler.ts` register a real daily BullMQ repeatable job (13:00 UTC) that queries users with `emailDigest: true`, batches, and sends via `MailService`. This **contradicts** the comment in `packages/shared-types/notification-preferences.ts:54` — `"Opt-in for a periodic email digest (reserved — no digest job sends yet)"` — that comment is now factually wrong; the job exists and runs. **Stale code comment**, flag for correction regardless of doc overhaul.
- **DMs**: `Conversation` (supports `isGroup` + group name/creator), `ConversationMember`, `DirectMessage` entities — 1:1 and group DM both modeled. `PHASE_15` says DM is "Complete... Socket.IO DMs" plus a Phase-15 addition of username search to start a DM.
- **Communities**: this is the single largest module in the domain by file count (40+ service/controller/entity files) and implements: posts + comments + reactions on posts, chat **rooms** (text + LiveKit audio/video), events (with recurrence), polls, sub-groups, brand pages, a 14-key role-based permission matrix (owner/admin/moderator/coach/member — see `COMMUNITY-PERMISSION-MATRIX.md`), a moderation queue with AI-assisted moderation (`ai-moderation.service.ts`, `ai-budget.service.ts`, `llm-router.service.ts`), creator-copilot AI tooling, and **mentorship** (`mentorship.entity.ts`: `MentorshipProfile`/`MentorshipMatch`, skill-tag matching between mentors/mentees). None of this maps to YouTube's actual "Community tab" (creator post + viewer comment/like, no rooms/events/roles/mentorship). It maps closely to **Discord/Skool**.
- **Courses** (`apps/api/src/modules/courses/`) sits directly adjacent to this domain via `bind-community`: cohorts, lessons, quizzes, assignments, certificates — confirmed present in `FORGE_PROJECT_MASTER.md` §CoursesModule/§API list and as real service files. This is *skill-platform* surface area, not YouTube-anything.
- **Messaging scale doc** (`SCALE_MESSAGING.md`) is explicitly labeled proposed/roadmap for community chat message persistence — current baseline (Socket.IO + Redis adapter, unpartitioned Postgres table) is accurately described as the shipped state, everything past §1 (BullMQ persist queue, monthly partitioning, Redis Streams) is **not built yet**. Good doc hygiene here — no correction needed, just carry the same "proposed vs shipped" framing into the new doc.

---

## 5. Gap Analysis

| Gap | Severity | Current State | Target State (YouTube parity) | Recommendation |
|---|---|---|---|---|
| No comment spam/toxicity gate | High | Comments publish instantly, no classifier, no held-for-review queue | Pre-publish classification; borderline → creator review queue; auto-hold on blocked words | Add a lightweight moderation hook in `engagement.service.createComment` (reuse `ai-moderation.service.ts` patterns already built for communities instead of inventing a second system) |
| No per-video/per-channel "comments off" toggle | Medium | Not found in `Video`/channel settings scan | Creator can disable comments per video and set channel default | Add `commentsEnabled` to video settings; gate `createComment` |
| Dislike count public-visibility unclear | Medium | `Like` entity stores dislike; serializer not verified to hide it publicly | Dislikes recorded but not shown to non-owners | Verify comment/video DTOs; hide `dislikeCount` from public responses, keep in Studio analytics only |
| No server-side Share entity/analytics | Medium | Grep confirms no `Share` entity or endpoint | Share action recorded (channel, video, medium) for Studio analytics "Shares" metric | Add lightweight `POST /videos/:id/share` fire-and-forget event → BullMQ → analytics aggregate; do not block on it |
| "Personalized" bell level is a no-op | Medium | Enum value exists (`FollowNotifyLevel.PERSONALIZED`); `PHASE_13` confirms ranking behind it is deferred | Personalized = real relevance-filtered subset of All | Either implement a minimal heuristic (e.g., only notify if video crosses an engagement threshold in first N hours) or relabel in UI as unavailable until built — don't ship a fake toggle |
| Push preference matrix UI missing | Low–Medium | API-side category mute exists and is enforced (`push-dispatch.service.ts`); no per-category × per-channel (push/email/in-app) settings UI confirmed on web/mobile | Full settings UI exposing all 7 categories × 3 channels | Build UI against existing `NotificationPreferences`/`mutedCategories` — backend groundwork already there, this is a frontend gap, not backend |
| Stale code comment on email digest | Low | `notification-preferences.ts:54` says digest "reserved — no digest job sends yet"; job is real and scheduled daily | Comment matches reality | One-line comment fix (flag to engineering, not a doc-only fix) |
| Comments hard-delete parent semantics unclear | Low | `parent` relation is `onDelete: 'SET NULL'` — replies become orphaned top-level-ish rows with `parentId` still pointing at a null | YouTube shows a "deleted" placeholder in-thread, replies remain nested | Verify `getCommentReplies`/`getComments` handles a deleted parent gracefully (placeholder row) rather than losing thread context — confirm behavior, don't assume |
| Communities module scope vastly exceeds YouTube Community tab | **High (product/architecture)** | 40+ files: rooms, events, polls, groups, mentorship, brands, AI moderation/copilot, 14-permission RBAC | YouTube Community tab = creator post + comment + single reaction, gated by membership tier, no rooms/events/roles/mentorship | **Do not silently trim.** This is the core tension in `conflictsWithOtherDocsOrRules` — surface to product/eng leadership before any refactor. If parity is genuinely the target, most of this module is out-of-model and would need to be reframed (e.g., as a distinct "Communities" product pillar the team has explicitly chosen to keep) or deprecated toward the simpler tab. If the skill-platform framing is the real target, this module is *correctly scoped* and the YouTube-parity rule needs an explicit carve-out. |
| Courses/Mentorship/Cohorts/Quizzes/Certificates exist with no YouTube equivalent | **High (product/architecture)** | Real modules (`courses`, `mentorship` inside `communities`), documented as core surfaces in `FORGE_PROJECT_MASTER.md` | No such concept in YouTube's model (closest analogue: none — not even YouTube's "Courses" experiment matched this shape) | Same as above — flag, do not resolve unilaterally |
| Channel Points has no YouTube equivalent | Medium (acknowledged elsewhere) | `channel-points` module implements Twitch-style earn/redeem | No channel-points concept on YouTube | Document explicitly as an intentional Twitch-pattern divergence rather than "parity", per `forge-youtube-replica.md`'s allowance for documented gaps |
| DM group conversations may be over-invested relative to YouTube's actual (deprecated) DM priority | Low | Full group-DM entity model (`isGroup`, `creatorId`, group name) already built | YouTube barely has native DM at all today | Not urgent to change — just don't cite YouTube as the reason to keep expanding DM; if investing further, cite Instagram/TikTok as the actual reference model per §3 |
| No unbounded-query audit on comment/notification list endpoints done in this pass | Low | `clampLimit` used in controllers reviewed (`engagement.controller.ts`); not verified across every list endpoint in `communities`/`notifications` | All list endpoints paginate/clamp | Quick lint/grep pass for `@Query('limit')` usages missing `clampLimit` before shipping any related change |

---

## 6. Recommended Flows / Data Model / API Additions

These are additive/clarifying — not a mandate to rebuild what already works. Scope any real implementation to the smallest slice per `forge-core.md`.

### 6.1 Comment moderation gate (fills the biggest gap)

**Flow:**
1. `POST /videos/:id/comments` → `engagement.service.createComment` persists as today, but sets a new `moderationStatus: 'published' | 'held' | 'rejected'` (default `published`).
2. Reuse the existing `ai-moderation.service.ts` LLM-router pattern from `communities` (do not build a second AI moderation stack) as an async post-write check: enqueue a BullMQ job `moderate_comment` → on flag, set `moderationStatus = 'held'` and emit `comment.held` (creator-visible in a new "Held for review" tab, same shape as `community-moderation-queue.service.ts`).
3. `getComments`/`getCommentReplies` filter `moderationStatus = 'published'` for all viewers except the comment author (sees their own held comment marked "awaiting review") and the video owner/mod (sees held queue separately).

**Data model addition:**
```
ALTER TABLE comments ADD COLUMN moderation_status varchar(16) NOT NULL DEFAULT 'published';
ALTER TABLE comments ADD COLUMN moderated_at timestamptz NULL;
CREATE INDEX idx_comments_moderation ON comments (video_id, moderation_status) WHERE moderation_status = 'held';
```

**Edge cases to handle:** rejected comment's replies (should also hide, not orphan-publish); rate limit comment creation per user per video (reuse the sliding-window pattern already in `CommunityRoomMessagesService` per `SCALE_MESSAGING.md`); creator approved-commenters allowlist as a fast-path bypass.

### 6.2 Share tracking (analytics-only, non-blocking)

**API:** `POST /videos/:id/share` — body `{ medium?: string }` (e.g. `copy_link`, `native_share`, `embed`). Fire-and-forget: enqueue BullMQ `record_share` job, return `202`/`{ ok: true }` immediately, never block the UI's native share sheet on server round-trip.

**Data model:**
```
CREATE TABLE video_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, -- nullable: guests can share
  medium VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_video_shares_video_created ON video_shares (video_id, created_at DESC);
```
Aggregate into Studio analytics the same way `likeCount`/`viewCount` are already denormalized — do not read-aggregate this table per request on hot dashboards; roll up via existing analytics pipeline (`apps/api/src/modules/analytics`).

### 6.3 "Personalized" bell level — minimal real behavior

Rather than leave it a labeled-but-inert enum value, implement the smallest honest version:
- On `stream_started_followed` / `video_ready` fanout in `notify-recipients.util.ts`, for subscribers with `notifyLevel = personalized`, only include them if the uploading channel is in the subscriber's top-N most-watched channels (derivable from `watch-history.entity.ts` — already exists) in the last 30 days, OR the video's early engagement velocity (likes+comments in first hour) crosses a threshold.
- This is intentionally simple — a real learned-ranking model is out of scope; document it as v1 heuristic, not final ranking.

### 6.4 Notification preference matrix UI (frontend gap, backend ready)

Backend already exposes the primitives (`NotificationCategory`, `mutedCategories`, `emailDigest`). Add:
- `GET /me/notification-preferences` (if not already present — verify against `notifications.controller.ts` before adding, avoid duplicate endpoint)
- Web/mobile settings screen: 7 categories × {in-app always-on, push toggle, email toggle} grid, backed by extending `NotificationPreferences` to per-channel granularity:
```ts
export interface NotificationPreferences {
  mutedCategories: NotificationCategory[]; // in-app + push mute (existing)
  emailDigest: boolean; // existing, unchanged
  pushMutedCategories?: NotificationCategory[]; // new: push can differ from in-app
}
```
Keep in-app notifications always generated (never fully suppress the record) — only push/email delivery should be user-mutable, matching YouTube's model where the bell feed itself isn't something you can turn off, only its push/email delivery.

### 6.5 Comment-thread deleted-parent placeholder

Verify current behavior first (Open Question below). If confirmed broken: when a parent comment is deleted, keep a tombstone row (`content: null`, `deletedAt` set) rather than `SET NULL` on `parentId` for children — children should keep pointing at the tombstone so `getCommentReplies` can render "[deleted]" in place while preserving thread order. This likely requires changing the `onDelete` strategy from `SET NULL` to a soft-delete-only policy (never hard-delete a comment with replies).

---

## 7. Explicit Assumptions & Open Questions

**Assumptions made in this research pass:**
- "Faithful YouTube replica" (per `forge-youtube-replica.md`) is treated as the north star for gap severity ratings in §5, even though it visibly conflicts with the current `communities`/`courses`/`mentorship`/`channel-points` surface area and the `FORGE_PROJECT_MASTER.md` executive summary. Per task instructions, this tension is **surfaced, not resolved** — see `conflictsWithOtherDocsOrRules`.
- Code reads were targeted (grep + codegraph_explore + direct reads of entities/services named above), not exhaustive line-by-line audits of all 40+ community files or all controller endpoints. Findings on "not found" (e.g., no Share entity, no spam classifier) are grep/search-based negative results — high confidence but not a full manual audit.
- Web/mobile UI state (e.g., whether a push-preference screen exists) was checked by directory listing only (`apps/web/src/components`, `apps/mobile/lib/features/notifications`), not full component reads — treat "no UI confirmed" as "not found in a targeted pass," not a certainty.

**Open questions requiring a decision or further check (do not resolve unilaterally):**

1. **Product framing decision (blocking for scoping any real work in this domain):** Is `communities` (rooms/events/polls/mentorship/groups/AI-copilot) a deliberate, retained product pillar distinct from YouTube's Community tab — or should it be trimmed/refactored toward YouTube parity per `forge-youtube-replica.md`? Same question for `courses`/cohorts/quizzes/certificates and `channel-points`. This affects roadmap prioritization for this entire domain far more than any individual gap in §5.
2. Is `FollowNotifyLevel.PERSONALIZED` intended to ship as a real ranking feature soon, or should the UI temporarily hide/disable that option until it means something? Shipping a labeled-but-inert setting is a minor trust issue.
3. Does the public comment/video API response currently include `dislikeCount` to non-owner viewers? Needs a direct DTO/serializer check (not done in this pass) before deciding whether §5's "dislike visibility" gap is real or already handled.
4. What actually happens today when a comment with replies is deleted — does `getCommentReplies` render orphaned children correctly, or do they silently vanish from the thread? Needs a focused test/read of `deleteComment` + `getCommentReplies` together.
5. Is there a spam/rate-limit control on video comment creation today (distinct from the community-room-messages rate limiter mentioned in `SCALE_MESSAGING.md`)? Not found in the targeted grep — worth a dedicated check before assuming it's fully absent.
6. Should DM investment follow the YouTube reference (minimal, deprioritized) or the Instagram/TikTok reference (rich, high-engagement)? This is a product call, not an engineering one — flagging per `forge-youtube-replica.md`'s instruction not to silently invent divergence.
7. `SCALE_MESSAGING.md` targets community/live chat scale, not comment or notification fanout scale — is there an equivalent scale plan needed for notification fanout to large-subscriber-count channels (YouTube explicitly rate-shapes this)? Not found; may be a genuine missing doc rather than a code gap.

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
