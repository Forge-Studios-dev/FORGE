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

# `fly secrets import` over stdin (not `secrets set KEY=value` CLI args) —
# args would leave live keys in shell history and briefly visible via `ps aux`,
# same reasoning as sync-fly-worker-secrets.sh.
SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT
cat > "$SECRETS_FILE" <<EOF
MUX_TOKEN_ID=${MUX_TOKEN_ID}
MUX_TOKEN_SECRET=${MUX_TOKEN_SECRET}
MUX_WEBHOOK_SECRET=${MUX_WEBHOOK_SECRET}
VIDEO_TRANSCODE_PROVIDER=${TRANSCODE_PROVIDER}
EOF

for app in "${APPS[@]}"; do
  echo "==> Setting Mux secrets on ${app} (VIDEO_TRANSCODE_PROVIDER=${TRANSCODE_PROVIDER})"
  fly secrets import --app "${app}" < "$SECRETS_FILE"
done

echo ""
echo "OK: Mux secrets set on: ${APPS[*]}"
echo "Next: Mux dashboard → Webhooks → https://api.forgestudios.net/api/v1/streams/webhooks/mux"
echo "      Subscribe: video.asset.ready, video.asset.errored, video.live_stream.*"
echo "Rotate tokens in Mux dashboard if they were ever exposed in chat or logs."
