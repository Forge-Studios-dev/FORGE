#!/usr/bin/env bash
# Configure Sentry on Fly API + worker (errors + optional performance traces).
# Usage: SENTRY_DSN='https://...@....ingest.us.sentry.io/...' bash scripts/set-sentry-secrets-fly.sh
set -euo pipefail

API_APP="${FLY_APP:-forge-studios-api}"
WORKER_APP="${FLY_WORKER_APP:-forge-studios-worker}"
DSN="${SENTRY_DSN:-}"
TRACES="${SENTRY_TRACES_SAMPLE_RATE:-0.1}"

if [[ -z "$DSN" || "$DSN" == *xxx* ]]; then
  echo "FAIL: Set SENTRY_DSN from your Sentry project settings" >&2
  exit 1
fi

echo "==> Setting Sentry on $API_APP"
fly secrets set \
  SENTRY_DSN="${DSN}" \
  SENTRY_TRACES_SAMPLE_RATE="${TRACES}" \
  SENTRY_SEND_DEFAULT_PII=false \
  --app "$API_APP"

echo "==> Setting Sentry on $WORKER_APP"
fly secrets set \
  SENTRY_DSN="${DSN}" \
  SENTRY_TRACES_SAMPLE_RATE="${TRACES}" \
  SENTRY_SEND_DEFAULT_PII=false \
  --app "$WORKER_APP"

echo ""
echo "Done. Wait ~60s for rolling deploy, then trigger a test error or check Sentry Issues."
