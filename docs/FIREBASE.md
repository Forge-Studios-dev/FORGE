# Firebase (complement only)

**Not used for login.** Identity is [AUTH.md](./AUTH.md) (JWT + Postgres). Firebase provides **FCM push** and optional **App Check**.

`GET /platform/config` → `firebase.usesFirebaseAuth: false` always.

---

## Mobile setup

```bash
dart pub global activate flutterfire_cli
cd apps/mobile && flutterfire configure --project=YOUR_PROJECT_ID
```

Commit generated `lib/firebase_options.dart`.

- **iOS:** APNs key in Firebase Console → Cloud Messaging; enable push in Xcode
- **Android:** `google-services.json` from FlutterFire configure

Until configured, `lib/firebase_options.dart` uses `REPLACE_ME` stubs and push is skipped safely.

Verify after login: `POST /notifications/devices/register` with a valid FCM token.

---

## API (Fly)

Service account JSON or workload identity (preferred if org blocks key creation):

```bash
bash scripts/deploy-firebase-json-secret.sh
# or: scripts in AUTH.md enablement flow
```

Env: `FIREBASE_PROJECT_ID`, credentials, `firebase.fcmEnabled=true`.

---

## FCM flow

1. `POST /notifications/devices/register` — `{ platform, fcmToken }`
2. Events (`video.ready`, `stream.started`, …) → `push-dispatch` queue
3. Worker sends via `firebase-admin` multicast; prunes dead tokens

In-app notifications (Postgres) unchanged.

---

## Enable in production

Full checklist: [AUTH.md](./AUTH.md) (deploy-auth-secrets). Verify:

```bash
curl -s https://api.forgestudios.net/api/v1/platform/config | jq .firebase
curl -s https://api.forgestudios.net/api/v1/health/ready | jq .checks.appCheck
# off | configured | misconfigured
```

**App Check:** set `APP_CHECK_ENABLED=true` only after Firebase Admin is initialized. Production boot **rejects** App Check without Firebase credentials (`env-production.schema.ts`). If the flag is on without Admin at runtime, guarded routes **fail closed** (403). Clients send App Check on login, signup, forgot/reset password, and analytics events.

Health `checks.appCheck`: `off` | `configured` | `misconfigured`. Ops flip: [R1_LAUNCH_GATES.md](./operations/R1_LAUNCH_GATES.md) optional hardening / [DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md).

Scripts: `check-firebase-connection.sh`
