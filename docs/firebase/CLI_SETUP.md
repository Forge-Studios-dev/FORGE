# Firebase CLI Setup

## Prerequisites

```bash
npm install -g firebase-tools
firebase login
```

## Create project

```bash
firebase projects:create forge-studios-prod --display-name "FORGE Production"
```

Enable in console: **Cloud Messaging**, **App Check** (reCAPTCHA Enterprise for web).

## Register apps

```bash
firebase apps:create WEB forge-web
firebase apps:create ANDROID com.forgestudios.app
firebase apps:create IOS com.forgestudios.app
```

## Repo layout

```
firebase/
  .firebaserc
  firebase.json
docs/firebase/
  *.md
```

## Service account (API)

1. Firebase Console → Project settings → Service accounts → Generate key
2. Fly secrets:

```bash
fly secrets set \
  FIREBASE_PROJECT_ID=forge-studios-prod \
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@....iam.gserviceaccount.com \
  FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
  FCM_ENABLED=true \
  APP_CHECK_ENABLED=true \
  --app forge-studios-api
```

Or store JSON as `FIREBASE_SERVICE_ACCOUNT` (single secret) if using `GOOGLE_APPLICATION_CREDENTIALS` pattern.

## Web (Vercel)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_APP_CHECK_SITE_KEY=
```

## Mobile

```bash
dart pub global activate flutterfire_cli
cd apps/mobile && flutterfire configure --project=forge-studios-prod
```

## CI

- GitHub secret `FIREBASE_SERVICE_ACCOUNT` for Fly deploy
- Do **not** `firebase deploy` hosting — Vercel remains host
- Mobile CI: run `flutterfire configure` or commit `lib/firebase_options.dart` for staging

## Flutter / web only

No Firestore or Functions deploy in `firebase.json` — messaging and App Check client config only.
