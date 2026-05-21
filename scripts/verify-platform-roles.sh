#!/usr/bin/env bash
# Role & auth verification (guest, viewer, creator, admin) — positive and negative paths.
# Usage: FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 bash scripts/verify-platform-roles.sh
# Requires demo users: bash scripts/reset-demo-users.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
FAIL=0

fail() { echo "FAIL: $1" >&2; FAIL=1; }
ok() { echo "OK: $1"; }

json_field() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); $2" 2>/dev/null || true
}

http_code() {
  curl -sS -o /tmp/forge-verify-body.json -w "%{http_code}" "$@" 2>/dev/null || echo 000
}

echo "=== API: ${BASE} ==="
echo ""

echo "=== Guest (no token) ==="
for path in "/videos/feed?limit=1" "/categories" "/search?q=te&limit=1"; do
  code=$(http_code "${BASE}${path}")
  [[ "$code" == "200" ]] && ok "guest GET ${path}" || fail "guest GET ${path} expected 200 got ${code}"
done

guest_like=$(http_code -X POST "${BASE}/videos/00000000-0000-4000-8000-000000000001/like")
[[ "$guest_like" == "401" ]] && ok "guest cannot like (401)" || fail "guest like expected 401 got ${guest_like}"

echo ""
echo "=== Negative: bad credentials ==="
bad_code=$(http_code -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"creator@forge.local","password":"wrong-password"}')
[[ "$bad_code" == "401" ]] && ok "wrong password → 401" || fail "wrong password expected 401 got ${bad_code}"

missing_code=$(http_code -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"nobody@forge.local","password":"ForgeDemo123!"}')
[[ "$missing_code" == "401" ]] && ok "unknown email → 401" || fail "unknown email expected 401 got ${missing_code}"

echo ""
echo "=== Viewer (viewer@forge.local) ==="
VIEWER_LOGIN=$(curl -sS -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"viewer@forge.local","password":"ForgeDemo123!"}')
VIEWER_TOKEN=$(json_field "$VIEWER_LOGIN" "print(d['data']['accessToken'])")
if [[ -z "$VIEWER_TOKEN" ]]; then
  fail "viewer login — run: bash scripts/reset-demo-users.sh"
else
  ok "viewer login"
  VIEWER_ROLE=$(json_field "$VIEWER_LOGIN" "print(d['data']['user']['role'])")
  [[ "$VIEWER_ROLE" == "user" ]] && ok "viewer role=user" || fail "viewer role is '${VIEWER_ROLE}' (run reset-demo-users.sh)"

  VIEWER_ME=$(curl -sS "${BASE}/users/me" -H "Authorization: Bearer ${VIEWER_TOKEN}")
  echo "$VIEWER_ME" | grep -q passwordHash && fail "viewer /users/me leaks passwordHash" || ok "viewer /users/me sanitized"
  echo "$VIEWER_ME" | grep -q 'UPLOAD_VIDEO' && fail "viewer should not have UPLOAD_VIDEO" || ok "viewer no upload permission"

  viewer_upload=$(http_code -X POST "${BASE}/videos/presigned-url" \
    -H "Authorization: Bearer ${VIEWER_TOKEN}" -H 'Content-Type: application/json' \
    -d '{"contentType":"video/mp4","fileSizeBytes":1024}')
  [[ "$viewer_upload" == "403" ]] && ok "viewer cannot presign upload (403)" || fail "viewer upload expected 403 got ${viewer_upload}"
fi

echo ""
echo "=== Creator (creator@forge.local) ==="
CREATOR_LOGIN=$(curl -sS -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"creator@forge.local","password":"ForgeDemo123!"}')
CREATOR_TOKEN=$(json_field "$CREATOR_LOGIN" "print(d['data']['accessToken'])")
if [[ -z "$CREATOR_TOKEN" ]]; then
  fail "creator login — account missing; run: npm run db:neon:setup or bash scripts/reset-demo-users.sh"
else
  ok "creator login"
  CREATOR_ROLE=$(json_field "$CREATOR_LOGIN" "print(d['data']['user']['role'])")
  CREATOR_STATUS=$(json_field "$CREATOR_LOGIN" "print(d['data']['user'].get('creatorStatus') or '')")
  CREATOR_VERIFIED=$(json_field "$CREATOR_LOGIN" "print(d['data']['user'].get('isVerified'))")
  [[ "$CREATOR_ROLE" == "creator" ]] && ok "creator role=creator" || fail "creator role is '${CREATOR_ROLE}'"
  [[ "$CREATOR_STATUS" == "approved" ]] && ok "creator status=approved" || fail "creator status is '${CREATOR_STATUS}'"
  [[ "$CREATOR_VERIFIED" == "True" ]] && ok "creator isVerified=true" || fail "creator isVerified=${CREATOR_VERIFIED}"

  echo "$CREATOR_LOGIN" | grep -q 'UPLOAD_VIDEO' && ok "creator has UPLOAD_VIDEO" || fail "creator missing UPLOAD_VIDEO in login payload"

  creator_upload=$(http_code -X POST "${BASE}/videos/presigned-url" \
    -H "Authorization: Bearer ${CREATOR_TOKEN}" -H 'Content-Type: application/json' \
    -d '{"contentType":"video/mp4","fileSizeBytes":2048}')
  [[ "$creator_upload" == "200" || "$creator_upload" == "201" ]] && ok "creator presigned-url (${creator_upload})" \
    || fail "creator presigned-url expected 200/201 got ${creator_upload}"

  creator_admin=$(http_code "${BASE}/admin/stats" -H "Authorization: Bearer ${CREATOR_TOKEN}")
  [[ "$creator_admin" == "403" ]] && ok "creator cannot access admin (403)" || fail "creator admin expected 403 got ${creator_admin}"
fi

echo ""
echo "=== Admin (admin@forge.local) ==="
ADMIN_LOGIN=$(curl -sS -X POST "${BASE}/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@forge.local","password":"ForgeAdmin123!"}' 2>/dev/null || true)
ADMIN_TOKEN=$(json_field "$ADMIN_LOGIN" "print(d['data']['accessToken'])")
if [[ -z "$ADMIN_TOKEN" ]]; then
  fail "admin login (run reset-demo-users.sh)"
else
  ok "admin login"
  admin_stats=$(http_code "${BASE}/admin/stats" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  [[ "$admin_stats" == "200" ]] && ok "admin /admin/stats" || fail "admin stats expected 200 got ${admin_stats}"

  if [[ -n "${VIEWER_TOKEN:-}" ]]; then
    viewer_admin=$(http_code "${BASE}/admin/stats" -H "Authorization: Bearer ${VIEWER_TOKEN}")
    [[ "$viewer_admin" == "403" ]] && ok "viewer cannot access admin (403)" || fail "viewer admin expected 403 got ${viewer_admin}"
  fi

  admin_consumer_me=$(http_code "${BASE}/users/me" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  [[ "$admin_consumer_me" == "403" ]] && ok "admin blocked on consumer /users/me (403)" \
    || fail "admin /users/me expected 403 got ${admin_consumer_me}"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All platform role checks passed."
else
  echo "Some checks failed." >&2
  exit 1
fi
