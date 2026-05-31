# Auth & Firebase Enablement Guide

Enable **Google Sign-In**, **email verification links**, and **Firebase (FCM)** on production. Identity stays **custom JWT + Postgres** — Firebase Console → Authentication will remain empty (by design).

## Prerequisites

- Fly access to `forge-studios-api`
- Google Cloud / Firebase project
- SMTP provider (Resend, SendGrid, Mailgun, etc.)
- Vercel access for web env vars (optional for Google button if API flag is enough)

## Quick deploy (production)

### Option A — local env file + Fly CLI

1. Copy the template:

```bash
cp secrets/auth-deploy.env.example secrets/auth-deploy.env
```

2. Fill `secrets/auth-deploy.env` (see sections below).

3. Deploy to Fly:

```bash
bash scripts/deploy-auth-secrets.sh
```

4. Verify (wait ~2 min for Fly restart):

```bash
bash scripts/verify-production-auth.sh
curl -s https://api.forgestudios.net/api/v1/platform/config | python3 -m json.tool
```

Expect:

- `auth.googleOAuth`: `true`
- `auth.mailConfigured`: `true`
- `firebase.adminConfigured`: `true`
- `firebase.fcmEnabled`: `true`
- `firebase.usesFirebaseAuth`: `false`

5. Open https://forgestudios.net/login — **Continue with Google** should appear.

Check Fly only (no values printed):

```bash
bash scripts/check-auth-env.sh fly
```

### Option B — GitHub Actions (CI token)

1. `cp secrets/auth-deploy.env.example secrets/auth-deploy.env` and fill values.
2. `bash scripts/push-auth-secrets-to-github.sh`
3. `gh workflow run deploy-auth-secrets.yml --ref main`

Requires GitHub secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_PASS`, `FIREBASE_*`, plus existing `FLY_API_TOKEN`.

### Local dev (Mailpit)

```bash
npm run auth:bootstrap
npm run dev:api
# Signup → open http://localhost:8025 for verification email
```

---


## 1. Google OAuth

### Google Cloud Console

1. **APIs & Services → Credentials → Create credentials → OAuth client ID** (Web application).
2. **Authorized JavaScript origins:**
   - `https://forgestudios.net`
   - `http://localhost:3000` (local dev)
3. **Authorized redirect URIs:**
   - `https://api.forgestudios.net/api/v1/auth/google/callback`
   - `http://localhost:3001/api/v1/auth/google/callback` (local dev)

### Variables

| Variable | Example |
|----------|---------|
| `GOOGLE_OAUTH_ENABLED` | `true` |
| `GOOGLE_CLIENT_ID` | `….apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | from console |
| `GOOGLE_OAUTH_CALLBACK_URL` | `https://api.forgestudios.net/api/v1/auth/google/callback` |
| `WEB_OAUTH_SUCCESS_URL` | `https://forgestudios.net/auth/oauth/callback` |
| `WEB_URL` | `https://forgestudios.net` |

`WEB_URL` is already set on Fly; confirm it matches production.

### Local dev

In `apps/api/.env`:

```bash
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback
WEB_OAUTH_SUCCESS_URL=http://localhost:3000/auth/oauth/callback
WEB_URL=http://localhost:3000
```

Optional in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

---

## 2. Email (SMTP) — verification & password reset

Without SMTP, signup works but **no email is sent** (API logs the link only).

### Resend example

| Variable | Value |
|----------|--------|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | Resend API key |
| `MAIL_FROM` | `noreply@forgestudios.net` (verified domain) |

### Manual smoke

1. Sign up at `/signup` with a real inbox.
2. Open verification email → `/verify-email?token=…`
3. Sign in at `/login`
4. Test `/forgot-password`

**Email OTP is not implemented** — verification uses **links** only ([OTP_RECOMMENDATION.md](./OTP_RECOMMENDATION.md)).

---

## 3. Firebase (FCM + App Check — not login)

### Firebase Console

1. Create or select project.
2. **Project settings → Service accounts → Generate new private key** → use in `FIREBASE_*` env.
3. **Project settings → General** → add Web app → copy config for Vercel.
4. **Cloud Messaging** → Web Push certificates → VAPID key.
5. Do **not** enable Email/Google under **Authentication** if keeping custom auth.

### Fly variables

| Variable | Notes |
|----------|--------|
| `FIREBASE_PROJECT_ID` | Project ID |
| `FIREBASE_CLIENT_EMAIL` | From service account JSON |
| `FIREBASE_PRIVATE_KEY` | Use `\n` for newlines in Fly secret |
| `FCM_ENABLED` | `true` |
| `APP_CHECK_ENABLED` | `false` until clients send App Check tokens |

### Vercel (web)

Set in the web project:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

(`AUTH_DOMAIN` is for SDK init only — the app does not use `firebase/auth`.)

### Mobile

```bash
FIREBASE_PROJECT_ID=your-project-id bash scripts/configure-mobile-firebase.sh
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No Google button | `auth.googleOAuth` false → set Google secrets, redeploy API |
| No verification email | `auth.mailConfigured` false → set SMTP secrets |
| Firebase Console Auth empty | Expected — users are in Postgres |
| Google redirect error | Redirect URI must match `GOOGLE_OAUTH_CALLBACK_URL` exactly |
| Local check | `bash scripts/check-auth-env.sh` |

## Related

- [POST_DEPLOY.md](./POST_DEPLOY.md)
- [IMPLEMENTATION_STATUS_AUDIT.md](./IMPLEMENTATION_STATUS_AUDIT.md)
- [../firebase/AUTH_DESIGN.md](../firebase/AUTH_DESIGN.md)
