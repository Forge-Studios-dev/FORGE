#!/usr/bin/env bash
# Set content-scan secrets on Fly (never commit real values).
#
# Temporary noop acknowledgment (until a CSAM vendor is live — ADR-009 / ADR-012):
#   export CONTENT_SCAN_ALLOW_NOOP=true
#   bash scripts/set-content-scan-secrets-fly.sh
#
# Vendor webhook mode:
#   export CONTENT_SCAN_PROVIDER=webhook
#   export CONTENT_SCAN_WEBHOOK_URL=https://scanner.example/scan
#   export CONTENT_SCAN_WEBHOOK_TOKEN=...   # optional Bearer
#   bash scripts/set-content-scan-secrets-fly.sh
#
# Optional:
#   FLY_APPS="forge-studios-api forge-studios-worker" bash scripts/set-content-scan-secrets-fly.sh
set -euo pipefail

PROVIDER="${CONTENT_SCAN_PROVIDER:-none}"
PROVIDER="$(echo "$PROVIDER" | tr '[:upper:]' '[:lower:]')"

if [[ "$PROVIDER" == "webhook" ]]; then
  : "${CONTENT_SCAN_WEBHOOK_URL:?Set CONTENT_SCAN_WEBHOOK_URL for webhook mode}"
elif [[ "$PROVIDER" == "none" ]]; then
  if [[ "${CONTENT_SCAN_ALLOW_NOOP:-}" != "true" ]]; then
    echo "ERROR: CONTENT_SCAN_PROVIDER=none requires CONTENT_SCAN_ALLOW_NOOP=true (ADR-012)" >&2
    echo "       Or set CONTENT_SCAN_PROVIDER=webhook + CONTENT_SCAN_WEBHOOK_URL" >&2
    exit 1
  fi
else
  echo "ERROR: Unknown CONTENT_SCAN_PROVIDER=$PROVIDER (use none|webhook)" >&2
  exit 1
fi

if [[ -n "${FLY_APPS:-}" ]]; then
  read -r -a APPS <<< "${FLY_APPS}"
elif [[ -n "${FLY_APP:-}" ]]; then
  APPS=("${FLY_APP}")
else
  APPS=(forge-studios-api forge-studios-worker)
fi

SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT

{
  echo "CONTENT_SCAN_PROVIDER=${PROVIDER}"
  if [[ "$PROVIDER" == "none" ]]; then
    echo "CONTENT_SCAN_ALLOW_NOOP=true"
  else
    echo "CONTENT_SCAN_WEBHOOK_URL=${CONTENT_SCAN_WEBHOOK_URL}"
    if [[ -n "${CONTENT_SCAN_WEBHOOK_TOKEN:-}" ]]; then
      echo "CONTENT_SCAN_WEBHOOK_TOKEN=${CONTENT_SCAN_WEBHOOK_TOKEN}"
    fi
    if [[ -n "${CONTENT_SCAN_TIMEOUT_MS:-}" ]]; then
      echo "CONTENT_SCAN_TIMEOUT_MS=${CONTENT_SCAN_TIMEOUT_MS}"
    fi
  fi
} > "$SECRETS_FILE"

for app in "${APPS[@]}"; do
  echo "==> Setting content-scan secrets on ${app} (provider=${PROVIDER})"
  fly secrets import --app "${app}" < "$SECRETS_FILE"
done

echo ""
echo "OK: content-scan secrets set on: ${APPS[*]}"
if [[ "$PROVIDER" == "none" ]]; then
  echo "NOTE: ALLOW_NOOP acknowledges uploads are NOT vendor-scanned (ADR-012)."
  echo "      Wire a real CSAM vendor before open UGC launch (ADR-009)."
else
  echo "Next: confirm scanner returns {action: approve|hold|block}; hold notifies admins."
fi
