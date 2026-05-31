# Session Management (Phase 7)

## Model

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access JWT | ~15m | Web: sessionStorage + cookie mirror; Mobile: secure storage |
| Refresh opaque | ~7d | HttpOnly `forge_refresh` (web); body (mobile) |
| Session marker | 7d | HttpOnly `forge_session` (middleware) |

## Behaviors (YouTube-aligned)

- **Persistent login:** Refresh cookie survives browser restart
- **Rotation:** Each refresh revokes previous refresh row
- **Reuse detection:** Stolen refresh → revoke all user sessions
- **Multi-device:** Independent refresh rows per login
- **Multi-tab:** Shared sessionStorage + cookie; `AUTH_SESSION_EVENT` sync
- **Logout one device:** Revoke matching refresh hash
- **Logout all:** `POST /auth/logout { allDevices: true }`

## Avoid loops

- Web middleware: valid JWT + session cookie (legacy sessions without cookie still work)
- 401 interceptor: single refresh retry; then `/session-expired`
- No Firebase session refresh parallel path

## Gaps

- Access JWT valid until expiry after logout (documented; shorten TTL or denylist for high security)
- No server-side “login history” table (metadata on refresh rows only)
