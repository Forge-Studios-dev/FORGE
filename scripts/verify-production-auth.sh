#!/usr/bin/env bash
# Verify production auth stack (custom API + optional Firebase complement).
set -euo pipefail

API="${FORGE_SMOKE_API:-https://api.forgestudios.net/api/v1}"

echo "==> Health"
curl -sf "${API}/health" | head -c 200
echo ""

echo "==> Platform config (auth + firebase flags)"
CONFIG="$(curl -sf "${API}/platform/config")"
echo "$CONFIG" | python3 -m json.tool 2>/dev/null || echo "$CONFIG"

echo ""
echo "==> Public smoke"
FORGE_SMOKE_API="$API" FORGE_SMOKE_MODE=public bash "$(dirname "$0")/smoke-api.sh"

echo ""
echo "Done. auth.provider should be 'custom' and firebase.usesFirebaseAuth should be false."
