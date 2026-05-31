# Implementation Status Audit — Auth, Firebase & PDF Specs

**Date:** 2026-05-31  
**Sources:** Email Authentication PDF, Firebase Architecture PDF, shipped code on `main`.

---

## Critical clarification

The PDFs describe building auth **“using Firebase Authentication.”**  
The **Firebase Architecture Audit** (approved and shipped) explicitly **rejects Firebase Auth as the login system**.

| What you might expect | What FORGE actually does |
|----------------------|---------------------------|
| `signInWithEmailAndPassword()` | `POST /api/v1/auth/login` → bcrypt + **custom JWT** |
| `createUserWithEmailAndPassword()` | `POST /api/v1/auth/signup` → **Postgres `users`** |
| Firebase Google Sign-In SDK | **Passport** `GET /auth/google` → `oauth_accounts` |
| Firebase password reset emails | **Custom** tokens in Postgres + **SMTP** |
| Firebase email verification | **Custom** 48h link + hashed token in DB |
| Firebase session cookies | **HttpOnly `forge_refresh`** + JWT access token |

**Firebase in FORGE is only a complement:** push (FCM), optional bot protection (App Check), not identity.

---

## Is the project “connected to Firebase”?

| Layer | Connected? | Details |
|-------|------------|---------|
| **API (production)** | **Optional / likely off** | `FirebaseService` only initializes if `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are set. Defaults: `FCM_ENABLED=false`, `APP_CHECK_ENABLED=false`. |
| **Web** | **Code ready, env-dependent** | Uses `firebase/app`, `firebase/app-check`, `firebase/messaging` — **not** `firebase/auth`. Google button from `GET /platform/config` (`auth.googleOAuth`) or `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`. |
| **Mobile** | **Not connected** | `firebase_options.dart` = `REPLACE_ME` — run `bash scripts/configure-mobile-firebase.sh` after Firebase project access. |
| **Login / signup / reset** | **Not via Firebase Auth** | 100% custom API + Postgres |

**Verdict:** The repo has **Firebase integration code**, but production is **not** using Firebase for sign-in unless you separately configured secrets. Identity is **always** your API.

---

## Feature-by-feature matrix (Email Auth PDF)

| Requirement | Implemented? | How (not Firebase Auth) |
|-------------|--------------|-------------------------|
| **Email sign up** | ✅ Yes | `POST /auth/signup`, `SignupDto`, disposable email block, bcrypt |
| **Email sign in** | ✅ Yes | `POST /auth/login`, lockout, error codes |
| **Google sign in** | ✅ Code / ⚠️ ops | Passport + `oauth_accounts`; **off** unless `GOOGLE_OAUTH_ENABLED=true` |
| **Google sign up** | ✅ Same flow | New Google user → create `users` row + oauth link |
| **Email verification** | ✅ Yes | SMTP link 48h; `GET /auth/verify-email`; resend `POST /auth/verify-email/resend` |
| **Verification via OTP** | ❌ No (by design) | [OTP_RECOMMENDATION.md](./OTP_RECOMMENDATION.md) — links only |
| **Forgot password** | ✅ Yes | `POST /auth/forgot-password` (enumeration-safe) |
| **Reset password** | ✅ Yes | `POST /auth/reset-password`, revokes all sessions |
| **Account recovery** | ✅ Yes | Reset flow + optional strict login `AUTH_REQUIRE_VERIFIED_LOGIN` |
| **Session management** | ✅ Yes | JWT + opaque refresh, rotation, `forge_session` cookie |
| **Multi-device login** | ✅ Yes | `GET /auth/sessions`, revoke, logout all |
| **Account lockout** | ✅ Yes | Redis `AuthAccountLockoutService` |
| **Disabled account** | ✅ Yes | `users.is_active`, `ACCOUNT_DISABLED` |
| **Strong password** | ✅ Yes | DTO regex + bcrypt 12 rounds |
| **Rate limiting** | ✅ Yes | Throttler + per-route limits |
| **Protected routes (web)** | ✅ Yes | `middleware.ts` + creator verify gate |
| **MFA / TOTP** | ❌ Post-PMF | Documented backlog |

### Web UI pages

| Page | Path | Status |
|------|------|--------|
| Login | `/login` | ✅ `LoginForm.tsx` |
| Signup | `/signup` | ✅ `SignupForm.tsx` |
| Forgot password | `/forgot-password` | ✅ |
| Reset password | `/reset-password?token=` | ✅ |
| Verify email | `/verify-email` | ✅ + resend prompt |
| Session expired | `/session-expired` | ✅ |
| Google OAuth callback | `/auth/oauth/callback` | ✅ |
| OTP page | — | ❌ Not planned |

### Mobile

| Flow | Status |
|------|--------|
| Login / signup / forgot / reset / verify | ✅ Screens + `auth_repository.dart` |
| Google sign-in | ❌ Web only (no mobile Google button yet) |
| Error codes (locked, disabled, Google-only) | ✅ Partial |

---

## Feature-by-feature matrix (Firebase Architecture PDF)

| Plan item | Implemented? | Notes |
|-----------|--------------|-------|
| **Do NOT use Firebase Auth primary** | ✅ Followed | [AUTH_DESIGN.md](../firebase/AUTH_DESIGN.md) |
| **FCM push** | ✅ Code | Worker + `device_tokens`; needs `FCM_ENABLED` + secrets |
| **App Check** | ✅ Code | Guard on signup/login/analytics; default **off** |
| **Analytics ingest** | ✅ Yes | `POST /analytics/events`, web + mobile clients |
| **Sentry web/admin** | ✅ Yes | `@sentry/nextjs` |
| **Google OAuth (Passport)** | ✅ Yes | Not Firebase Google provider |
| **Session hardening** | ✅ Yes | `forge_session` HttpOnly |
| **Firestore / RTDB / Hosting / Storage** | ✅ Not used | As planned |
| **Firebase Analytics primary** | ✅ Not used | First-party events |
| **CLI / firebase/** folder | ✅ Yes | `firebase/.firebaserc`, docs |
| **flutterfire mobile** | ❌ Ops pending | Stubs remain |

---

## What runs in production today (verified)

- API health: `https://api.forgestudios.net/api/v1/health` → 200
- Neon DB: `oauth_accounts`, `device_tokens`, `users.is_active` migrations **applied**
- Email login works via **custom API** (not Firebase Auth console users)

---

## What is NOT implemented (and why)

1. **Firebase Authentication for email/Google login** — Intentionally replaced by custom auth (scalability, one user DB, sessions, admin tools).
2. **Email OTP verification** — Deferred; verification **links** shipped instead.
3. **Full Firebase project wiring in prod** — Waiting on Fly/Vercel secrets + `flutterfire configure`.
4. **Google OAuth in production** — Code shipped; enable with env vars.
5. **App Check enforced** — Code shipped; enable after clients send tokens.

---

## If you want “everything through Firebase Auth”

That would be a **new project** (4–8 weeks): dual-write users, token exchange API, rewrite web/mobile login, lose current session model. **Not what was merged.**

Recommended path: **keep current platform** and only enable optional Firebase secrets for FCM/App Check.

---

## Runtime capability check (production)

```bash
curl -s https://api.forgestudios.net/api/v1/platform/config | python3 -m json.tool
# auth.provider = "custom"
# auth.googleOAuth = true/false (env)
# firebase.usesFirebaseAuth = false
```

Or: `bash scripts/verify-production-auth.sh`

## Quick verification commands

```bash
# Custom auth (local)
curl -X POST http://localhost:3001/api/v1/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","username":"testuser","displayName":"Test","password":"SecurePass1"}'

# Google (when enabled)
open "http://localhost:3001/api/v1/auth/google"

# Confirm NO firebase/auth in app code
rg "firebase/auth|signInWithEmail" apps --glob '!package-lock.json'
# Should be empty in application source
```

---

## Related docs

- [README.md](./README.md) — Enterprise auth index  
- [DELIVERABLES.md](./DELIVERABLES.md) — Diagrams  
- [POST_DEPLOY.md](./POST_DEPLOY.md) — Enable Firebase complement  
- [../firebase/AUDIT_COMPLETION.md](../firebase/AUDIT_COMPLETION.md) — Firebase plan closure  
