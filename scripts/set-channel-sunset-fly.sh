#!/usr/bin/env bash
# Enable community_channels_deprecated on Fly API (staging or production).
#
# Usage:
#   EXISTING_FLAGS=multipart_upload FLY_APP=forge-studios-api-staging bash scripts/set-channel-sunset-fly.sh
#   FLY_APP=forge-studios-api bash scripts/set-channel-sunset-fly.sh
#
# See: docs/operations/CHANNEL_SUNSET.md
set -euo pipefail

APP="${FLY_APP:-forge-studios-api-staging}"
BASE_FLAGS="${EXISTING_FLAGS:-multipart_upload}"
SUNSET_FLAG="community_channels_deprecated"

if echo ",${BASE_FLAGS}," | grep -q ",${SUNSET_FLAG},"; then
  FEATURE_FLAGS="${BASE_FLAGS}"
else
  FEATURE_FLAGS="${BASE_FLAGS},${SUNSET_FLAG}"
fi

echo "==> Setting FEATURE_FLAGS on ${APP}"
echo "    ${FEATURE_FLAGS}"

fly secrets set "FEATURE_FLAGS=${FEATURE_FLAGS}" --app "${APP}"

echo ""
echo "OK: Channel sunset flag enabled on ${APP}"
echo "Next: FORGE_SMOKE_API=https://${APP}.fly.dev/api/v1 bash scripts/smoke-channel-sunset.sh"
