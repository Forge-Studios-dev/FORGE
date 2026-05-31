# Post-Deploy — Enterprise Auth + Firebase

**Shipped:** `main` — PR [#26](https://github.com/Forge-Studios-dev/FORGE/pull/26), hotfix [#27](https://github.com/Forge-Studios-dev/FORGE/pull/27) (EmailVerifiedGuard DI).

## 1. Re-run production release (if Fly deploy failed)

PR #26 deploy failed (API crash loop — guard DI). **#27 fixes boot.** Trigger:

```bash
gh workflow run "Release (production)" --ref main
gh run list --workflow="Release (production)" --limit 1
```

Or: GitHub → Actions → **Release (production)** → Run workflow.

## 2. Database migrations

Run against production Postgres (Neon):

```bash
npm run migration:run --workspace=@forge/api
```

New migrations:

| Migration | Purpose |
|-----------|---------|
| `1742000000000-oauth-device-tokens` | `oauth_accounts`, `device_tokens` |
| `1743000000000-user-is-active` | `users.is_active` for disabled accounts |

## 3. Fly secrets (optional features)

```bash
fly secrets set \
  AUTH_REFRESH_COOKIE_DOMAIN='.forgestudios.net' \
  --app forge-studios-api

# When Firebase project ready:
# FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
# FCM_ENABLED=true
# GOOGLE_OAUTH_ENABLED=true + GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_CALLBACK_URL
```

Keep `APP_CHECK_ENABLED=false` until web/mobile send App Check tokens.

## 4. Vercel (web)

- `NEXT_PUBLIC_API_URL` → production API
- Optional: `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`, `NEXT_PUBLIC_SENTRY_DSN`

## 5. Smoke tests

- [ ] `GET https://api.forgestudios.net/api/v1/health` (or your API host)
- [ ] Email signup + verification email
- [ ] Login / refresh / logout
- [ ] Forgot password → reset → all sessions revoked
- [ ] Settings → Active sessions / login history
- [ ] Creator upload blocked until `isVerified` (middleware)

## 6. Mobile

Run `flutterfire configure` and replace `apps/mobile/lib/firebase_options.dart` stubs before FCM/App Check on mobile.
