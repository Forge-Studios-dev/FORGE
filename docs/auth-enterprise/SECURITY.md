# Security (Phases 8 & 12)

## Implemented protections

| Control | Implementation |
|---------|----------------|
| Rate limiting | Global Throttler + per-route auth limits |
| Failed login lockout | Redis `AuthAccountLockoutService` |
| bcrypt passwords | 12 rounds |
| Refresh reuse detection | Revoke all on reuse |
| Enumeration-safe forgot | Always 204 |
| Disposable email block | Signup blocklist |
| App Check | Optional on signup/login/analytics |
| HTTPS cookies | `secure` + `sameSite` in production |
| New-device signal | `auth.login.new_device` when IP not seen on prior sessions |

## Findings

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C1 | Critical | Middleware JWT not signature-verified | Documented; API enforces |
| H1 | High | Access token in non-HttpOnly cookie | Mitigated with `forge_session` |
| H2 | High | No account lockout | **Fixed** (Redis) |
| M1 | Medium | Soft email verification | Configurable strict login |
| M2 | Medium | No MFA | Post-PMF |
| L1 | Low | Google mobile missing | Backlog |
| — | — | Disabled accounts | `is_active` + `ACCOUNT_DISABLED` |
| — | — | Login history | `GET /auth/login-history` (= session sign-in times) |

## Device management

- `GET /auth/sessions` — device label, user agent, created
- `DELETE /auth/sessions/:id` — revoke
- Logout all devices — web settings UI

## Firebase Rules

N/A — no Firestore. Postgres + API guards are authoritative.
