# Shipping Firebase Integration

**Status:** Shipped — merged to `main` as `1fce253` via [PR #26](https://github.com/Forge-Studios-dev/FORGE/pull/26) (2026-05-31).

Enterprise auth on same branch: [SHIPPING_AUTH_ENTERPRISE.md](./SHIPPING_AUTH_ENTERPRISE.md). Migrations: `1742000000000-oauth-device-tokens`, `1743000000000-user-is-active`.

**Audit completion:** [docs/firebase/AUDIT_COMPLETION.md](../firebase/AUDIT_COMPLETION.md)

## Verify locally (regression)

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
