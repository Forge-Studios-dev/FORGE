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

# API uses auto_stop — fly ssh can hang indefinitely on a suspended machine (Release worker job).
API_HEALTH_URL="${API_HEALTH_URL:-https://api.forgestudios.net/api/v1/health/live}"
SSH_TIMEOUT_SEC="${FLY_SSH_TIMEOUT_SEC:-120}"
IMPORT_TIMEOUT_SEC="${FLY_SECRETS_IMPORT_TIMEOUT_SEC:-300}"

echo "==> Waking API before SSH ($API_HEALTH_URL)"
curl -sf --max-time 30 "$API_HEALTH_URL" >/dev/null || true

if command -v jq >/dev/null 2>&1; then
  MACHINE_ID="$("$FLY" machines list -a "$API_APP" --json 2>/dev/null | jq -r '.[0].id // empty')"
  if [[ -n "$MACHINE_ID" ]]; then
    STATE="$("$FLY" machines list -a "$API_APP" --json 2>/dev/null | jq -r '.[0].state // empty')"
    if [[ "$STATE" != "started" ]]; then
      echo "==> Starting API machine $MACHINE_ID (state=${STATE:-unknown})"
      "$FLY" machine start "$MACHINE_ID" -a "$API_APP" 2>&1 || true
      for _ in 1 2 3 4 5 6; do
        curl -sf --max-time 20 "$API_HEALTH_URL" >/dev/null && break
        sleep 5
      done
    fi
  fi
fi

if ! timeout "$SSH_TIMEOUT_SEC" "$FLY" ssh console -a "$API_APP" -C 'printenv' 2>&1 \
  | grep -v '^Connecting' > "$ENV_DUMP"; then
  echo "ERROR: fly ssh to $API_APP timed out after ${SSH_TIMEOUT_SEC}s (machine stopped or unreachable)" >&2
  exit 1
fi

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
    # Required by validateProductionEnv() on every process, including the worker —
    # missing here means the worker fails closed at boot (env-production.schema.ts).
    "METRICS_SCRAPE_TOKEN",
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
    out.append("DB_POOL_MAX=3")
if len(out) < 4:
    raise SystemExit("Too few secrets read from API machine — is the API running?")
open(os.environ["SECRETS_OUT"], "w").write("\n".join(out) + "\n")
print(f"Prepared {len(out)} secrets for worker")
PY

if ! timeout "$IMPORT_TIMEOUT_SEC" "$FLY" secrets import -a "$WORKER_APP" < "$SECRETS_OUT"; then
  echo "ERROR: fly secrets import to $WORKER_APP timed out after ${IMPORT_TIMEOUT_SEC}s" >&2
  exit 1
fi
echo "==> Worker secrets updated (includes DB_POOL_MAX and related pool tuning)"
