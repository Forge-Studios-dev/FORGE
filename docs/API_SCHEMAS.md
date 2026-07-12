# API schemas (public contracts)

Canonical shapes returned to clients. **Source of truth:** `packages/shared-types` and API mappers (`*/*.mapper.ts`). Internal DB columns are not listed here.

---

## Response envelope

```json
{ "success": true, "data": { ... }, "message": "optional" }
```

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
| `SubscriptionTier` | `id`, `creatorId`, `name`, `slug`, `priceCents`, `currency`, `benefits[]`, `sortOrder`, `isActive` |
| `MemberSubscription` | `id`, `userId`, `creatorId`, `tierId`, `status`, `source`, `startsAt`, `expiresAt` |
| `ContentAccessResult` | `{ allowed, reason? }` |

`POST /subscriptions/mock` body: `{ creatorId, tierId }` (non-prod / `MOCK_SUBSCRIPTIONS_ENABLED`).

---

## Socket.IO (`/events`)

**Client → server:** `join-video`, `leave-video`, `join-stream`, `leave-stream`, `join-live-feed`, `leave-live-feed`, `stream:react`, `join-conversation`, `leave-conversation`, `join-stream-chat`, `leave-stream-chat`, `join-community`, `leave-community`, `join-channel`, `leave-channel`, `join-room`, `leave-room`, `join-stream-vip`, `leave-stream-vip`, `join-creator-analytics`, `leave-creator-analytics`

**Server → client** (`SocketEvents` in shared-types):

`video:ready`, `stream:started`, `stream:ended`, `comment:new`, `stream:chat:message`, `stream:chat:delete`, `stream:chat:slow-mode`, `stream:chat:pinned`, `stream:chat:settings`, `stream:poll:updated`, `stream:qa:created`, `stream:qa:updated`, `channel:message`, `channel:message:delete`, `room:message`, `room:message:delete`, `stream:viewer-count`

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

## Social engagement (2026-06)

| Method | Path | Auth |
|--------|------|------|
| GET | `/videos/:id/comments/:commentId/replies` | public |
| PATCH/DELETE | `/videos/:id/comments/:commentId` | engage |
| POST/DELETE | `/videos/:id/comments/:commentId/like` | engage |
| GET | `/users/:id/followers`, `/users/:id/following` | public |
| GET | `/videos/feed/following` | JWT |
| GET | `/notifications/unread-count` | library |
| POST | `/notifications/read-all` | library |
| DELETE | `/subscriptions/me/:creatorId` | JWT |
| DELETE | `/channels/:channelId/messages/:messageId` | JWT |
| GET/POST | `/messages`, `/messages/conversations` | engage |

Socket events (additive): `notification:new`, `dm:message`, `stream:reaction`, `channel:message:delete`

---

## Visibility enums

**Videos:** `public`, `private`, `unlisted`  
**Streams / channels:** `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event`

Defined in `@forge/shared-types` `content-visibility.ts`.

---

## API versioning & breaking changes (F-601)

FORGE exposes a single REST prefix today: **`/api/v1`**. Policy:

| Rule | Detail |
|------|--------|
| **Stability** | Public response shapes in `@forge/shared-types` (`PublicVideo`, `PublicStream`, auth payloads, etc.) are stable within **v1**. Additive fields are allowed; removing or renaming fields is a breaking change. |
| **Breaking changes** | Require either (a) a new route prefix (`/api/v2/...`) with parallel v1 support, or (b) a **90-day deprecation** with `Deprecation: true` and `Sunset: <RFC 7231 date>` response headers on affected routes. |
| **Clients** | Web, mobile, and admin must bump `@forge/shared-types` together in one release train when contracts change. |
| **Sockets** | Socket.IO events follow the same additive-only rule; event renames require a versioned namespace or dual-emit period. |
| **Config** | `GET /platform/config` returns `apiVersion: "v1"` for client guards. |

Internal DB columns, admin-only DTOs, and worker payloads are **not** covered by this guarantee.

---

*Update this file when public mappers or DTOs change.*
