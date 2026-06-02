#!/usr/bin/env bash
# Set Mux + VOD transcode secrets on Fly (never commit real values).
#
# Usage (rotate credentials in Mux dashboard first if they were exposed):
#   export MUX_TOKEN_ID=...
#   export MUX_TOKEN_SECRET=...
#   export MUX_WEBHOOK_SECRET=...
#   bash scripts/set-mux-secrets-fly.sh
#
# Optional:
#   FLY_APPS="forge-studios-api forge-studios-worker" bash scripts/set-mux-secrets-fly.sh
set -euo pipefail

TRANSCODE_PROVIDER="${VIDEO_TRANSCODE_PROVIDER:-mux}"

: "${MUX_TOKEN_ID:?Set MUX_TOKEN_ID}"
: "${MUX_TOKEN_SECRET:?Set MUX_TOKEN_SECRET}"
: "${MUX_WEBHOOK_SECRET:?Set MUX_WEBHOOK_SECRET}"

if [[ -n "${FLY_APPS:-}" ]]; then
  read -r -a APPS <<< "${FLY_APPS}"
elif [[ -n "${FLY_APP:-}" ]]; then
  APPS=("${FLY_APP}")
else
  APPS=(forge-studios-api forge-studios-worker)
fi

for app in "${APPS[@]}"; do
  echo "==> Setting Mux secrets on ${app} (VIDEO_TRANSCODE_PROVIDER=${TRANSCODE_PROVIDER})"
  fly secrets set \
    MUX_TOKEN_ID="${MUX_TOKEN_ID}" \
    MUX_TOKEN_SECRET="${MUX_TOKEN_SECRET}" \
    MUX_WEBHOOK_SECRET="${MUX_WEBHOOK_SECRET}" \
    VIDEO_TRANSCODE_PROVIDER="${TRANSCODE_PROVIDER}" \
    --app "${app}"
done

echo ""
echo "OK: Mux secrets set on: ${APPS[*]}"
echo "Next: Mux dashboard → Webhooks → https://api.forgestudios.net/api/v1/streams/webhooks/mux"
echo "      Subscribe: video.asset.ready, video.asset.errored, video.live_stream.*"
echo "Rotate tokens in Mux dashboard if they were ever exposed in chat or logs."
