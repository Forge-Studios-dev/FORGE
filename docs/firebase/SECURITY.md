# Security Report (Firebase & Auth)

## Findings

| ID | Severity | Finding | Remediation |
|----|----------|---------|-------------|
| S1 | Critical | Middleware decodes JWT without signature verify | Documented: coarse gating only; API enforces on mutations |
| S2 | High | `forge_access_token` not HttpOnly | `forge_session` HttpOnly cookie added; middleware reads both |
| S3 | High | OAuth stub only | Google Passport OAuth implemented |
| S4 | Medium | Public analytics ingest | App Check optional + allowlist |
| S5 | Medium | FCM tokens | Revoke on logout; unique token index |
| S6 | Medium | No web Sentry | `@sentry/nextjs` added |
| S7 | Low | Admin cookie not HttpOnly | Admin subdomain isolation |
| S8 | Low | Firebase Auth second surface | Policy: no Firebase Auth without ADR |

## App Check

- Header: `X-Firebase-AppCheck`
- Verified via Firebase Admin SDK when `APP_CHECK_ENABLED=true`
- Applied to: signup, login, analytics ingest (not a substitute for JWT)

**Never** treat App Check token as user authentication.

## FCM tokens

Stored in Postgres; revoked when user logs out all devices or deletes token.

## Session hardening

See [AUTH_SESSION.md](../AUTH_SESSION.md) and `apps/api/src/modules/auth/auth-cookies.ts` for `forge_session` HttpOnly cookie.
