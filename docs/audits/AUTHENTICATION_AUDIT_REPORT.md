# Authentication Audit Report

**Last updated:** Enterprise auth pass (custom JWT + Postgres; Firebase complement only).

## Model

- **Custom JWT** access tokens (~15m) + **opaque DB-backed** refresh tokens (~7d).
- **Google OAuth** via Passport (`oauth_accounts` linking) — not Firebase Auth.
- **Three clients:** web (sessionStorage + HttpOnly cookies), admin (`forge_admin_*`), mobile (`flutter_secure_storage`).

Full enterprise audit: [docs/auth-enterprise/README.md](../auth-enterprise/README.md).

## API (`apps/api`)

| Endpoint | Public | Notes |
|----------|--------|-------|
| POST `/auth/signup` | Yes | Disposable email block; verification email |
| POST `/auth/login` | Yes | Lockout; optional strict verified login |
| POST `/auth/refresh` | Yes | Body or `forge_refresh` cookie |
| POST `/auth/logout` | No | Revoke session(s) |
| POST `/auth/forgot-password` | Yes | Enumeration-safe 204 |
| POST `/auth/reset-password` | Yes | Revokes all refresh tokens |
| GET `/auth/google` | Yes | When `GOOGLE_OAUTH_ENABLED` |
| POST `/auth/verify-email/resend` | JWT | Rate limited |
| GET `/auth/verify-email` | Yes | 48h token |

**Guards (global):** `JwtAuthGuard`, `RolesGuard`, `ConsumerOnlyGuard`, `PermissionsGuard`, `ThrottlerGuard`, `EmailVerifiedGuard` (opt-in via `@RequireVerified()`).

**Creator paths:** `CreatorApprovedGuard` enforces `isVerified` + approved status.

**Auth error codes:** `ACCOUNT_LOCKED`, `EMAIL_NOT_VERIFIED`, `USE_GOOGLE_SIGNIN`.

## Web (`apps/web`)

- Middleware: JWT + `forge_session` on protected routes.
- Login handles verification redirect and Google-only accounts.
- OAuth callback: `/auth/oauth/callback`.

## Admin (`apps/admin`)

- Middleware requires `forge_admin_token`, `role === admin`.

## Mobile (`apps/mobile`)

- Dio 401 → refresh → login.
- Login parses API `code` for unverified email.

## Security enhancements (this pass)

| Control | Status |
|---------|--------|
| Account lockout (Redis) | Shipped |
| Disposable email block | Shipped |
| Strict verified login (env) | Optional |
| App Check on auth | Optional |

## Intentionally not used

- Firebase Authentication as primary IdP
- Email OTP (see [OTP_RECOMMENDATION.md](../auth-enterprise/OTP_RECOMMENDATION.md))

## Dead code

- `JwtRefreshStrategy` removed — opaque refresh only.
