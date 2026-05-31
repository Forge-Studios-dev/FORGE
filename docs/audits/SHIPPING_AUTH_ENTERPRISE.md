# Shipping — Enterprise Auth + Firebase Complement

**Branch:** `feat/firebase-integration`  
**PR:** [#26](https://github.com/Forge-Studios-dev/FORGE/pull/26)  
**CI:** GitHub Actions + `npm run ci:local` passing (2026-05-31).  
**Shipped:** Merged to `main` (`1fce253`).

## Scope

| Workstream | Status |
|------------|--------|
| Firebase complement (FCM, App Check, analytics, Sentry) | Done |
| Google OAuth (Passport, not Firebase Auth) | Done |
| Enterprise email auth (lockout, disposable, verification, reset) | Done |
| Docs `docs/auth-enterprise/` + `docs/firebase/` | Done |

## Pre-merge verification

```bash
npm run test --workspace=@forge/shared-types
npm run test --workspace=@forge/api
npm run build --workspace=apps/web
cd apps/web && npm run test:e2e -- e2e/auth-nav.spec.ts
```

## Post-merge (production)

1. Run DB migrations:
   - `1742000000000-oauth-device-tokens`
   - `1743000000000-user-is-active`
2. Fly secrets: `FIREBASE_*`, `GOOGLE_OAUTH_*`, `AUTH_LOCKOUT_*`, `AUTH_REFRESH_COOKIE_DOMAIN`
3. Vercel: `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`
4. Firebase console: enable FCM + App Check; **do not** enable Firebase Auth as IdP

## Architecture reminder

**Custom JWT + Postgres** = system of record. Firebase = push + optional attestation only.

See [docs/auth-enterprise/README.md](../auth-enterprise/README.md).
