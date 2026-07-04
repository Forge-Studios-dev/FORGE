#!/usr/bin/env bash
# Copy production secrets from forge-studios-api → forge-studios-worker (via running API machine env).
set -euo pipefail

API_APP="${FLY_API_APP:-forge-studios-api}"
WORKER_APP="${FLY_WORKER_APP:-forge-studios-worker}"
ENV_DUMP="$(mktemp)"
SECRETS_OUT="$(mktemp)"

cleanup() { rm -f "$ENV_DUMP" "$SECRETS_OUT"; }
trap cleanup EXIT

if command -v flyctl >/dev/null 2>&1; then
  FLY=flyctl
elif command -v fly >/dev/null 2>&1; then
  FLY=fly
else
  echo "ERROR: flyctl/fly not found in PATH" >&2
  exit 1
fi

echo "==> Syncing secrets: $API_APP → $WORKER_APP (via $FLY)"

if [[ -z "${FLY_API_TOKEN:-}" ]] && ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "ERROR: fly auth login required (or set FLY_API_TOKEN)" >&2
  exit 1
fi

"$FLY" ssh console -a "$API_APP" -C 'printenv' 2>&1 | grep -v '^Connecting' > "$ENV_DUMP"

ENV_DUMP="$ENV_DUMP" SECRETS_OUT="$SECRETS_OUT" python3 <<'PY'
import os
keys = {
    "DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION",
    "S3_BUCKET_NAME", "CLOUDFRONT_DOMAIN",
    "WEB_URL", "ADMIN_URL", "REDIS_URL",
    "MUX_TOKEN_ID", "MUX_TOKEN_SECRET", "MUX_WEBHOOK_SECRET",
    "MUX_SIGNING_KEY_ID", "MUX_SIGNING_PRIVATE_KEY",
    "MUX_IDLE_GRACE_SEC", "MUX_SIGNED_PLAYBACK_TTL_SEC",
    "STREAM_CHAT_ASYNC", "STREAM_SNAPSHOT_RETENTION_DAYS",
    # Keep worker DB pool aligned with API (Neon cost + connection budget)
    "DB_POOL_MAX", "DB_CONNECT_TIMEOUT_MS", "DB_POOL_IDLE_TIMEOUT_MS", "DB_SLOW_QUERY_MS",
}
out = ["WORKER_ONLY=true", "NODE_ENV=production"]
seen = set()
for line in open(os.environ["ENV_DUMP"]):
    line = line.rstrip("\n")
    if "=" not in line:
        continue
    k, _, v = line.partition("=")
    if k in keys and v:
        out.append(f"{k}={v}")
        seen.add(k)
# Default pool size when API only has implicit Neon default (not set as Fly secret)
if "DB_POOL_MAX" not in seen:
    out.append("DB_POOL_MAX=5")
if len(out) < 4:
    raise SystemExit("Too few secrets read from API machine — is the API running?")
open(os.environ["SECRETS_OUT"], "w").write("\n".join(out) + "\n")
print(f"Prepared {len(out)} secrets for worker")
PY

"$FLY" secrets import -a "$WORKER_APP" < "$SECRETS_OUT"
echo "==> Worker secrets updated (includes DB_POOL_MAX and related pool tuning)"
