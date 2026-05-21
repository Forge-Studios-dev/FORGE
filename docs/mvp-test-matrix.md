# MVP test matrix

Role × flow × expected behavior across API, Web, Mobile, Admin.

> **Local setup:** [GETTING_STARTED.md](./GETTING_STARTED.md) · **Cloud deploy:** [MVP_GO_LIVE.md](./MVP_GO_LIVE.md)

## Demo accounts (local or production)

| Email | Password | Role | Use on |
|-------|----------|------|--------|
| `viewer@forge.local` | `ForgeDemo123!` | Viewer (`user`) | Web, mobile |
| `creator@forge.local` | `ForgeDemo123!` | Approved creator | Upload, Studio, go live |
| `admin@forge.local` | `ForgeAdmin123!` | Platform admin | Admin panel only |

Ensure API is running with **current code**. The Docker `forge-api` image is often **stale** (leaks `passwordHash`, missing `GET /playlists/me`, no `permissions` on `/users/me`).

**Recommended:** `docker compose stop api` then `npm run dev:api` (copy `apps/api/.env.example` → `apps/api/.env` if needed; Postgres/Redis can stay in Docker).

Quick check: `bash scripts/smoke-api.sh`

Full role matrix (API): `npm run verify:roles` or `bash scripts/verify-platform-roles.sh`

Reset demo accounts (viewer as `user`, admin as `admin`): `bash scripts/reset-demo-users.sh` (or `cd apps/api && npm run seed` when TypeORM seed loads cleanly)

Web/admin: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`.

### Web hydration (Sign in vs avatar)

Auth UI must not read `localStorage` during SSR. After fixes, first paint shows a brief loading state, then the correct guest or logged-in chrome — **no** “Hydration failed … `<span>` in `<a>`” overlay.

## YouTube-style access tiers (synced API + web + mobile)

**YouTube mapping:** Guests watch/search only. Signed-in viewers like, comment, subscribe, library/history. Creators get Studio + upload after approval. Platform admins use **admin app only** (`:3002`) — logging in on web redirects to admin panel; no consumer Upload/Studio UI.

Shared helpers: `packages/shared-types/src/access.ts` (`canUploadOnConsumerApp`, `isApprovedCreatorTier`, `canViewPersonalizedFeed`, …).

Canonical rules live in `packages/shared-types/src/access.ts`. `GET /users/me` returns `permissions[]` computed from tier.

| Tier | Who | Browse | Like / comment / follow | Library & history | Studio | Upload / go live |
|------|-----|--------|------------------------|-------------------|--------|------------------|
| **guest** | Not signed in | yes | no (UI gate + API 401) | no | no | no |
| **viewer** | `role=user` | yes | yes | yes | apply only | no |
| **creator_pending** | `role=creator`, `creatorStatus=pending` | yes | yes | yes | status page | no |
| **creator_rejected** | `creatorStatus=rejected` | yes | yes | yes | re-apply | no |
| **creator** | approved + `isVerified` | yes | yes | yes | full Studio | yes |
| **admin** | `role=admin` on **admin app** (`:3002`) | N/A | N/A | N/A | platform moderation | impersonate only on web |

**Admin vs YouTube:** YouTube’s internal moderation is separate from Creator Studio. FORGE **admin** uses the admin panel only; do not use `admin@forge.local` on the public web app for day-to-day viewing (use impersonation from admin → user hub).

### Tier smoke (web)

1. **Guest** — home, explore, watch, profile: no like/comment/follow without sign-in modal; `/library` → login.
2. **Viewer** — sign in: notifications, history, library, follow; no Upload icon; “Become a creator” visible; `/studio` → apply CTA.
3. **Pending creator** — after apply: waiting page on `/studio` and `/upload`; can still watch and comment.
4. **Approved creator** — Studio, upload, go live (after email verified).
5. **Admin** — `admin@forge.local` on `:3002` → dashboard; on `:3000` login → use impersonation for user testing.

## Admin user hub

1. **Users** → search/filter → **View profile**
2. Tabs: Overview shortcuts, **Videos** (inline status/visibility/remove), Reports, Watch history, Playlists
3. **Sign in as user** opens web in a new tab (2-minute link; audit event `admin.impersonate`)
4. Cannot impersonate other admins

## Auth sync smoke (web)

Run after any auth-related change:

1. Clear site data for `localhost:3000`.
2. Log in as `viewer@forge.local` / `ForgeDemo123!`.
3. **Without hard refresh:** TopBar shows avatar + Log out (not Sign in); home guest CTA banner is hidden.
4. Open `/history` and `/library` — allowed (cookie + token set).
5. Log out — Sign in returns; `/history` redirects to login.
6. Log in again, open a watch page — comment box shows “Add to the discussion…” (not stuck on guest).
7. Admin: `viewer@forge.local` on `localhost:3002` → `/unauthorized`; `admin@forge.local` → dashboard.

## Auth sync smoke (API)

```bash
# Login returns user.permissions (array, may be empty for viewers)
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@forge.local","password":"ForgeDemo123!"}'

# GET /users/me must include permissions after API redeploy
TOKEN=<accessToken from login>
curl -s http://localhost:3001/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```

| Flow | Guest | User | Creator (approved) | Admin |
|------|-------|------|-------------------|-------|
| Home / feed | Browse | Browse + forYou | Browse + studio CTA | N/A |
| Search / explore | Browse | Browse | Browse | Search tool |
| Watch video | Play; gate like/comment | Play + engage | Play + own analytics | N/A |
| Report content | Sign-in gate | Submit report | Submit report | Review in reports |
| Profile (public) | View channel | View + follow | View own grid | N/A |
| Library / history | Redirect login | Full access | Full access | N/A |
| Become creator | Login required | Request → pending (email verified) | Same | Approve/reject queue |
| Upload | Login required | Blocked | Web + mobile native upload | N/A |
| Studio | Login required | Apply gate | Full studio | N/A |
| Go live | Browse | Browse | Start/end (Mux) | N/A |
| Admin panel | N/A | N/A | N/A | Full moderation |

## Negative cases

| Case | Expected |
|------|----------|
| Invalid refresh token | 401; client clears session |
| Pending creator uploads | 403 / redirect to waiting-approval |
| Non-admin admin login | `/unauthorized` |
| Guest POST comment | Auth gate modal (web) or snackbar (mobile) |
| Private video as guest | NoAccess callout (web) |

## Environment

| App | Variable | Local value |
|-----|----------|-------------|
| API | `WEB_URL` | `http://localhost:3000` |
| Web | `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` |
| Admin | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL` | `http://localhost:3001/api/v1`, `http://localhost:3000` |
| Mobile | `API_BASE_URL` (dart-define) | `http://localhost:3001/api/v1` |

Run API from current source: `npm run dev:api` (Docker image may lag).

## Web route matrix (guest vs viewer)

| Route | Guest | Logged-in viewer |
|-------|-------|------------------|
| `/` | Feed browse | + continue watching, forYou |
| `/watch/[id]` | Play; gate like/comment/report | Full engage |
| `/[username]` | View; Follow → sign-in gate | Follow works |
| `/explore`, `/explore/[skill]` | Browse (`categorySlug` feed) | Same |
| `/search`, `/live` | Browse | Browse |
| `/library`, `/history`, `/notifications` | Sign-in CTA or middleware redirect | Data loads (`/playlists/me`, watch history with progress) |
| `/playlists/[id]` | Public view | Public view |
| `/playlists/new` | Redirect login | Create playlist |
| `/studio/*` | StudioGate / login | Creator-only features |
| `/upload/*` | Middleware | Permission gates |
| `/session-expired?next=` | — | Re-login preserves return path |

## API contract checks

```bash
# Playlists for current user
curl -s http://localhost:3001/api/v1/playlists/me -H "Authorization: Bearer $TOKEN"

# Watch history with progress (not incomplete)
curl -s http://localhost:3001/api/v1/users/me/watch-history -H "Authorization: Bearer $TOKEN"

# Feed by category slug
curl -s 'http://localhost:3001/api/v1/videos/feed?categorySlug=physical-crafts&limit=5'

# Public user must not expose passwordHash
curl -s http://localhost:3001/api/v1/users/<userId>
```

## Mobile parity

- Login honors `?next=` query param
- Failed refresh → `/login`
- `POST /videos/:id/watch` sends `progressSeconds`
- Creator re-request / verify email updates `forge_user` in secure storage

## Audit verification (2026-05-16)

| Area | Verified |
|------|----------|
| API guest browse | `GET /health`, `/videos/feed`, `/search`, `/categories` → 200 |
| API guest engage | `POST …/like`, `GET /playlists/me`, `GET /notifications` → 401 |
| API viewer | `permissions` includes `ENGAGE`, `USE_LIBRARY`; upload → 403 |
| API admin | `GET /admin/stats` with admin token → 200 |
| Web build | `npm run build` in `apps/web` — `/explore`, `/library`, `/studio` routes present |
| Admin | Login gate, non-admin → `/unauthorized` |

**Note:** If `localhost:3000/explore` 404s, restart web dev (`npm run dev:web`) — a stale production `next start` build omits newer routes.

## Smoke checklist

1. Sign up → verify email (optional) → login (TopBar updates immediately, no refresh)
2. Watch 30s → continue watching appears (web + mobile)
3. Become creator with bio → admin sees note on pending queue
4. Library shows watch history + playlists (`GET /playlists/me`)
5. Admin: dismiss report with confirmation; pending count uses `meta.total`
6. Token refresh after access token expiry (web stays signed in; user persisted if refresh returns `user`)
7. Explore skill page filters feed by category slug (not invalid `search=` param)
