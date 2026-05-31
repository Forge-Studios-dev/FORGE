#!/usr/bin/env bash
# Deploy auth + Firebase complement secrets to Fly from secrets/auth-deploy.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${FORGE_AUTH_DEPLOY_ENV:-${ROOT}/secrets/auth-deploy.env}"
APP="${FLY_APP:-forge-studios-api}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: $ENV_FILE not found." >&2
  echo "Copy secrets/auth-deploy.env.example → secrets/auth-deploy.env and fill values." >&2
  exit 1
fi

if ! command -v fly >/dev/null 2>&1; then
  echo "FAIL: fly CLI not found" >&2
  exit 1
fi

echo "==> Loading $ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  GOOGLE_OAUTH_ENABLED GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
  GOOGLE_OAUTH_CALLBACK_URL WEB_OAUTH_SUCCESS_URL WEB_URL
  SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM
  FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY
)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "FAIL: $v is empty in $ENV_FILE" >&2
    exit 1
  fi
done

echo "==> Setting Fly secrets on $APP (values not printed)"
fly secrets set \
  GOOGLE_OAUTH_ENABLED="${GOOGLE_OAUTH_ENABLED}" \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  GOOGLE_OAUTH_CALLBACK_URL="${GOOGLE_OAUTH_CALLBACK_URL}" \
  WEB_OAUTH_SUCCESS_URL="${WEB_OAUTH_SUCCESS_URL}" \
  WEB_URL="${WEB_URL}" \
  SMTP_HOST="${SMTP_HOST}" \
  SMTP_PORT="${SMTP_PORT:-587}" \
  SMTP_USER="${SMTP_USER}" \
  SMTP_PASS="${SMTP_PASS}" \
  MAIL_FROM="${MAIL_FROM}" \
  FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
  FIREBASE_CLIENT_EMAIL="${FIREBASE_CLIENT_EMAIL}" \
  FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}" \
  FCM_ENABLED="${FCM_ENABLED:-true}" \
  APP_CHECK_ENABLED="${APP_CHECK_ENABLED:-false}" \
  --app "$APP"

echo ""
echo "==> Wait for Fly deploy, then verify:"
echo "  bash scripts/verify-production-auth.sh"
echo "  curl -s https://api.forgestudios.net/api/v1/platform/config | python3 -m json.tool"
