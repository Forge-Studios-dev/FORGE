# AWS credential rotation (H-D2)

**Related:** [`scripts/setup-aws-forge.sh`](../../scripts/setup-aws-forge.sh) · [`scripts/fly-gcp-oidc-token.sh`](../../scripts/fly-gcp-oidc-token.sh) · [FLY_SLO.md](./FLY_SLO.md) · [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)

FORGE currently uses **long-lived IAM access keys** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) on Fly for the `forge-api-media` IAM user. `scripts/setup-aws-forge.sh` provisions them and writes them straight into Fly secrets. There is no automated rotation.

This runbook covers:

1. Manual rotation on a **quarterly** cadence (accepted stopgap).
2. Preferred path: **migrate to short-lived OIDC** using the same Fly OIDC socket + Workload Identity pattern already proven for GCP.

---

## Rotation cadence

Rotate on the **first business day of each calendar quarter** (Jan / Apr / Jul / Oct) or immediately on:

- Any suspected leak (Github secret scan alert, dependency compromise, laptop loss).
- An IAM/console access key age exceeding **90 days** in AWS IAM's console (the AWS-native age indicator).
- Personnel change on anyone who had console/root access to the AWS account.

Track rotations in `docs/operations/README.md` alongside the DR drill log.

---

## Manual rotation (stopgap)

Prerequisites: `aws` CLI logged in as an admin with `iam:*` on `forge-api-media`, and `flyctl` authenticated for `forge-studios-api` + `forge-studios-worker`.

**Do these steps in order. Do not delete the old key before the deploy that swaps to the new key finishes and both apps report healthy.** Keep the old key active until the new one is proven, then delete it — this gives you a working credential to fall back to.

```bash
# 1. Snapshot which keys exist today (usually just one — Access Key ID starts with "AKIA").
aws iam list-access-keys --user-name forge-api-media

# 2. Create the NEW key (AWS caps at 2 keys per IAM user, so you may need to delete an old inactive one first).
read -r NEW_ID NEW_SECRET < <(
  aws iam create-access-key --user-name forge-api-media \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text
)

# 3. Push the new key to BOTH Fly apps (API + worker share the same S3 identity).
flyctl secrets set \
  AWS_ACCESS_KEY_ID="$NEW_ID" \
  AWS_SECRET_ACCESS_KEY="$NEW_SECRET" \
  --app forge-studios-api

flyctl secrets set \
  AWS_ACCESS_KEY_ID="$NEW_ID" \
  AWS_SECRET_ACCESS_KEY="$NEW_SECRET" \
  --app forge-studios-worker

# 4. Fly restarts the machines automatically on `secrets set`. Wait for both to
#    report healthy — API on https://api.forgestudios.net/api/v1/health,
#    worker via `flyctl checks list -a forge-studios-worker` (worker_health).

# 5. Confirm the new key actually signs S3 requests: exercise a video presign
#    (creator resource upload OR admin content presign) and verify success in
#    Fly logs — do NOT skip this step, misconfigured S3 credentials often
#    surface only on the first authenticated presign.

# 6. Deactivate the OLD key first (reversible for ~24h if things break).
aws iam update-access-key --user-name forge-api-media \
  --access-key-id <OLD_AKIA...> --status Inactive

# 7. After 24h of no issues, delete the OLD key permanently.
aws iam delete-access-key --user-name forge-api-media \
  --access-key-id <OLD_AKIA...>

# 8. Unset the temporary variables from your shell:
unset NEW_ID NEW_SECRET
```

**If step 5 fails:** re-run step 3 with the old key values (from a password manager if you saved them, otherwise regenerate) and file an incident; do not proceed to step 6.

Rollback: if the deploy is unhealthy, `flyctl secrets set AWS_ACCESS_KEY_ID=<old-key> AWS_SECRET_ACCESS_KEY=<old-secret>` on both apps.

---

## Preferred path: OIDC / Workload Identity (no static keys)

The repo **already proves** the Fly OIDC pattern works — [`scripts/fly-gcp-oidc-token.sh`](../../scripts/fly-gcp-oidc-token.sh) mints a Fly OIDC JWT from `/.fly/api` for GCP Workload Identity Federation. The same JWT can back AWS `sts:AssumeRoleWithWebIdentity`.

### One-time AWS setup (do once, in AWS console or Terraform)

1. Create an OIDC identity provider in AWS IAM:
   - Provider URL: `https://oidc.fly.io/<FLY_ORG_SLUG>`
   - Audience: `sts.amazonaws.com`
2. Create IAM role `forge-fly-media` with:
   - Trust policy: `sts:AssumeRoleWithWebIdentity` federated to the Fly OIDC provider, with a condition like
     `oidc.fly.io/<ORG>:sub` matches the specific Fly app(s) (`forge-studios-api`, `forge-studios-worker`).
   - Permission policy: same S3 + CloudFront actions currently attached to the `forge-api-media` IAM user.
3. Remove the S3 policy from `forge-api-media` (or leave the user in place as an emergency fallback while OIDC bakes).

### App-side change

Use `@aws-sdk/credential-providers` with `fromWebToken` on the API/worker startup:

```ts
import { fromWebToken } from '@aws-sdk/credential-providers';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const flyOidcAudience = 'sts.amazonaws.com';

async function readFlyOidcToken() {
  const { stdout } = await promisify(execFile)(
    '/app/apps/api/bin/fly-oidc-token', // wraps fly-gcp-oidc-token.sh with a custom audience
    [flyOidcAudience],
  );
  return stdout.trim();
}

const credentials = fromWebToken({
  roleArn: process.env.AWS_ROLE_ARN!,       // arn:aws:iam::<acct>:role/forge-fly-media
  webIdentityTokenFn: readFlyOidcToken,     // returns a fresh short-lived Fly JWT on each STS call
  roleSessionName: `forge-${process.env.FLY_APP_NAME || 'local'}`,
  durationSeconds: 900,                     // 15 min; SDK auto-refreshes near expiry
});
```

Then swap `createS3Client` / `createS3ClientForBrowserPresign` in `apps/api/src/common/create-s3-client.ts` to pass `credentials` instead of the static `{ accessKeyId, secretAccessKey }` pair when `AWS_ROLE_ARN` is set.

Fly secrets required after cutover: `AWS_ROLE_ARN`, `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN`. Delete `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` **only after** the OIDC path is verified in staging *and* the first production deploy.

### Validation

- On the running API: `curl -sf --unix-socket /.fly/api -X POST http://localhost/v1/tokens/oidc -H 'Content-Type: application/json' -d '{"aud":"sts.amazonaws.com"}'` returns a JWT.
- AWS CloudTrail: `sts:AssumeRoleWithWebIdentity` events tagged with the Fly OIDC subject.
- The existing S3 smoke checks (presign upload from the studio, presign download from creator resources) still work.

### Rollback

Re-set the static IAM keys via `flyctl secrets set AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…` and unset `AWS_ROLE_ARN`; the SDK falls back to the static path immediately on restart.

---

## Estimated effort

- Rotation runbook (this file, done): **1 hour** to rotate + verify.
- Full OIDC migration: **1–2 days**, mostly AWS IAM setup + one small `createS3Client` change + staging soak.

Track completion of the OIDC migration under `H-D2` in [`../audits/IMPLEMENTATION_TRACKER_2026-07-26.md`](../audits/IMPLEMENTATION_TRACKER_2026-07-26.md).
