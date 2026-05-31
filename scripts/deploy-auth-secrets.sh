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
)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "FAIL: $v is empty in $ENV_FILE" >&2
    exit 1
  fi
done

firebase_args=()
if [[ "${FCM_ENABLED:-false}" == "true" && -n "${FIREBASE_PRIVATE_KEY:-}" && "${FIREBASE_PRIVATE_KEY}" != *"..."* ]]; then
  for v in FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY; do
    if [[ -z "${!v:-}" ]]; then
      echo "FAIL: $v required when FCM_ENABLED=true" >&2
      exit 1
    fi
  done
  firebase_args=(
    "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
    "FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}"
    "FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}"
    "FCM_ENABLED=true"
  )
else
  echo "==> Skipping Firebase Admin secrets (no valid private key in $ENV_FILE)"
  echo "     Existing Fly FIREBASE_* / FCM_ENABLED are left unchanged."
  firebase_args=()
fi

smtp_args=()
if [[ -n "${SMTP_PASS:-}" && "${SMTP_PASS}" != *YOUR_* ]]; then
  for v in SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM; do
    if [[ -z "${!v:-}" ]]; then
      echo "FAIL: $v required when SMTP is configured" >&2
      exit 1
    fi
  done
  smtp_args=(
    "SMTP_HOST=${SMTP_HOST}"
    "SMTP_PORT=${SMTP_PORT:-587}"
    "SMTP_USER=${SMTP_USER}"
    "SMTP_PASS=${SMTP_PASS}"
    "MAIL_FROM=${MAIL_FROM}"
  )
else
  echo "WARN: SMTP_PASS not set — verification emails will not send until SMTP is configured"
fi

echo "==> Setting Fly secrets on $APP (values not printed)"
set -- \
  GOOGLE_OAUTH_ENABLED="${GOOGLE_OAUTH_ENABLED}" \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  GOOGLE_OAUTH_CALLBACK_URL="${GOOGLE_OAUTH_CALLBACK_URL}" \
  WEB_OAUTH_SUCCESS_URL="${WEB_OAUTH_SUCCESS_URL}" \
  WEB_URL="${WEB_URL}" \
  APP_CHECK_ENABLED="${APP_CHECK_ENABLED:-false}"
if ((${#firebase_args[@]})); then set -- "$@" "${firebase_args[@]}"; fi
if ((${#smtp_args[@]})); then set -- "$@" "${smtp_args[@]}"; fi
if [[ -n "${AUTH_EMAIL_OTP_ENABLED:-}" ]]; then
  set -- "$@" "AUTH_EMAIL_OTP_ENABLED=${AUTH_EMAIL_OTP_ENABLED}"
fi
fly secrets set "$@" --app "$APP"

echo ""
echo "==> Wait for Fly deploy, then verify:"
echo "  bash scripts/verify-production-auth.sh"
echo "  curl -s https://api.forgestudios.net/api/v1/platform/config | python3 -m json.tool"
