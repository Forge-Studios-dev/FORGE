# Email Sign Up & Sign In

## Sign up flow (implemented)

1. User submits email, username, password, display name
2. API validates DTO (8+ chars, upper/lower/digit)
3. Disposable email domains rejected
4. Uniqueness check (email + username)
5. bcrypt hash → `users` row
6. JWT + opaque refresh issued
7. Verification email sent (48h link)
8. User can browse as **viewer** before verify (YouTube-like)

**Optional env:** `AUTH_REQUIRE_VERIFIED_LOGIN=true` blocks login until verified.

## Sign in flow (implemented)

1. App Check token (when enabled)
2. Lockout check (`auth:lock:{email}` in Redis)
3. bcrypt verify
4. On failure: increment counter; lock after 10 failures / 15 min window (configurable)
5. Google-only account → `USE_GOOGLE_SIGNIN` error code
6. Issue tokens + `forge_session` + `forge_refresh` cookies
7. Web 401 → refresh → `/session-expired`

## Error codes (API `code` field)

| Code | HTTP | Meaning |
|------|------|---------|
| `ACCOUNT_LOCKED` | 401 | Too many failed logins |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked when strict mode on |
| `USE_GOOGLE_SIGNIN` | 401 | Password login on Google-linked account |

## Email verification (Phase 3)

- **Send:** signup + `POST /auth/verify-email/resend` (JWT, 5/hour)
- **Consume:** `GET /auth/verify-email?token=`
- **Enforcement:** Creator apply/upload/live require `isVerified`; banner on web for unverified creators
- **Cross-device:** `isVerified` in DB; refresh `/users/me` updates client

Edge cases covered: expired token, already verified, invalid token, resend while logged in.
