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

**Correction, 2026-08-13:** the previous version of this doc said the Fly OIDC pattern was "already proven" via [`scripts/fly-gcp-oidc-token.sh`](../../scripts/fly-gcp-oidc-token.sh). Re-checked: that script exists and is a correct, minimal wrapper around Fly's `/.fly/api` OIDC socket, but nothing in the app (no Dockerfile `COPY`, no runtime call site) actually invokes it — it isn't wired into any live GCP credential exchange today. Treat it as a working reference for the socket protocol, not a production-proven integration.

### App-side change — done, 2026-08-13

`apps/api/src/common/create-s3-client.ts` now supports both paths: static `accessKeyId`/`secretAccessKey` (default, unchanged), or an AWS STS credential provider when `roleArn` is set. It talks to the Fly OIDC socket directly in Node (`node:http` against `/.fly/api`) rather than shelling out to a script, so there's no separate binary to add to the Docker image. Every call site that builds an S3 client now passes `roleArn: configService.get('aws.roleArn')` (from `AWS_ROLE_ARN`), so setting that one env var is the entire app-side cutover — no further code changes needed. Covered by `apps/api/src/common/create-s3-client.spec.ts` (mocks the socket + STS exchange; cannot exercise a real AWS account from a test).

Actual credential-resolution shape, for reference:

```ts
// Only used when roleArn is set — otherwise falls through to static keys.
const provider: AwsCredentialIdentityProvider = async () => {
  const webIdentityToken = await readFlyOidcToken(); // fresh JWT from /.fly/api, per call
  const assumeRole = fromWebToken({
    roleArn,
    webIdentityToken,                                // fromWebToken takes a fixed string, not a refresh fn
    roleSessionName: `forge-${process.env.FLY_APP_NAME || 'local'}`,
    durationSeconds: 900,
  });
  return assumeRole();
};
```

### What's still needed — requires AWS console/IAM access this repo/agent doesn't have

The app-side code is ready and defaults to today's static-key behavior when `AWS_ROLE_ARN` is unset. **Nobody should flip the switch until someone with AWS IAM access does this one-time setup and it's verified in staging:**

1. Create an OIDC identity provider in AWS IAM:
   - Provider URL: `https://oidc.fly.io/<FLY_ORG_SLUG>`
   - Audience: `sts.amazonaws.com`
2. Create IAM role `forge-fly-media` with:
   - Trust policy: `sts:AssumeRoleWithWebIdentity` federated to the Fly OIDC provider, with a condition like
     `oidc.fly.io/<ORG>:sub` matches the specific Fly app(s) (`forge-studios-api`, `forge-studios-worker`).
   - Permission policy: same S3 + CloudFront actions currently attached to the `forge-api-media` IAM user.
3. Set `AWS_ROLE_ARN` in Fly secrets for both apps (`forge-studios-api`, `forge-studios-worker`) — this alone activates the OIDC path, no deploy needed beyond the secret set (which restarts the machines).
4. Leave `forge-api-media`'s static keys active as an emergency fallback until the OIDC path is proven under real production load for at least one full deploy cycle — then follow the manual-rotation steps above to deactivate and delete them.

### Validation

- On the running API: `curl -sf --unix-socket /.fly/api -X POST http://localhost/v1/tokens/oidc -H 'Content-Type: application/json' -d '{"aud":"sts.amazonaws.com"}'` returns a JWT.
- AWS CloudTrail: `sts:AssumeRoleWithWebIdentity` events tagged with the Fly OIDC subject.
- The existing S3 smoke checks (presign upload from the studio, presign download from creator resources) still work.

### Rollback

Unset `AWS_ROLE_ARN` via `flyctl secrets unset AWS_ROLE_ARN`; the app falls back to the static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` path immediately on restart (only safe if those keys haven't been deleted yet — see step 4 above).

---

## Estimated effort

- Rotation runbook (this file, done): **1 hour** to rotate + verify.
- Full OIDC migration: app-side code is done (2026-08-13). Remaining work is AWS IAM setup (~1-2 hours for someone with console access) + a staging soak before cutover.

Track completion of the OIDC migration under `H-D2` in [`../audits/IMPLEMENTATION_TRACKER_2026-07-26.md`](../audits/IMPLEMENTATION_TRACKER_2026-07-26.md).
