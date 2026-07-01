# Community channel sunset runbook

**Tracker:** complements `CEOS-P01-T001`, `CEOS-P04-T007` · **Flag:** `community_channels_deprecated`

Retire legacy **channels** in favor of **rooms** (`text`, `voice`, `stage`). Code is shipped; this runbook covers **staging validation** then **production cutover**.

---

## What the flag does

| Surface | Flag off (default) | Flag on |
|---------|-------------------|---------|
| Community payload `channels[]` | Included | Empty array `[]` |
| Channel CRUD (POST/PATCH/DELETE) | Allowed | **410 Gone** + migration hint |
| Channel messages (`GET/POST /channels/:id/messages`) | Allowed (bridged to rooms when mapped) | **Still allowed** (read/write bridge preserved) |
| Rooms API | Primary path | **Only** creation path |
| HTTP headers on channel routes | `Deprecation`, `Sunset`, `X-Forge-Migration-Hint` | Same |

**Sunset date (RFC 8594):** `Sat, 01 Sep 2026 00:00:00 GMT` — see `community-deprecation.constants.ts`.

---

## Prerequisites

- Rooms migration backfill applied (`channel-migration.service.ts` lazy mapping)
- Web studio channels tab removed; mobile `studio_community_screen.dart` uses rooms
- Admin moderation may still reference channel message routes (bridged — OK)

---

## Phase A — Staging enablement

### 1. Set feature flag on Fly staging API

```bash
# Append to existing flags (keep multipart_upload, etc.)
export FLY_APP=forge-studios-api-staging
export EXISTING_FLAGS=multipart_upload   # read from fly secrets or .env.staging.example

bash scripts/set-channel-sunset-fly.sh
```

Or manually:

```bash
fly secrets set FEATURE_FLAGS='multipart_upload,community_channels_deprecated' \
  --app forge-studios-api-staging
```

Local dev:

```bash
# apps/api/.env
FEATURE_FLAGS=multipart_upload,community_channels_deprecated
```

### 2. Validate

```bash
FORGE_SMOKE_API=https://forge-studios-api-staging.fly.dev/api/v1 \
  bash scripts/smoke-channel-sunset.sh
```

Expected when flag is **on**:

| Check | Expected |
|-------|----------|
| `GET /platform/config` | `community_channels_deprecated` in `featureFlags` |
| `GET /communities/:id/rooms` | 200 |
| `POST .../channels` | **410** |
| Community detail | `channels: []` |
| Channel route headers | `Deprecation: true`, `Sunset` present |

### 3. Soak (24–48h)

- Creator creates **text room** via studio (web + mobile)
- Legacy clients posting to `/channels/:id/messages` still work if channel mapped
- No channel CRUD in studio UIs

---

## Phase B — Production cutover

**After staging soak passes:**

```bash
export FLY_APP=forge-studios-api
bash scripts/set-channel-sunset-fly.sh
```

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 \
  bash scripts/smoke-channel-sunset.sh
```

Monitor Sentry for `GoneException` spikes on channel CRUD (expected if legacy clients remain).

---

## Rollback

```bash
# Remove flag from FEATURE_FLAGS (keep other flags)
fly secrets set FEATURE_FLAGS='multipart_upload' --app forge-studios-api
```

Channel CRUD and `channels[]` in payloads resume immediately. No data loss — channel rows remain in DB.

---

## References

| Resource | Path |
|----------|------|
| Flag constant | `apps/api/src/modules/communities/community-deprecation.constants.ts` |
| 410 guard | `communities.service.ts` → `assertChannelMutationsAllowed()` |
| Deprecation headers | `deprecated-channel-api.interceptor.ts` |
| Permission matrix | `docs/COMMUNITY-PERMISSION-MATRIX.md` |
| Community smoke | `scripts/smoke-community-2.0.sh` |
| Channel sunset smoke | `scripts/smoke-channel-sunset.sh` |
