#!/usr/bin/env bash
# Deploy FORGE BullMQ / FFmpeg worker on Fly (separate from API).
# API must NOT run video processors — only this app should (WORKER_ONLY=true).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKER_APP="${FLY_WORKER_APP:-forge-studios-worker}"
API_APP="${FLY_API_APP:-forge-studios-api}"
ENV_FILE="${FLY_ENV_FILE:-$ROOT/apps/api/.env}"

echo "==> FORGE Fly worker setup (app: $WORKER_APP)"

if ! command -v fly >/dev/null 2>&1; then
  echo "ERROR: fly CLI not found. Install: brew install flyctl"
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "ERROR: Not logged in. Run: fly auth login"
  exit 1
fi

if ! fly apps list 2>/dev/null | grep -q "$WORKER_APP"; then
  echo "==> Creating worker app: $WORKER_APP"
  fly apps create "$WORKER_APP"
fi

echo "==> Copying secrets from API app ($API_APP) when possible..."
if fly secrets list -a "$API_APP" >/dev/null 2>&1; then
  echo "    Ensure DATABASE_URL, REDIS/Upstash, AWS_*, JWT_* match API."
  echo "    Set manually if needed: fly secrets set -a $WORKER_APP ..."
else
  echo "WARN: API app $API_APP not found — set worker secrets manually."
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  SECRETS=(WORKER_ONLY=true NODE_ENV=production)
  [[ -n "${DATABASE_URL:-}" ]] && SECRETS+=(DATABASE_URL="$DATABASE_URL")
  [[ -n "${REDIS_URL:-}" ]] && SECRETS+=(REDIS_URL="$REDIS_URL")
  [[ -n "${UPSTASH_REDIS_REST_URL:-}" ]] && SECRETS+=(UPSTASH_REDIS_REST_URL="$UPSTASH_REDIS_REST_URL")
  [[ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]] && SECRETS+=(UPSTASH_REDIS_REST_TOKEN="$UPSTASH_REDIS_REST_TOKEN")
  [[ -n "${AWS_ACCESS_KEY_ID:-}" ]] && SECRETS+=(AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID")
  [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]] && SECRETS+=(AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY")
  [[ -n "${AWS_REGION:-}" ]] && SECRETS+=(AWS_REGION="$AWS_REGION")
  [[ -n "${S3_BUCKET_NAME:-}" ]] && SECRETS+=(S3_BUCKET_NAME="$S3_BUCKET_NAME")
  [[ -n "${CLOUDFRONT_DOMAIN:-}" ]] && SECRETS+=(CLOUDFRONT_DOMAIN="$CLOUDFRONT_DOMAIN")
  fly secrets set -a "$WORKER_APP" "${SECRETS[@]}"
fi

echo "==> Deploying worker (fly.worker.toml)..."
fly deploy -c fly.worker.toml -a "$WORKER_APP" --remote-only --ha=false

echo "==> Done. API app should NOT set ENABLE_VIDEO_WORKER or WORKER_ONLY."
echo "    Worker consumes BullMQ video-processing + analytics-ingest queues."
