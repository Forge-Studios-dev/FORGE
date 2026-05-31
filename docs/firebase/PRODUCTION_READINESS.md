# Firebase Production Readiness

Aligned with [SHIPPING.md](../audits/SHIPPING.md) and platform deploy gates.

## Pre-merge checklist

### Firebase project

- [ ] Blaze billing enabled (FCM Admin at scale)
- [ ] Web, Android, iOS apps registered
- [ ] Service account key in Fly secrets (not in git)
- [ ] APNs key uploaded (iOS push)
- [ ] Web push VAPID key in Vercel env

### API (Fly)

- [ ] `FCM_ENABLED=true` when ready to send
- [ ] `APP_CHECK_ENABLED=true` after clients ship tokens
- [ ] `FIREBASE_*` secrets set
- [ ] Worker runs `push-dispatch` consumer (`ENABLE_PUSH_WORKER` or shared worker)
- [ ] `GOOGLE_OAUTH_*` if Google sign-in live

### Web (Vercel)

- [ ] `NEXT_PUBLIC_FIREBASE_*` for FCM
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `NEXT_PUBLIC_APP_CHECK_SITE_KEY` when App Check on
- [ ] Service worker reachable at `/firebase-messaging-sw.js`

### Mobile

- [ ] `flutterfire configure` for prod project
- [ ] Push permissions UX tested on iOS/Android

### Security

- [ ] App Check verified on signup/login/analytics in staging
- [ ] `forge_session` HttpOnly cookie works cross-subdomain (`.forgestudios.net`)
- [ ] Logout revokes FCM tokens when `allDevices=true`

## Post-merge smoke

1. Register device token after login (web + mobile)
2. Trigger `video.ready` — in-app notification + push (if FCM enabled)
3. Google OAuth round-trip on staging
4. Analytics event appears in `analytics_events` within 1 min
5. Sentry receives test error from web

## Monitoring

- Queue depth: `push-dispatch` failed jobs
- FCM error rate in worker logs
- Sentry issue volume web vs API

## Do not deploy

- Firestore rules
- Firebase Hosting
- Firebase Auth as login replacement
