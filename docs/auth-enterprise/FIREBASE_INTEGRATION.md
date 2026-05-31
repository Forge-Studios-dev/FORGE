# Firebase Integration Guide (Phase 10)

## Use Firebase for

- **FCM** — push notifications
- **App Check** — bot protection on signup/login/analytics
- **Optional** Performance (mobile)

## Do NOT use for

- Email/password identity
- Session cookies
- User database of record

## CLI (complement only)

```bash
npm install -g firebase-tools
firebase login
firebase projects:create forge-studios-prod
# Enable: Cloud Messaging, App Check
# Do NOT enable Firestore or Hosting for FORGE core
```

See [docs/firebase/CLI_SETUP.md](../firebase/CLI_SETUP.md).

## Environment variables

**API:** `FIREBASE_*`, `FCM_ENABLED`, `APP_CHECK_ENABLED`  
**Web:** `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_APP_CHECK_SITE_KEY`  
**Auth (custom):** `JWT_SECRET`, `AUTH_REFRESH_COOKIE_DOMAIN`, `AUTH_LOCKOUT_*`

## Next.js integration

- Auth: `AuthProvider` + `api.ts` refresh interceptor — **not** Firebase Auth SDK for login
- App Check: `app-check.ts` + request interceptor
- FCM: `fcm.ts` + service worker after login

## Admin SDK

`FirebaseService` in API — messaging + App Check verify only.

## If you must use Firebase Auth (not recommended)

Would require: dual-write users, Cloud Function token exchange → FORGE JWT, full migration ADR. Est. 4–8 weeks. **Rejected** for current roadmap.
