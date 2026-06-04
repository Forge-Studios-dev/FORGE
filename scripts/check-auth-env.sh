#!/usr/bin/env bash
# Check API auth-related env (local .env or Fly). Does not print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${FORGE_API_ENV:-${ROOT}/apps/api/.env}"
APP="${FLY_APP:-forge-studios-api}"
MODE="${1:-local}"

ok=0
warn=0
fail=0

check_var() {
  local name="$1"
  local val="${2:-}"
  if [[ -n "$val" ]]; then
    echo "  OK   $name"
    ok=$((ok + 1))
  else
    echo "  MISS $name"
    fail=$((fail + 1))
  fi
}

echo "==> FORGE auth environment check (mode=$MODE)"
echo ""

if [[ "$MODE" == "fly" ]]; then
  if ! command -v fly >/dev/null 2>&1; then
    echo "FAIL: fly CLI not found" >&2
    exit 1
  fi
  echo "Fly app: $APP (secret names only — values hidden)"
  names="$(fly secrets list --app "$APP" 2>/dev/null | awk 'NR>1 {print $1}' || true)"
  has_secret() { echo "$names" | grep -qx "$1"; }
  for s in GOOGLE_OAUTH_ENABLED GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_OAUTH_CALLBACK_URL \
    WEB_OAUTH_SUCCESS_URL WEB_URL SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM \
    FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY FCM_ENABLED; do
    if has_secret "$s"; then
      echo "  OK   $s (Fly secret set)"
      ok=$((ok + 1))
    else
      echo "  MISS $s"
      fail=$((fail + 1))
    fi
  done
else
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "WARN: $ENV_FILE not found — copy from apps/api/.env.example"
    warn=$((warn + 1))
  else
    echo "Reading: $ENV_FILE"
    # shellcheck disable=SC1090
    set -a
    source "$ENV_FILE"
    set +a
    check_var GOOGLE_OAUTH_ENABLED "${GOOGLE_OAUTH_ENABLED:-}"
    check_var GOOGLE_CLIENT_ID "${GOOGLE_CLIENT_ID:-}"
    check_var GOOGLE_CLIENT_SECRET "${GOOGLE_CLIENT_SECRET:-}"
    check_var SMTP_HOST "${SMTP_HOST:-}"
    check_var SMTP_USER "${SMTP_USER:-}"
    check_var SMTP_PASS "${SMTP_PASS:-}"
    check_var WEB_URL "${WEB_URL:-}"
    check_var FIREBASE_PROJECT_ID "${FIREBASE_PROJECT_ID:-}"
    check_var FIREBASE_CLIENT_EMAIL "${FIREBASE_CLIENT_EMAIL:-}"
    check_var FIREBASE_PRIVATE_KEY "${FIREBASE_PRIVATE_KEY:-}"
  fi
fi

echo ""
echo "Summary: ok=$ok warn=$warn miss=$fail"
echo ""
echo "Enable production:"
echo "  1. Copy secrets/auth-deploy.env.example → secrets/auth-deploy.env (gitignored)"
echo "  2. Fill values from Google Cloud, SMTP provider, Firebase Console"
echo "  3. bash scripts/deploy-auth-secrets.sh"
echo "  4. bash scripts/verify-production-auth.sh"
echo ""
echo "Guide: docs/AUTH.md"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
