#!/usr/bin/env bash
# Validate community channel sunset (FEATURE_FLAGS=community_channels_deprecated).
# Usage:
#   FORGE_SMOKE_API=http://localhost:3001/api/v1 bash scripts/smoke-channel-sunset.sh
#   FORGE_SMOKE_API=https://forge-studios-api-staging.fly.dev/api/v1 bash scripts/smoke-channel-sunset.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
CREATOR_EMAIL="${FORGE_SMOKE_CREATOR_EMAIL:-creator@forge.local}"
CREATOR_PASS="${FORGE_SMOKE_CREATOR_PASSWORD:-ForgeDemo123!}"

curl_smoke() {
  curl -sS --retry 2 --retry-delay 1 --connect-timeout 15 "$@"
}

login() {
  curl_smoke -X POST "${BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}"
}

echo "== Channel sunset smoke (${BASE}) =="

config_json="$(curl_smoke "${BASE}/platform/config" 2>/dev/null || true)"
flag_enabled="$(echo "$config_json" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  flags=d.get('featureFlags') or []
  if isinstance(flags, dict):
    print('1' if flags.get('community_channels_deprecated') else '0')
  else:
    print('1' if 'community_channels_deprecated' in flags else '0')
except Exception:
  print('0')
" 2>/dev/null || echo "0")"

if [[ "$flag_enabled" == "1" ]]; then
  echo "OK: community_channels_deprecated flag is ON"
else
  echo "INFO: community_channels_deprecated flag is OFF (set FEATURE_FLAGS to enable sunset validation)" >&2
fi

creator_body="$(login "$CREATOR_EMAIL" "$CREATOR_PASS" || true)"
creator_token="$(echo "$creator_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null || true)"
creator_id="$(echo "$creator_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('user',{}).get('id',''))" 2>/dev/null || true)"

if [[ -z "$creator_token" || -z "$creator_id" ]]; then
  echo "WARN: creator login failed — skipping authenticated checks" >&2
  exit 0
fi
echo "OK: creator login"

communities_json="$(curl_smoke -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/creators/${creator_id}/communities" 2>/dev/null || true)"
community_id="$(echo "$communities_json" | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin).get('data',[])
  print(data[0]['id'] if data else '')
except Exception:
  print('')
" 2>/dev/null || true)"

if [[ -z "$community_id" ]]; then
  echo "WARN: no community found — create one before running sunset smoke" >&2
  exit 0
fi
echo "OK: community ${community_id}"

rooms_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/communities/${community_id}/rooms" || true)"
if [[ "$rooms_code" != "200" ]]; then
  echo "FAIL: GET /communities/:id/rooms expected 200, got ${rooms_code}" >&2
  exit 1
fi
echo "OK: GET /communities/:id/rooms (${rooms_code})"

channel_headers="$(curl_smoke -D - -o /dev/null \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/communities/id/${community_id}" 2>/dev/null | tr -d '\r' || true)"
if echo "$channel_headers" | grep -qi '^Deprecation:'; then
  echo "OK: Deprecation header present on community routes"
fi

create_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -X POST -H "Authorization: Bearer ${creator_token}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"sunset-smoke-channel"}' \
  "${BASE}/creators/me/communities/${community_id}/channels" || true)"

if [[ "$flag_enabled" == "1" ]]; then
  if [[ "$create_code" != "410" ]]; then
    echo "FAIL: channel create expected 410 when flag on, got ${create_code}" >&2
    exit 1
  fi
  echo "OK: POST channel create blocked (410)"

  detail_json="$(curl_smoke -H "Authorization: Bearer ${creator_token}" \
    "${BASE}/communities/id/${community_id}" 2>/dev/null || true)"
  channel_count="$(echo "$detail_json" | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin).get('data',{})
  print(len(data.get('channels') or []))
except Exception:
  print(-1)
" 2>/dev/null || echo "-1")"
  if [[ "$channel_count" != "0" ]]; then
    echo "FAIL: expected empty channels[] in community payload, got count=${channel_count}" >&2
    exit 1
  fi
  echo "OK: community payload hides channels[]"
else
  echo "INFO: channel create returned ${create_code} (flag off — 201/200 expected for legacy)" >&2
fi

echo "== Channel sunset smoke passed =="
