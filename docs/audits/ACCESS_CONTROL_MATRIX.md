# Access Control Matrix

Legend: **PUBLIC** | **AUTH** (signed-in) | **CREATOR** (approved + verified) | **ADMIN** (admin app only)

## Web consumer (`apps/web`)

| Route | Intended | Middleware | Client | API |
|-------|----------|------------|--------|-----|
| `/` | PUBLIC | ✓ | — | public feed |
| `/explore`, `/explore/*` | PUBLIC | ✓ | — | public |
| `/search` | PUBLIC | ✓ | — | public |
| `/watch/[id]` | PUBLIC | ✓ | AuthGate engage | optional JWT |
| `/live`, `/live/[id]` | PUBLIC | ✓ | partial | mixed |
| `/[username]` | PUBLIC | ✓ | follow modal | public |
| `/library` | AUTH | cookie + valid JWT | isGuest empty | USE_LIBRARY |
| `/history` | AUTH | cookie + valid JWT | isGuest | protected |
| `/notifications` | AUTH | cookie + valid JWT | isGuest | protected |
| `/profile` | AUTH | cookie + valid JWT | redirect | — |
| `/profile/settings` | AUTH | cookie + valid JWT | — | protected |
| `/studio/*` | CREATOR (full UI) | cookie + valid JWT | StudioGate tiers | CreatorApproved on write |
| `/upload/become-creator` | AUTH (viewer+) | cookie + valid JWT | — | apply |
| `/upload/step/*`, `/upload/success` | CREATOR | cookie + role=creator | steps | CreatorApprovedGuard |
| `/playlists/new` | AUTH | cookie + valid JWT | — | protected |
| `/playlists/[id]` | PUBLIC* | ✓ | — | optional JWT |
| `/login`, `/signup`, auth pages | PUBLIC | ✓ | — | public |
| `/impersonate` | ADMIN flow | ✓ | token query | public consume |
| `/session-expired` | PUBLIC | ✓ | — | — |
| `/admin/*` | N/A | redirect `/` | — | — |

\* Public when playlist is public.

## Admin (`apps/admin`)

| Route | Access |
|-------|--------|
| `/login`, `/unauthorized` | PUBLIC |
| All other routes | ADMIN_ONLY (JWT role + expiry in middleware) |

## Mobile (`apps/mobile`)

| Route | Access |
|-------|--------|
| `/feed`, `/explore`, `/watch/*` | PUBLIC browse |
| `/library`, `/history`, `/notifications`, `/profile/settings` | AUTH (go_router) |
| `/studio`, `/upload` | CREATOR tiers (auth_redirect) |

## API permission tiers

From `packages/shared-types/src/access.ts`:

| Tier | Permissions |
|------|-------------|
| guest | — |
| viewer | ENGAGE, USE_LIBRARY |
| creator_pending / creator_rejected | + VIEW_DASHBOARD |
| creator | + UPLOAD_VIDEO, START_STREAM |
| admin | + MANAGE_PLATFORM (admin app / `/admin` API only) |
