# Firebase (complement only)

**Not used for login.** Identity is [AUTH.md](./AUTH.md) (JWT + Postgres). Firebase provides **FCM push** and optional **App Check**.

`GET /platform/config` → `firebase.usesFirebaseAuth: false` always.

---

## Mobile setup

```bash
dart pub global activate flutterfire_cli
cd apps/mobile && flutterfire configure --project=YOUR_PROJECT_ID
```

Commit generated `lib/firebase_options.dart`. iOS: APNs key in Firebase console. Android: `google-services.json` via FlutterFire.

Until configured, push is skipped safely (`REPLACE_ME` stubs).

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
```

Scripts: `check-firebase-connection.sh`
