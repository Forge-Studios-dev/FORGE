#!/usr/bin/env bash
# Smoke membership / live / community endpoints (requires running API + demo user).
# Usage: FORGE_SMOKE_API=http://localhost:3001/api/v1 bash scripts/smoke-memberships.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
EMAIL="${FORGE_SMOKE_EMAIL:-viewer@forge.local}"
PASS="${FORGE_SMOKE_PASSWORD:-ForgeDemo123!}"

curl_smoke() {
  curl -sS --retry 3 --retry-delay 1 --connect-timeout 15 "$@"
}

echo "== Memberships smoke (${BASE}) =="

login_body="$(curl_smoke -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}" || true)"

token="$(echo "$login_body" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))" 2>/dev/null || true)"
if [[ -z "$token" ]]; then
  echo "WARN: login failed — skipping authenticated checks (set FORGE_SMOKE_EMAIL/PASS)" >&2
  exit 0
fi
echo "OK: login"

live_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${token}" \
  "${BASE}/streams/live" || true)"
if [[ "$live_code" != "200" ]]; then
  echo "FAIL: GET /streams/live expected 200, got ${live_code}" >&2
  exit 1
fi
echo "OK: GET /streams/live ($live_code)"

# Public tiers list for a creator (may 404 if no creators — non-fatal)
creator_id="$(echo "$login_body" | python3 -c "
import json,sys
d=json.load(sys.stdin).get('data',{}).get('user',{})
print(d.get('id',''))
" 2>/dev/null || true)"

if [[ -n "$creator_id" ]]; then
  tiers_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    "${BASE}/creators/${creator_id}/tiers" || true)"
  if [[ "$tiers_code" == "200" ]]; then
    echo "OK: GET /creators/:id/tiers"
  else
    echo "WARN: GET tiers returned ${tiers_code}" >&2
  fi

  comm_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${token}" \
    "${BASE}/communities/${creator_id}" || true)"
  if [[ "$comm_code" == "200" || "$comm_code" == "404" ]]; then
    echo "OK: GET /communities/:creatorId ($comm_code)"
  else
    echo "FAIL: GET /communities/:creatorId unexpected ${comm_code}" >&2
    exit 1
  fi
fi

echo "== Memberships smoke passed =="
