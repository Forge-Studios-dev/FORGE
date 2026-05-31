# Session Hardening ADR

## Context

Next.js middleware gates routes using `forge_access_token` (JWT in a non-HttpOnly cookie). Signature verification at the edge requires shared secret distribution to Vercel — avoided for now.

## Decision

1. **Coarse edge gating** — middleware decodes JWT expiry and role only (unchanged risk profile, documented in SECURITY.md).
2. **HttpOnly session marker** — API sets `forge_session=1` HttpOnly cookie on login/refresh/signup alongside existing tokens. Middleware treats presence + valid access token as authenticated.
3. **Authoritative API** — all mutations and sensitive reads require Bearer JWT verified by Passport.

## `forge_session` cookie

- Set by API in `auth-cookies.ts` with same domain policy as `forge_refresh`
- Cleared on logout
- Does not contain JWT — reduces XSS exfiltration value of forge_access_token alone

## Future options

- Edge JWT verify with `JWT_SECRET` in Vercel env (rotate carefully)
- Short-lived signed session cookie containing only `sub` + `exp`

## Sensitive Server Components

Call `GET /users/me` with Bearer from server when page requires guaranteed auth state.
