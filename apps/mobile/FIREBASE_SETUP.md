# Mobile Firebase setup

FCM and App Check require a real Firebase project. Until configured, `lib/firebase_options.dart` uses `REPLACE_ME` stubs and push/App Check are skipped safely.

## Configure

```bash
dart pub global activate flutterfire_cli
cd apps/mobile
flutterfire configure --project=YOUR_FIREBASE_PROJECT_ID
```

Commit the generated `lib/firebase_options.dart` (or generate in CI with secrets).

## iOS

- Upload APNs key in Firebase Console → Cloud Messaging
- Enable push capability in Xcode

## Android

- `google-services.json` from FlutterFire (applied by configure)

## Verify

After login, API should receive `POST /notifications/devices/register` with a valid FCM token when `DefaultFirebaseOptions` is not stubbed.

See [docs/firebase/FCM_NOTIFICATIONS.md](../../docs/firebase/FCM_NOTIFICATIONS.md).
