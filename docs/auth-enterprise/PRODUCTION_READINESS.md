# Production Readiness — Enterprise Auth

## Code complete

- [x] Email signup/signin with strong passwords
- [x] Verification links + resend
- [x] Forgot/reset with session revoke
- [x] Google OAuth + account linking
- [x] Refresh rotation + multi-device sessions
- [x] Account lockout (Redis)
- [x] Disposable email block
- [x] Optional strict verified login
- [x] Auth error codes in API responses
- [x] Web login handles verification + Google hints
- [x] Disabled accounts (`is_active`, `ACCOUNT_DISABLED`)
- [x] Login history API (`GET /auth/login-history`)
- [x] New-device login signal (`auth.login.new_device`)
- [x] Middleware gates unverified creators on upload
- [x] Mobile verify-email resend + signup redirect

## Before launch

- [ ] Run migrations `1742000000000-oauth-device-tokens`, `1743000000000-user-is-active` if not applied
- [ ] Redis available in production (lockout + queues)
- [ ] SMTP configured for deliverability (SPF/DKIM)
- [ ] `AUTH_REFRESH_COOKIE_DOMAIN=.forgestudios.net` on Fly
- [ ] Decide `AUTH_REQUIRE_VERIFIED_LOGIN` (default false = YouTube-like)
- [x] E2E: `apps/web/e2e/auth-nav.spec.ts` (8 cases incl. verify-email middleware)

## Post-PMF

- MFA / TOTP
- Login audit log table
- JWT denylist on logout
- Google sign-in on mobile
- Full disposable domain API (e.g. commercial blocklist)

## Success criteria mapping

| Criterion | Status |
|-----------|--------|
| Secure | Lockout, rotation, bcrypt, App Check optional |
| Scalable | Postgres + Redis, stateless API |
| Session-safe | Refresh rotation, session-expired UX |
| Multi-device | Session list + revoke |
| SSR / App Router | Cookie + middleware |
| Enterprise-grade | Custom platform, not basic Firebase login |
