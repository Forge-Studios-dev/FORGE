# Shipping Firebase Integration

**Status:** Ready for PR (code complete; `npm run ci:local` passes).

**Do not push directly to `main`** — one branch, one PR, one deploy.

## Branch

```bash
git fetch origin main
git checkout -b feat/firebase-integration
# stage all firebase-related changes, commit when ready
git push -u origin HEAD
```

## Verify locally

```bash
npm run ci:local
npm run migration:run --workspace=@forge/api   # requires Postgres
```

## Scope

| Component | Paths |
|-----------|--------|
| API | `apps/api/src/modules/firebase/`, `auth/google`, `notifications/devices`, `push-dispatch` |
| Web | `apps/web/src/lib/analytics.ts`, `fcm.ts`, `app-check.ts`, Sentry configs |
| Admin | Sentry + `global-error.tsx` |
| Mobile | `lib/core/analytics/`, `lib/core/push/`, `lib/core/app_check/` |
| Docs | `docs/firebase/` |

## Production secrets (after merge)

```bash
# Fly API
fly secrets set \
  FIREBASE_PROJECT_ID=... \
  FIREBASE_CLIENT_EMAIL=... \
  FIREBASE_PRIVATE_KEY='...' \
  FCM_ENABLED=true \
  APP_CHECK_ENABLED=false \
  GOOGLE_OAUTH_ENABLED=false \
  --app forge-studios-api

# Enable App Check only after web/mobile clients send tokens
# fly secrets set APP_CHECK_ENABLED=true --app forge-studios-api
```

Vercel (web): `NEXT_PUBLIC_SENTRY_DSN`, optional `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`.

Full checklist: [docs/firebase/PRODUCTION_READINESS.md](../firebase/PRODUCTION_READINESS.md).

## Post-merge smoke

- Email login still works (App Check off by default)
- `POST /analytics/events` accepts allowlisted event from web (watch page)
- Google OAuth round-trip when `GOOGLE_OAUTH_ENABLED=true`
- FCM: register device after login when Firebase client env set
