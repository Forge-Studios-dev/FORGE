# Firebase Production Readiness

## Code shipped (main)

- [x] Firebase Admin SDK module (FCM + App Check verify)
- [x] `device_tokens` + `POST /notifications/devices/register`
- [x] BullMQ `push-dispatch` worker
- [x] Web FCM service worker + `fcm.ts`
- [x] Mobile `forge_push.dart` (awaits `flutterfire configure`)
- [x] App Check guard (off by default)
- [x] Analytics client wire + Sentry web/admin
- [x] Google OAuth Passport (off by default)
- [x] Neon migrations for `oauth_accounts`, `device_tokens`

## Optional enablement (when product ready)

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
- [ ] Worker runs `push-dispatch` consumer
- [ ] `GOOGLE_OAUTH_ENABLED=true` + Google client secrets

### Web (Vercel)

- [ ] `NEXT_PUBLIC_FIREBASE_*` for FCM
- [ ] `NEXT_PUBLIC_SENTRY_DSN` (recommended)
- [ ] `NEXT_PUBLIC_APP_CHECK_SITE_KEY` when App Check on

### Mobile

- [ ] `flutterfire configure` — see [apps/mobile/FIREBASE_SETUP.md](../../apps/mobile/FIREBASE_SETUP.md)

### Security

- [ ] App Check verified on signup/login/analytics in staging
- [ ] `forge_session` HttpOnly cookie on `.forgestudios.net`
- [ ] Logout revokes FCM tokens when `allDevices=true`

## Post-enable smoke

1. Register device token after login (web + mobile)
2. Trigger `video.ready` — in-app notification + push (if FCM enabled)
3. Google OAuth round-trip when enabled
4. Analytics event in `analytics_events` within 1 min
5. Sentry test error from web

## Do not deploy

- Firestore rules / Hosting / Firebase Auth as login replacement

## Monitoring

- `push-dispatch` failed jobs
- FCM errors in worker logs
- Sentry web vs API volume
