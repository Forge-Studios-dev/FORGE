# Firebase connection — diagnosis (2026-05-31)

## Verdict: **NOT connected** to production

| Check | Status |
|-------|--------|
| Fly `FIREBASE_PROJECT_ID` | Missing |
| Fly `FIREBASE_CLIENT_EMAIL` | Missing |
| Fly `FIREBASE_PRIVATE_KEY` | Missing |
| API `firebase.adminConfigured` | `false` |
| Vercel `NEXT_PUBLIC_FIREBASE_*` | Missing |
| Mobile `firebase_options.dart` | `REPLACE_ME` stubs |

Run: `bash scripts/check-firebase-connection.sh`

## Why automated connect failed

CLI account: **forge-support@forgestudios.net**

| Project | Firebase API |
|---------|----------------|
| `fir-demo-project` | Accessible (demo only — not FORGE production) |
| `forge-studios-prod` | GCP exists; **Firebase not enabled**; `addFirebase` → **403 Permission denied** |
| `forge-forge-app` (new GCP) | **403 Permission denied** to add Firebase |

`forge-support` can create GCP projects but **cannot** enable Firebase or create service account keys (IAM 403).

## Fix (owner account — ~15 minutes)

Use the Google account that **owns** `forge-studios-prod` in [Firebase Console](https://console.firebase.google.com/).

### 1. Enable Firebase on the production GCP project

1. Open https://console.firebase.google.com/
2. **Add project** → select existing GCP project **`forge-studios-prod`** (or create if missing)
3. Complete setup (Analytics optional)

### 2. Grant forge-support (optional, for CLI)

In [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam?project=forge-studios-prod):

- `forge-support@forgestudios.net` → roles: **Firebase Admin**, **Service Account Admin** (or Owner)

### 3. Service account for API (Fly)

1. Firebase Console → Project settings → **Service accounts**
2. **Generate new private key** → JSON file
3. Copy into `secrets/auth-deploy.env`:

```bash
FIREBASE_PROJECT_ID=forge-studios-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-....@forge-studios-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FCM_ENABLED=true
APP_CHECK_ENABLED=false
```

### 4. Web app + Vercel

1. Project settings → General → **Add app** → Web
2. Copy config to Vercel (`NEXT_PUBLIC_FIREBASE_*` in [ENABLEMENT_GUIDE.md](./ENABLEMENT_GUIDE.md))
3. Cloud Messaging → Web Push → VAPID key → `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### 5. Deploy

```bash
bash scripts/deploy-auth-secrets.sh
bash scripts/check-firebase-connection.sh
```

Expect: `firebase.adminConfigured: true`, `fcmEnabled: true`, `usesFirebaseAuth: false`.

### 6. Mobile

```bash
firebase login   # as owner if forge-support lacks access
cd firebase && firebase use forge-studios-prod
FIREBASE_PROJECT_ID=forge-studios-prod bash scripts/configure-mobile-firebase.sh
```

## Authentication vs Firebase

- **Login** stays custom API (Postgres + JWT). Firebase Console → **Authentication** stays empty.
- Firebase here = **FCM push** + optional **App Check**, not `firebase/auth`.

## Google Sign-In (separate from Firebase)

Requires **Google Cloud OAuth client** (not Firebase Auth):

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `secrets/auth-deploy.env`
- `GOOGLE_OAUTH_ENABLED=true`

Vercel `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` only shows the button; API must have OAuth secrets for the flow to complete.

## Email verification (links, not OTP)

Requires **SMTP** in `secrets/auth-deploy.env`. Without SMTP, signup works but no email is sent.

OTP is **not implemented**; see [OTP_RECOMMENDATION.md](./OTP_RECOMMENDATION.md).
