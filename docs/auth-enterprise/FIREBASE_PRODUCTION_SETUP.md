# Firebase production — `forge-studios-prod-61de0`

**Project ID:** `forge-studios-prod-61de0`  
**Admin SDK email:** `firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com`

## CLI status (configured)

| App | App ID |
|-----|--------|
| Web | `1:616295087859:web:33c0a44f86a5443ee00186` |
| Android | `1:616295087859:android:2a7f20d73c781a15e00186` |
| iOS | `1:616295087859:ios:a470ea174f31f23ae00186` |

`firebase/.firebaserc` → `forge-studios-prod-61de0`

## Finish API connection (credentials)

### If Console allows **Generate new private key**

```bash
bash scripts/apply-firebase-service-account.sh ~/Downloads/forge-studios-prod-61de0-*.json
```

### If Console says **Key creation is not allowed** (org policy)

Your org blocks `iam.disableServiceAccountKeyCreation`. See **[FIREBASE_ORG_POLICY_WORKAROUND.md](./FIREBASE_ORG_POLICY_WORKAROUND.md)**:

1. Ask a **GCP org admin** to send you the service account JSON securely, then:
   ```bash
   bash scripts/deploy-firebase-json-secret.sh /path/to/key.json
   ```
2. Or set up **Workload Identity Federation** (no keys): [FIREBASE_FLY_WORKLOAD_IDENTITY.md](./FIREBASE_FLY_WORKLOAD_IDENTITY.md)

## Vercel (web client)

Set in production (or redeploy after `vercel env pull`):

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=forge-studios-prod-61de0`
- `NEXT_PUBLIC_FIREBASE_API_KEY` (from `firebase apps:sdkconfig WEB`)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=forge-studios-prod-61de0.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=616295087859`
- `NEXT_PUBLIC_FIREBASE_APP_ID=1:616295087859:web:33c0a44f86a5443ee00186`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` — Firebase Console → Cloud Messaging → Web Push certificate

## Verify

```bash
npm run firebase:check
npm run auth:verify
```

Expect `firebase.adminConfigured: true` after Fly secrets deploy.
