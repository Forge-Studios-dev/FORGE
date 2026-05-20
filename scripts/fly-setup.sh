#!/usr/bin/env bash
# Fly.io setup for FORGE API — run from repo root after: fly auth login + billing card added
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_NAME="${FLY_APP_NAME:-forge-studios-api}"
ENV_FILE="${FLY_ENV_FILE:-$ROOT/apps/api/.env}"

echo "==> FORGE Fly.io setup (app: $APP_NAME)"

if ! command -v fly >/dev/null 2>&1; then
  echo "ERROR: fly CLI not found. Install: brew install flyctl"
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "ERROR: Not logged in. Run: fly auth login"
  exit 1
fi

echo "Logged in as: $(fly auth whoami 2>/dev/null | tail -1)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE — copy apps/api/.env.example and configure Neon + Upstash."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]] || [[ "$DATABASE_URL" == *localhost* ]]; then
  echo "ERROR: DATABASE_URL must be your Neon URL in $ENV_FILE"
  exit 1
fi

if [[ -z "${UPSTASH_REDIS_REST_URL:-}" ]] || [[ -z "${UPSTASH_REDIS_REST_TOKEN:-}" ]]; then
  if [[ -z "${REDIS_URL:-}" ]] || [[ "$REDIS_URL" == *localhost* ]]; then
    echo "ERROR: Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or REDIS_URL) in $ENV_FILE"
    exit 1
  fi
fi

# Production JWT — generate if still using example placeholders
if [[ "${JWT_SECRET:-}" == *change-this* ]] || [[ "${JWT_SECRET:-}" == your-super-secret* ]]; then
  JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
  JWT_REFRESH_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
  echo "==> Generated new JWT_SECRET and JWT_REFRESH_SECRET for production"
else
  JWT_SECRET="${JWT_SECRET:?JWT_SECRET missing}"
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET missing}"
fi

WEB_URL="${WEB_URL:-http://localhost:3000}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3002}"
DB_POOL_MAX="${DB_POOL_MAX:-10}"

if ! fly apps list --json 2>/dev/null | grep -q "\"name\": \"$APP_NAME\""; then
  echo "==> Creating Fly app: $APP_NAME"
  if ! fly apps create "$APP_NAME" 2>&1; then
    echo ""
    echo "If you see 'payment information' — add a card (free tier still needs it):"
    echo "  https://fly.io/dashboard/personal/billing"
    echo "Then re-run: bash scripts/fly-setup.sh"
    exit 1
  fi
else
  echo "==> Fly app $APP_NAME already exists"
fi

echo "==> Setting secrets (never printed)"
fly secrets set \
  DATABASE_URL="$DATABASE_URL" \
  DB_POOL_MAX="$DB_POOL_MAX" \
  UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-}" \
  UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}" \
  JWT_SECRET="$JWT_SECRET" \
  JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
  WEB_URL="$WEB_URL" \
  ADMIN_URL="$ADMIN_URL" \
  NODE_ENV=production \
  --app "$APP_NAME"

if [[ -n "${REDIS_URL:-}" ]] && [[ "$REDIS_URL" != *localhost* ]]; then
  fly secrets set REDIS_URL="$REDIS_URL" --app "$APP_NAME"
fi

echo "==> Deploying (Docker build may take several minutes)..."
fly deploy --app "$APP_NAME" --ha=false

echo ""
echo "==> Deploy complete"
echo "  Health: https://${APP_NAME}.fly.dev/api/v1/health"
echo "  Swagger: https://${APP_NAME}.fly.dev/api/docs"
echo ""
echo "After Vercel deploy, update CORS:"
echo "  fly secrets set WEB_URL='https://your-web.vercel.app' ADMIN_URL='https://your-admin.vercel.app' --app $APP_NAME"
echo ""
echo "Use this in Vercel: NEXT_PUBLIC_API_URL=https://${APP_NAME}.fly.dev/api/v1"
