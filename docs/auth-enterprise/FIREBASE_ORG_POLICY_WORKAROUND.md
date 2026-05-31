# Firebase Admin SDK when key download is blocked

If Firebase Console shows:

> Key creation is not allowed on this service account. Please check if service account key creation is restricted by organization policies.

Your Google Cloud organization has **`constraints/iam.disableServiceAccountKeyCreation`**.  
This blocks **all** JSON private keys (default `firebase-adminsdk-*` and custom service accounts).

FORGE can still use Firebase on production via one of these paths:

---

## Option 1 — Org admin creates a key for you (fastest if they agree)

A **Organization Policy Administrator** or project **Owner** can:

1. Temporarily **exempt** project `forge-studios-prod-61de0` from `iam.disableServiceAccountKeyCreation`, **or**
2. Create the key in Console / Cloud Shell and send you the JSON **securely** (1Password, not Slack/email).

Then on your machine:

```bash
bash scripts/apply-firebase-service-account.sh /path/to/service-account.json
```

Or deploy only the JSON secret (no separate `FIREBASE_PRIVATE_KEY`):

```bash
bash scripts/deploy-firebase-json-secret.sh /path/to/service-account.json
```

Use service account:

`firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com`

Grant it (if not already): **Firebase Admin SDK Administrator Service Agent**, **Firebase Cloud Messaging Admin**.

---

## Option 2 — Workload Identity Federation (no JSON keys, recommended long-term)

Fly Machines can authenticate to GCP with **OIDC** (no stored private keys).

See: [FIREBASE_FLY_WORKLOAD_IDENTITY.md](./FIREBASE_FLY_WORKLOAD_IDENTITY.md)

Summary:

1. Create a GCP Workload Identity Pool + Provider trusting `oidc.fly.io`
2. Allow the pool to impersonate `firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com`
3. Store the **external account** JSON (not a private key) on Fly
4. Set `FIREBASE_USE_APPLICATION_DEFAULT=true` and `GOOGLE_APPLICATION_CREDENTIALS`

---

## Option 3 — Skip server-side Firebase for now

You still have:

- **Web/mobile Firebase client** (`NEXT_PUBLIC_FIREBASE_*`) for App Check / FCM token registration on device
- **Custom auth** (email/Google via API) — does not need Firebase Auth

Without Admin SDK on Fly:

- API cannot **send** FCM push from the server
- API cannot **verify** App Check tokens (keep `APP_CHECK_ENABLED=false`)

Login, signup, and email verification links only need **SMTP + Google OAuth** on Fly (see [ENABLEMENT_GUIDE.md](./ENABLEMENT_GUIDE.md)).

---

## What does not fix this

- Creating another service account in the same project (policy applies to **all** keys)
- `apply-firebase-service-account.sh` without a JSON file from an admin
- Enabling Firebase Authentication in Console (different product; FORGE uses custom JWT)

---

## Policy exemption request (template for your admin)

> Please exempt GCP project `forge-studios-prod-61de0` from constraint `iam.disableServiceAccountKeyCreation`, or generate one JSON key for `firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com` for our Fly.io API (FCM push). Alternative: approve Workload Identity Federation from Fly.io OIDC (`oidc.fly.io`) to that service account.
