# Firebase Architecture Implementation — Complete

**Status:** Implemented in codebase (branch-ready). Not deployed until secrets and migration run in target environments.

## Scope delivered

| Plan item | Location |
|-----------|----------|
| Architecture docs (10 + README) | `docs/firebase/` |
| Analytics allowlist + clients | `packages/shared-types`, web `lib/analytics.ts`, mobile `forge_analytics.dart` |
| Sentry web/admin | `@sentry/nextjs`, `instrumentation.ts`, `global-error.tsx` |
| Google OAuth (Passport) | `oauth_accounts`, `GoogleStrategy`, `/auth/google` |
| FCM backend | `device_tokens`, `push-dispatch` queue, `FirebaseService` |
| FCM clients | web `fcm.ts` + SW, mobile `forge_push.dart` |
| App Check | `AppCheckGuard`, web `app-check.ts` |
| Session hardening | `forge_session` HttpOnly cookie, middleware |

## Rejected (by design)

Firestore, RTDB, Firebase Hosting, Firebase Storage, Firebase Auth as primary, Firebase Analytics for web.

## Verification

```bash
npm run build --workspace=@forge/shared-types
npm run test --workspace=@forge/shared-types
npm run test --workspace=@forge/api
npm run build --workspace=@forge/api
npm run build --workspace=@forge/web
npm run build --workspace=@forge/admin
```

## Deploy checklist

1. `npm run migration:run --workspace=@forge/api`
2. Fly secrets: `FIREBASE_*`, `FCM_ENABLED`, optional `APP_CHECK_ENABLED`, `GOOGLE_OAUTH_*`
3. Vercel env: `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`
4. Mobile: `flutterfire configure` in `apps/mobile`
5. Worker process must run `push-dispatch` consumer in production (`WORKER_ONLY=true`)

See [PRODUCTION_READINESS.md](../firebase/PRODUCTION_READINESS.md).
