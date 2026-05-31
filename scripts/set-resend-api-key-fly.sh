#!/usr/bin/env bash
# Set a valid Resend API key on Fly (fixes 535 Authentication credentials invalid).
# Usage: RESEND_API_KEY=re_xxxx bash scripts/set-resend-api-key-fly.sh
set -euo pipefail

APP="${FLY_APP:-forge-studios-api}"
KEY="${RESEND_API_KEY:-${SMTP_PASS:-}}"

if [[ -z "$KEY" || "$KEY" == *YOUR_* ]]; then
  echo "FAIL: Set RESEND_API_KEY=re_... from https://resend.com/api-keys" >&2
  exit 1
fi
if [[ "$KEY" != re_* ]]; then
  echo "WARN: Resend API keys usually start with re_" >&2
fi

echo "==> Updating Fly secrets on $APP (SMTP + Resend HTTP)"
fly secrets set \
  SMTP_HOST=smtp.resend.com \
  SMTP_PORT=587 \
  SMTP_USER=resend \
  SMTP_PASS="${KEY}" \
  RESEND_API_KEY="${KEY}" \
  MAIL_FROM="${MAIL_FROM:-noreply@forgestudios.net}" \
  --app "$APP"

echo ""
echo "==> Wait ~60s for deploy, then test resend on /verify-email"
echo "    Domain for MAIL_FROM must be verified in Resend → Domains"
