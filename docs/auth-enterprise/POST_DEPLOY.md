# Post-Deploy — Enterprise Auth + Firebase

**Status:** Production operational (2026-05-31).

**Shipped:** PR [#26](https://github.com/Forge-Studios-dev/FORGE/pull/26)–[#32](https://github.com/Forge-Studios-dev/FORGE/pull/32) (platform `auth`/`firebase` flags, mobile Google OAuth).

**Web:** Login/signup read `GET /platform/config` for Google button (`apps/web/src/lib/platform-config.ts`) — env `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` still works as override.

## 1. Production release

- [x] **Release (production)** succeeded (API Fly + Vercel web/admin)
- [x] API health: `https://api.forgestudios.net/api/v1/health` → 200 (db + redis ok)
- [x] Public smoke: `FORGE_SMOKE_MODE=public scripts/smoke-api.sh` passes

## 2. Database migrations

Verified on Neon project **Forge** (`orange-math-53675581`):

| Migration | Status |
|-----------|--------|
| `OAuthDeviceTokens1742000000000` | Applied — `oauth_accounts`, `device_tokens` exist |
| `UserIsActive1743000000000` | Applied — `users.is_active` exists |

Re-run locally only if a new environment is provisioned:

```bash
npm run migration:run --workspace=@forge/api
```

## 3. Fly secrets (enable Google, SMTP, Firebase)

**Step-by-step:** [ENABLEMENT_GUIDE.md](./ENABLEMENT_GUIDE.md)

```bash
cp secrets/auth-deploy.env.example secrets/auth-deploy.env
# Edit secrets/auth-deploy.env with Google, SMTP, Firebase values
bash scripts/deploy-auth-secrets.sh
bash scripts/check-auth-env.sh fly
```

`AUTH_REFRESH_COOKIE_DOMAIN` is already set on Fly. Firebase Console → **Authentication** stays empty (users are in Postgres).

Keep `APP_CHECK_ENABLED=false` until web/mobile send App Check tokens.

After deploy, confirm capability flags:

```bash
bash scripts/verify-production-auth.sh
# Expect data.auth.provider=custom and data.firebase.usesFirebaseAuth=false
```

## 4. Vercel (web)

- [x] Site responds: `https://forgestudios.net` → 200
- Optional when enabling features: `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`, `NEXT_PUBLIC_SENTRY_DSN`

## 5. Manual smoke (recommended once per release)

- [x] Public API routes (automated smoke)
- [ ] Email signup + verification email (requires SMTP)
- [ ] Login / refresh / logout
- [ ] Forgot password → reset → sessions revoked
- [ ] Settings → Active sessions / `GET /auth/login-history`
- [ ] Creator upload blocked until verified (web middleware + e2e)

## 6. Mobile

- [ ] `bash scripts/configure-mobile-firebase.sh` (requires `FIREBASE_PROJECT_ID` + Firebase CLI login)

## Architecture

**Custom JWT + Postgres** = identity. Firebase = FCM + App Check complement only.

Full audit: [README.md](./README.md) · Diagrams: [DELIVERABLES.md](./DELIVERABLES.md)
