# FORGE — Authentication & Session Architecture

Consumer web, admin, mobile, and API share one auth backend with client-specific storage.

## API (`apps/api`)

| Endpoint | Notes |
|----------|--------|
| `POST /auth/login` | Sets HttpOnly `forge_refresh` cookie + returns `accessToken`, `refreshToken`, `sessionId`, `user` |
| `POST /auth/refresh` | Body `{ refreshToken }` **or** `forge_refresh` cookie |
| `POST /auth/logout` | Body `{ allDevices?: boolean }` — default revokes **current device** only |
| `GET /auth/sessions` | List active refresh sessions (authenticated) |
| `DELETE /auth/sessions/:id` | Revoke one session |

Refresh tokens are opaque, SHA-256 hashed in Postgres, rotated on each refresh. Reuse of a revoked refresh revokes all sessions for that user.

## Web consumer (`apps/web`)

| Storage | Key | Purpose |
|---------|-----|---------|
| Memory + `sessionStorage` | access token | Short-lived JWT (~15m); not in `localStorage` |
| `document.cookie` | `forge_access_token` | Edge middleware gate (decoded for `exp` + `role`) |
| HttpOnly cookie (API host) | `forge_refresh` | Silent refresh via `withCredentials: true` |
| `localStorage` | `forge_user`, `forge_session_id` | Profile cache + “This device” in settings |

Protected routes: [`middleware.ts`](../apps/web/src/middleware.ts). Return path after login: `?next=` via [`safe-return-path`](../packages/shared-types/src/safe-return-path.ts).

**Settings → Active sessions:** list devices, revoke, sign out everywhere.

## Admin (`apps/admin`)

- Access: `forge_admin_token` in `localStorage` + cookie (middleware checks `role === admin`).
- Refresh: HttpOnly `forge_refresh` cookie (same as web); `withCredentials` on API client.
- Logout calls `POST /auth/logout` then clears admin tokens.

## Mobile (`apps/mobile`)

- `flutter_secure_storage` for access, refresh, user, `sessionId`.
- Refresh still sent in JSON body (no browser cookie jar).
- `logout(allDevices: true)` supported on repository.

## Production cookies

Set `AUTH_REFRESH_COOKIE_DOMAIN=.forgestudios.net` on API when web (`forgestudios.net`) and API (`api.forgestudios.net`) differ. Cookie uses `SameSite=None; Secure` in production.

## Audit reference

Full navigation/auth audit: [audits/README.md](./audits/README.md).

## Local verification

```bash
npm run test --workspace=@forge/shared-types
npm run test --workspace=apps/api -- --testPathPattern=auth
npm run build --workspace=apps/web
cd apps/web && npm run test:e2e -- e2e/auth-nav.spec.ts
```
