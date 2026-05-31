# Firebase Setup (FORGE)

Entry point for Firebase **complement** setup (FCM, App Check). Full commands: [CLI_SETUP.md](./CLI_SETUP.md).

## Quick start

```bash
npm install -g firebase-tools
firebase login
cd firebase && firebase use forge-studios-prod   # after creating project
```

Register apps in Firebase Console (Web, Android, iOS). **Do not** enable Firestore, Hosting, or Authentication as primary IdP.

## Repo layout

```
firebase/
  .firebaserc       # project aliases
  firebase.json     # no hosting/firestore deploy
docs/firebase/      # architecture + runbooks
```

## Secrets

| Surface | Variables |
|---------|-----------|
| Fly API | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FCM_ENABLED`, `APP_CHECK_ENABLED` |
| Vercel web | `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_APP_CHECK_SITE_KEY` |
| Mobile | `flutterfire configure` → `lib/firebase_options.dart` |

## Identity

FORGE login stays **custom JWT + Postgres**. Google sign-in uses **Passport**, not Firebase Auth — see [AUTH_DESIGN.md](./AUTH_DESIGN.md).

## Completion status

[AUDIT_COMPLETION.md](./AUDIT_COMPLETION.md)
