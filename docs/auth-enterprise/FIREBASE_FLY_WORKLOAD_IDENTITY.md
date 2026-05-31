# Firebase on Fly without service account keys (Workload Identity)

Use when `iam.disableServiceAccountKeyCreation` blocks JSON key download.

## Prerequisites

- GCP project: `forge-studios-prod-61de0`
- Fly org slug: `fly orgs list`
- Service account to impersonate: `firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com`

## 1. GCP — Workload Identity Pool

In [Google Cloud Console](https://console.cloud.google.com/iam-admin/workload-identity-pools?project=forge-studios-prod-61de0):

1. **Create pool** e.g. `fly-pool`
2. **Add provider** → OpenID Connect (OIDC)
   - Issuer: `https://oidc.fly.io/<YOUR_FLY_ORG_SLUG>`
   - Audience: `https://sts.googleapis.com` (or match Fly token request)
   - Attribute mapping: `google.subject` = `assertion.sub`
3. **Grant access** on service account `firebase-adminsdk-fbsvc@...`:
   - Principal: `principalSet://iam.googleapis.com/projects/616295087859/locations/global/workloadIdentityPools/fly-pool/attribute.sub/org:<ORG>:app:forge-studios-api`
   - Role: **Workload Identity User** (`roles/iam.workloadIdentityUser`)

Adjust `sub` pattern to your Fly app name (see Fly OIDC token `sub` claim: `org:app:machine`).

## 2. External account config file

Create `secrets/gcp-wif-fly.json` (no private key — safe template):

```json
{
  "type": "external_account",
  "audience": "//iam.googleapis.com/projects/616295087859/locations/global/workloadIdentityPools/fly-pool/providers/fly-oidc",
  "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
  "token_url": "https://sts.googleapis.com/v1/token",
  "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/firebase-adminsdk-fbsvc@forge-studios-prod-61de0.iam.gserviceaccount.com:generateAccessToken",
  "credential_source": {
    "executable": {
      "command": "/app/apps/api/bin/fly-gcp-oidc-token https://oidc.fly.io/YOUR_ORG_SLUG",
      "timeout_millis": 5000
    }
  }
}
```

Copy `scripts/fly-gcp-oidc-token.sh` to image as `/app/apps/api/bin/fly-gcp-oidc-token` (see Dockerfile note in repo).

## 3. Fly secrets

```bash
fly secrets set \
  FIREBASE_PROJECT_ID='forge-studios-prod-61de0' \
  FIREBASE_USE_APPLICATION_DEFAULT='true' \
  FCM_ENABLED='true' \
  APP_CHECK_ENABLED='false' \
  GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES='1' \
  --app forge-studios-api
# Store WIF JSON as single secret (escape carefully) or bake into image
fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat secrets/gcp-wif-fly.json)" --app forge-studios-api
```

Entrypoint should write `GOOGLE_APPLICATION_CREDENTIALS_JSON` to `/tmp/gcp-adc.json` and set `GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-adc.json`.

## 4. Verify

```bash
fly logs --app forge-studios-api | grep -i firebase
# Expect: Firebase Admin SDK initialized (application default / WIF)
npm run firebase:check
```

## References

- [Fly OIDC](https://fly.io/docs/security/openid-connect/)
- [GCP Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
