#!/usr/bin/env bash
# Quick HTTP smoke against a running FORGE API (default: local dev).
# Usage: FORGE_SMOKE_API=http://localhost:3001/api/v1 bash scripts/smoke-api.sh
# Requires demo user viewer@forge.local / ForgeDemo123! in DB.
set -euo pipefail
BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"

code="$(curl -sS -o /tmp/forge-smoke-health.json -w "%{http_code}" "${BASE}/health" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: GET ${BASE}/health expected 200, got ${code:-curl-error}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/health ($code)"

login_body="$(curl -sS -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@forge.local","password":"ForgeDemo123!"}')"
TOKEN="$(echo "$login_body" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "FAIL: login did not return accessToken" >&2
  exit 1
fi
echo "OK: POST ${BASE}/auth/login"

if echo "$login_body" | grep -q passwordHash; then
  echo "FAIL: login response leaks passwordHash — restart API from current source (npm run dev:api)" >&2
  exit 1
fi
echo "OK: login user payload has no passwordHash"

me_body="$(curl -sS "${BASE}/users/me" -H "Authorization: Bearer ${TOKEN}")"
if echo "$me_body" | grep -q passwordHash; then
  echo "FAIL: GET /users/me leaks passwordHash — Docker image may be stale; use npm run dev:api" >&2
  exit 1
fi
if ! echo "$me_body" | grep -q '"permissions"'; then
  echo "FAIL: GET /users/me missing permissions array" >&2
  exit 1
fi
if ! echo "$me_body" | grep -q 'ENGAGE'; then
  echo "FAIL: viewer should have ENGAGE permission (restart API from source)" >&2
  exit 1
fi
echo "OK: GET ${BASE}/users/me (public shape + permissions)"

pl_code="$(curl -sS -o /tmp/forge-smoke-pl.json -w "%{http_code}" "${BASE}/playlists/me" -H "Authorization: Bearer ${TOKEN}")"
if [[ "$pl_code" != "200" ]]; then
  echo "FAIL: GET ${BASE}/playlists/me expected 200, got ${pl_code}" >&2
  cat /tmp/forge-smoke-pl.json >&2 || true
  exit 1
fi
echo "OK: GET ${BASE}/playlists/me ($pl_code)"

feed_code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/videos/feed?categorySlug=physical-crafts&limit=1")"
if [[ "$feed_code" != "200" ]]; then
  echo "FAIL: GET feed with categorySlug expected 200, got ${feed_code}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/videos/feed?categorySlug=… ($feed_code)"

search_body="$(curl -sS "${BASE}/search?q=test&limit=3" || true)"
if echo "$search_body" | grep -q passwordHash; then
  echo "FAIL: GET /search leaks passwordHash — sync API: cd apps/api && npm run build && bash scripts/sync-api-to-docker.sh" >&2
  exit 1
fi
if echo "$search_body" | grep -q emailVerificationTokenHash; then
  echo "FAIL: GET /search leaks emailVerificationTokenHash" >&2
  exit 1
fi
echo "OK: GET ${BASE}/search (no credential leaks)"

guest_like="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/00000000-0000-4000-8000-000000000001/like")"
if [[ "$guest_like" != "401" ]]; then
  echo "FAIL: guest POST like expected 401, got ${guest_like}" >&2
  exit 1
fi
echo "OK: guest cannot like (401)"

viewer_role="$(echo "$login_body" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['role'])" 2>/dev/null || true)"
if [[ "$viewer_role" != "user" ]]; then
  echo "WARN: viewer@forge.local role is '${viewer_role}' (expected user). Run: cd apps/api && npm run seed" >&2
fi

viewer_upload="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/presigned-url" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"filename":"x.mp4","contentType":"video/mp4","fileSizeBytes":1024}')"
if [[ "$viewer_upload" != "403" ]]; then
  echo "FAIL: viewer POST presigned-url expected 403, got ${viewer_upload}" >&2
  exit 1
fi
echo "OK: viewer cannot upload (403)"

ADMIN_LOGIN="$(curl -sS -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@forge.local","password":"ForgeAdmin123!"}' 2>/dev/null || true)"
ADMIN_TOKEN="$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || true)"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "WARN: admin@forge.local login failed — run: cd apps/api && npm run seed" >&2
else
  admin_stats="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/admin/stats" -H "Authorization: Bearer ${ADMIN_TOKEN}")"
  if [[ "$admin_stats" != "200" ]]; then
    echo "FAIL: admin GET /admin/stats expected 200, got ${admin_stats}" >&2
    exit 1
  fi
  echo "OK: admin GET /admin/stats ($admin_stats)"
fi

echo "All smoke checks passed."
