# Authentication Audit Report

## Model

- **Custom JWT** access tokens (~15m) + **opaque DB-backed** refresh tokens (~7d).
- **No NextAuth/OAuth** (Google stub in config only).
- **Three clients:** web (localStorage + cookie mirror), admin (`forge_admin_*`), mobile (`flutter_secure_storage`).

## API (`apps/api`)

| Endpoint | Public | Notes |
|----------|--------|-------|
| POST `/auth/signup` | Yes | Issues tokens; sets HttpOnly refresh cookie |
| POST `/auth/login` | Yes | Same |
| POST `/auth/refresh` | Yes | Body or `forge_refresh` cookie |
| POST `/auth/logout` | No | Revokes all refresh rows; clears cookie |
| POST `/auth/impersonate` | Yes | 120s admin token → user session |

**Guards (global):** `JwtAuthGuard`, `RolesGuard`, `ConsumerOnlyGuard`, `PermissionsGuard`, `ThrottlerGuard`.

**Admin isolation:** `ConsumerOnlyGuard` blocks `ADMIN` role on consumer APIs.

## Web (`apps/web`)

- `AuthProvider` — `useAuth()`, tiers from `@forge/shared-types/access`.
- `persistAuthSession` — access + user in localStorage; refresh in HttpOnly cookie (not localStorage after hardening).
- `fetchMe` on mount; clears admin users from consumer app.

## Admin (`apps/admin`)

- All routes except `/login`, `/unauthorized` require `forge_admin_token` with `role===admin` and non-expired JWT in middleware.

## Mobile (`apps/mobile`)

- Flutter `go_router` redirect for protected paths.
- Dio 401 → refresh → retry or `/login`.

## Dead code

- `JwtRefreshStrategy` removed — live refresh uses opaque tokens only.
