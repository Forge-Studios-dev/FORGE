# API schemas (public contracts)

Canonical shapes returned to clients. **Source of truth:** `packages/shared-types` and API mappers (`*/*.mapper.ts`). Internal DB columns are not listed here.

---

## Response envelope

```json
{ "success": true, "data": { ... }, "message": "optional" }
```

---

## API versioning

FORGE public HTTP APIs are versioned under `/api/v1/...`.

Breaking changes must follow [`docs/API_VERSIONING.md`](./API_VERSIONING.md).

---

## `GET /platform/config`

No auth. See `PlatformPublicConfig` in `@forge/shared-types`.

| Field | Type | Notes |
|-------|------|-------|
| `featureFlags` | `string[]` | From `FEATURE_FLAGS` env |
| `apiVersion` | `"v1"` | |
| `auth.provider` | `"custom"` | JWT + Postgres — not Firebase Auth |
| `auth.emailPassword` | `boolean` | |
| `auth.googleOAuth` | `boolean` | |
| `auth.mailConfigured` | `boolean` | SMTP ready |
| `auth.emailVerification` | `"link"` \| `"link_or_otp"` | |
| `auth.otpVerification` | `boolean` | |
| `firebase.adminConfigured` | `boolean` | |
| `firebase.fcmEnabled` | `boolean` | |
| `firebase.appCheckEnabled` | `boolean` | |
| `firebase.usesFirebaseAuth` | `false` | Always false today |
| `billing.stripeEnabled` | `boolean` | Stripe Checkout available |
| `billing.mockSubscriptionsEnabled` | `boolean` | Test memberships without payment |
| `legal.termsUrl` | string | e.g. `https://forgestudios.net/terms` |
| `legal.privacyUrl` | string | |
| `legal.contactEmail` | string | |
| `legal.privacyEmail` | string | |
| `legal.lastUpdated` | string | ISO date |

See [LEGAL.md](./LEGAL.md).

---

## Auth — login / refresh / signup

**Response (simplified):**

| Field | Type | Notes |
|-------|------|-------|
| `accessToken` | `string` | JWT ~15m |
| `refreshToken` | `string` | Opaque; also HttpOnly cookie on web |
| `sessionId` | `string` | For “this device” in settings |
| `user` | `PublicUser` | See below |

**Not returned:** `password_hash`, refresh token hash, internal IDs beyond `sessionId`.

---

## `PublicUser`

| Field | Type |
|-------|------|
| `id`, `email`, `username`, `displayName` | string |
| `bio`, `avatarUrl`, `bannerUrl` | string \| null |
| `role` | `user` \| `creator` \| `admin` |
| `isVerified` | boolean |
| `creatorStatus` | `pending` \| `approved` \| `rejected` \| null |
| `creatorReviewNote` | string \| null |
| `followerCount`, `followingCount`, `videoCount` | number |
| `permissions` | `Permission[]` |
| `viewerFollowing` | boolean? (when loaded in context) |

---

## Video upload (request bodies)

### `POST /videos/presigned-url`

| Field | Required | Notes |
|-------|----------|-------|
| `contentType` | yes | `video/mp4` or `video/quicktime` |
| `fileSizeBytes` | yes | 1 … 500MB |

### `POST /videos/:id/complete`

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | 3–200 chars |
| `description` | no | max 2000 |
| `visibility` | yes | `public` \| `private` \| `unlisted` |
| `categoryId` | yes | UUID |
| `skillTagIds` | yes | ≥1 UUID |
| `scheduledPublishAt` | no | ISO8601 |
| `playlistIds` | no | UUID[] |

**Deprecated (do not use in new clients):** `skillTagName` — use `skillTagIds` only.

### Multipart

Enable `multipart_upload` flag. Flow: `presigned-url` → `multipart/parts` → `multipart/checkpoint` → `multipart/complete`. See [MEDIA.md](./MEDIA.md).

---

## `PublicVideo`

Playback URLs are **null** unless `status === ready` and access is allowed.

| Field | Type | Notes |
|-------|------|-------|
| `id`, `userId`, `title` | | |
| `description` | string \| null | |
| `status` | enum | `uploading` … `ready` \| `failed` |
| `visibility` | enum | |
| `hlsUrl`, `thumbnailUrl` | string \| null | Sanitized CDN/Mux URLs |
| `durationSeconds` | number \| null | |
| `viewCount`, `likeCount`, `commentCount` | number | |
| `skillTags` | array | |
| `categoryId`, `requiredTierId`, `sourceStreamId` | UUID \| null | |
| `publishedAt`, `scheduledPublishAt` | date \| null | |
| `accessDenied`, `accessReason` | optional | When gated |
| `viewerLiked`, `viewerFollowingCreator` | optional | Detail contexts |

**Omitted from public API:** `s3Key`, `muxAssetId`, `failureReason`, `transcodeProvider`, upload internals.

---

## `POST /streams/start` — `CreateStreamDto`

| Field | Required | Default |
|-------|----------|---------|
| `title` | yes | |
| `description` | no | |
| `visibility` | no | `public` |
| `categoryId` | no | |
| `thumbnailUrl` | no | Mux thumbnail if omitted |
| `chatEnabled` | no | `true` |
| `recordEnabled` | no | `true` |
| `ageRestricted` | no | `false` |
| `requiredTierId` | no | Tier-gated stream |

---

## `PublicStream`

| Field | Type | Notes |
|-------|------|-------|
| `id`, `userId`, `title`, `description` | | |
| `playbackUrl`, `thumbnailUrl` | string \| null | Hidden when `accessDenied` |
| `status` | `idle` \| `live` \| `ended` | |
| `visibility`, `categoryId` | | |
| `chatEnabled`, `recordEnabled`, `ageRestricted` | boolean | |
| `requiredTierId` | UUID \| null | |
| `slowModeSeconds`, `viewerCount` | number | |
| `startedAt`, `endedAt`, `createdAt` | date \| null | |
| `streamKey`, `rtmpUrl` | string \| null | **Owner only** (`includeIngest`) |
| `accessDenied`, `accessReason` | optional | |

**Omitted:** `muxLiveStreamId`, `muxAssetId`, raw Mux IDs.

---

## Feed

`GET /videos/feed?sort=latest|popular|forYou&cursor=...`

| Query | Notes |
|-------|-------|
| `sort` | `forYou` requires auth; falls back to `latest` for guests |
| `cursor` | Opaque pagination |
| `categoryId`, `skillTagId` | Optional filters |

Response: `PaginatedFeedPayload<PublicVideo>` — `{ data, meta: { cursor, hasMore } }`.

---

## Memberships

| Type | Key fields |
|------|------------|
| `SubscriptionTier` | `id`, `creatorId`, `name`, `slug`, `priceCents`, `currency`, `benefits[]`, `sortOrder`, `isActive`, `hasStripePrice` |
| `MemberSubscription` | `id`, `userId`, `creatorId`, `tierId`, `status`, `source` (`mock` \| `admin_grant` \| `payment`), `startsAt`, `expiresAt` |
| `ContentAccessResult` | `{ allowed, reason? }` |

`POST /subscriptions/mock` body: `{ creatorId, tierId }` (when `MOCK_SUBSCRIPTIONS_ENABLED`).

### Billing (Stripe)

`POST /billing/checkout` — auth required. Body: `{ creatorId, tierId }`. Response: `{ provider, sessionId, checkoutUrl }`.

`POST /billing/subscriptions/cancel` — auth required. Body: `{ creatorId }`. Response: `{ ok: true }`.

`POST /billing/webhooks/stripe` — public; raw body; `stripe-signature` header. Response: `{ ok: true }`.

---

## Socket.IO (`/events`)

**Client → server:** `join-video`, `leave-video`, `join-stream`, `leave-stream`, `join-live-feed`

**Server → client** (`SocketEvents` in shared-types):

`video:ready`, `stream:started`, `stream:ended`, `comment:new`, `stream:chat:message`, `stream:chat:delete`, `stream:chat:slow-mode`, `channel:message`, `channel:message:delete`, `stream:viewer-count`

Auth: JWT in handshake `auth.token` (not client-supplied `userId`).

---

## Analytics ingest

`POST /analytics/events`

| Field | Required |
|-------|----------|
| `event_name` | yes |
| `properties` | object (optional) |
| `video_id` | optional UUID |

Processed async via `analytics-ingest` queue.

---

## Visibility enums

**Videos:** `public`, `private`, `unlisted`  
**Streams / channels:** `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event`

Defined in `@forge/shared-types` `content-visibility.ts`.

---

*Update this file when public mappers or DTOs change.*
