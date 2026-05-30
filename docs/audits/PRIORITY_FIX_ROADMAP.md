# Priority Fix Roadmap

## P0 — Must fix immediately

| Item | Status |
|------|--------|
| HttpOnly `forge_refresh` cookie (API + web `withCredentials`) | **Done** |
| Middleware JWT expiry + reject admin on consumer | **Done** |
| Stop storing refresh token in web localStorage | **Done** |

## P1 — Before production

| Item | Status |
|------|--------|
| Signup honors `next` | **Done** |
| `/profile` in protected prefixes | **Done** |
| `session-expired` single encoding | **Done** |
| `playlists/new` login with `next` | **Done** |
| `NoAccessCallout` preserves `next` | **Done** |
| Middleware `next` includes search | **Done** |
| `safeReturnPath` helper | **Done** |
| Remove dead `JwtRefreshStrategy` | **Done** |
| Upload step middleware role=creator | **Done** |
| E2E auth/nav specs (7 cases) | **Done** |
| Web production build (home prerender) | **Done** |
| Unit tests (shared-types + auth-cookies) | **Done** |

## P2 — After launch

| Item | Status |
|------|--------|
| Session management UI (`ActiveSessions` on profile/settings) | **Done** |
| Per-device logout (default; `allDevices` optional) | **Done** |
| Access token memory + sessionStorage (not localStorage) | **Done** |
| Impersonation hash fragment URL | **Done** |
| Scroll/feed restoration | **Done** (home feed `useFeedScrollRestore`) |
| Production `AUTH_REFRESH_COOKIE_DOMAIN` checklist | **Done** |
| [SHIPPING.md](./SHIPPING.md) PR guide | **Done** |
| `studio.` subdomain | Pending (infra) |

## P3 — Future

| Item | Status |
|------|--------|
| Parallel/intercepting watch routes | Pending |
| OAuth Google | Pending |
| MFA | Pending |
| `@forge/auth` shared package | Pending |
