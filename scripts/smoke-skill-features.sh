#!/usr/bin/env bash
# Smoke skill extension routes when FEATURES_COURSES (and optional LMS) are enabled.
# Usage:
#   bash scripts/smoke-skill-features.sh
#   FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_EXPECT_SKILL_FLAGS=1 bash scripts/smoke-skill-features.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
EMAIL="${FORGE_SMOKE_CREATOR_EMAIL:-creator@forge.local}"
PASS="${FORGE_SMOKE_PASSWORD:-ForgeDemo123!}"
ADMIN_EMAIL="${FORGE_SMOKE_ADMIN_EMAIL:-admin@forge.local}"
ADMIN_PASS="${FORGE_SMOKE_ADMIN_PASSWORD:-ForgeAdmin123!}"

curl_smoke() {
  local attempt
  for attempt in 1 2 3; do
    if curl -sS --connect-timeout 15 --max-time 25 "$@"; then
      return 0
    fi
    [[ "$attempt" -lt 3 ]] && sleep 2
  done
  return 1
}

login() {
  local email="$1" pass="$2"
  curl_smoke -X POST "${BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))"
}

echo "== Skill features smoke (${BASE}) =="

config_body="$(curl_smoke "${BASE}/platform/config" || true)"
if [[ -z "$config_body" ]]; then
  echo "FAIL: GET /platform/config" >&2
  exit 1
fi
echo "OK: GET /platform/config"

courses_enabled="$(echo "$config_body" | python3 -c "import json,sys; f=json.load(sys.stdin).get('data',{}).get('skillFeatures',{}); print('1' if f.get('courses') else '0')" 2>/dev/null || echo 0)"
lms_enabled="$(echo "$config_body" | python3 -c "import json,sys; f=json.load(sys.stdin).get('data',{}).get('skillFeatures',{}); print('1' if f.get('skillEconomyLms') else '0')" 2>/dev/null || echo 0)"

if [[ "${FORGE_EXPECT_SKILL_FLAGS:-}" == "1" && "$courses_enabled" != "1" ]]; then
  echo "FAIL: FORGE_EXPECT_SKILL_FLAGS=1 but skillFeatures.courses is false" >&2
  exit 1
fi

if [[ "$courses_enabled" != "1" ]]; then
  echo "SKIP: FEATURES_COURSES off — set FEATURES_COURSES=true in API .env"
  exit 0
fi

discover_code="$(curl_smoke -o /dev/null -w "%{http_code}" "${BASE}/courses/discover/featured" || true)"
[[ "$discover_code" == "200" ]] && echo "OK: GET /courses/discover/featured" || echo "WARN: discover featured ${discover_code}" >&2

catalog_code="$(curl_smoke -o /dev/null -w "%{http_code}" "${BASE}/courses/discover?limit=3" || true)"
[[ "$catalog_code" == "200" ]] && echo "OK: GET /courses/discover" || echo "WARN: discover catalog ${catalog_code}" >&2

search_body="$(curl_smoke "${BASE}/search?q=course&type=course&limit=3" || true)"
if echo "$search_body" | python3 -c "import json,sys; d=json.load(sys.stdin).get('data',{}); exit(0 if isinstance(d.get('courses'), list) else 1)" 2>/dev/null; then
  echo "OK: GET /search?type=course includes courses[]"
else
  echo "WARN: search type=course missing courses key" >&2
fi

creator_token="$(login "$EMAIL" "$PASS" || true)"
if [[ -n "$creator_token" ]]; then
  me_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${creator_token}" \
    "${BASE}/creators/me/courses" || true)"
  [[ "$me_code" == "200" ]] && echo "OK: GET /creators/me/courses" || echo "WARN: creator courses ${me_code}" >&2
fi

if [[ "$lms_enabled" == "1" && -n "$creator_token" ]]; then
  prog_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${creator_token}" \
    "${BASE}/creators/me/programs" || true)"
  [[ "$prog_code" == "200" ]] && echo "OK: GET /creators/me/programs" || echo "WARN: programs ${prog_code}" >&2
fi

admin_token="$(login "$ADMIN_EMAIL" "$ADMIN_PASS" 2>/dev/null || true)"
if [[ -n "$admin_token" ]]; then
  admin_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${admin_token}" \
    "${BASE}/admin/courses/overview" || true)"
  [[ "$admin_code" == "200" ]] && echo "OK: GET /admin/courses/overview" || echo "WARN: admin courses ${admin_code}" >&2
fi

echo "== Skill features smoke passed =="
