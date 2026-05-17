#!/usr/bin/env bash
# Role & sync verification across API (YouTube-style tiers).
# Usage: bash scripts/verify-platform-roles.sh
# Requires: API on :3001, demo users from scripts/reset-demo-users.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
FAIL=0

fail() { echo "FAIL: $1" >&2; FAIL=1; }
ok() { echo "OK: $1"; }

json_field() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); $2" 2>/dev/null || true
}

echo "=== Guest (no token) ==="
for path in "/videos/feed?limit=1" "/categories" "/search?q=te&limit=1"; do
  code=$(curl -sS -o /tmp/forge-guest.json -w "%{http_code}" "${BASE}${path}" || echo 000)
  if [[ "$code" != "200" ]]; then fail "GET ${path} guest expected 200 got ${code}"; else ok "guest GET ${path}"; fi
done

guest_like=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/00000000-0000-4000-8000-000000000001/like" || echo 000)
[[ "$guest_like" == "401" ]] && ok "guest cannot like" || fail "guest like expected 401 got ${guest_like}"

guest_pl=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/playlists/me" || echo 000)
[[ "$guest_pl" == "401" ]] && ok "guest cannot list playlists" || fail "guest playlists expected 401 got ${guest_pl}"

guest_wh=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/users/me/watch-history" || echo 000)
[[ "$guest_wh" == "401" ]] && ok "guest cannot watch-history" || fail "guest watch-history expected 401 got ${guest_wh}"

echo ""
echo "=== Viewer (viewer@forge.local) ==="
VIEWER_LOGIN=$(curl -sS -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"viewer@forge.local","password":"ForgeDemo123!"}')
VIEWER_TOKEN=$(json_field "$VIEWER_LOGIN" "print(d['data']['accessToken'])")
if [[ -z "$VIEWER_TOKEN" ]]; then fail "viewer login"; exit 1; fi
ok "viewer login"

VIEWER_ROLE=$(json_field "$VIEWER_LOGIN" "print(d['data']['user']['role'])")
[[ "$VIEWER_ROLE" == "user" ]] && ok "viewer role=user" || fail "viewer role is '${VIEWER_ROLE}' (run: bash scripts/reset-demo-users.sh)"

VIEWER_ME=$(curl -sS "${BASE}/users/me" -H "Authorization: Bearer ${VIEWER_TOKEN}")
echo "$VIEWER_ME" | grep -q passwordHash && fail "viewer /users/me leaks passwordHash" || ok "viewer /users/me sanitized"
echo "$VIEWER_ME" | grep -q '"ENGAGE"' || fail "viewer missing ENGAGE"
echo "$VIEWER_ME" | grep -q '"USE_LIBRARY"' || fail "viewer missing USE_LIBRARY"
echo "$VIEWER_ME" | grep -q 'UPLOAD_VIDEO' && fail "viewer should not have UPLOAD_VIDEO" || ok "viewer permissions (no upload)"

viewer_upload=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/presigned-url" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}" -H 'Content-Type: application/json' \
  -d '{"filename":"x.mp4","contentType":"video/mp4","fileSizeBytes":1024}' || echo 000)
[[ "$viewer_upload" == "403" ]] && ok "viewer cannot presign upload" || fail "viewer upload expected 403 got ${viewer_upload}"

viewer_wh=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/users/me/watch-history?limit=1" \
  -H "Authorization: Bearer ${VIEWER_TOKEN}" || echo 000)
[[ "$viewer_wh" == "200" ]] && ok "viewer watch-history" || fail "viewer watch-history expected 200 got ${viewer_wh}"

SEARCH=$(curl -sS "${BASE}/search?q=test&limit=2" || true)
echo "$SEARCH" | grep -q passwordHash && fail "search leaks passwordHash" || ok "search sanitized"

echo ""
echo "=== Admin (admin@forge.local) ==="
ADMIN_LOGIN=$(curl -sS -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@forge.local","password":"ForgeAdmin123!"}' 2>/dev/null || true)
ADMIN_TOKEN=$(json_field "$ADMIN_LOGIN" "print(d['data']['accessToken'])")
if [[ -z "$ADMIN_TOKEN" ]]; then
  fail "admin login (run reset-demo-users.sh)"
else
  ok "admin login"
  admin_stats=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/admin/stats" -H "Authorization: Bearer ${ADMIN_TOKEN}" || echo 000)
  [[ "$admin_stats" == "200" ]] && ok "admin /admin/stats" || fail "admin stats expected 200 got ${admin_stats}"

  viewer_admin=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}/admin/stats" -H "Authorization: Bearer ${VIEWER_TOKEN}" || echo 000)
  [[ "$viewer_admin" == "403" ]] && ok "viewer cannot access admin" || fail "viewer admin expected 403 got ${viewer_admin}"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All platform role checks passed."
else
  echo "Some checks failed." >&2
  exit 1
fi
