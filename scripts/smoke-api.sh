#!/usr/bin/env bash
# Quick HTTP smoke against a running FORGE API (default: local dev).
# Usage: FORGE_SMOKE_API=http://localhost:3001/api/v1 bash scripts/smoke-api.sh
# Requires demo user viewer@forge.local / ForgeDemo123! in DB.
set -euo pipefail
BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
MODE="${FORGE_SMOKE_MODE:-full}"

# Transient TLS/network flakes on Fly smoke (SSL_ERROR_SYSCALL), plus brief
# connection gaps during rolling deploys (Fly's edge proxy re-checks machine
# health only every 60s per fly.toml, so a machine mid-restart can still get
# routed a request for a few seconds) — curl's own --retry doesn't reliably
# fire for the resulting instant "empty reply" failures, so retry at the
# shell level with a real sleep between attempts instead.
curl_smoke() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if curl -sS --connect-timeout 20 --max-time 30 "$@"; then
      return 0
    fi
    [[ "$attempt" -lt 5 ]] && sleep 3
  done
  return 1
}

code="$(curl_smoke -o /tmp/forge-smoke-health.json -w "%{http_code}" "${BASE}/health/live" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: GET ${BASE}/health/live expected 200, got ${code:-curl-error}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/health/live ($code)"

if [[ "$MODE" == "live" ]]; then
  echo "All live smoke checks passed (FORGE_SMOKE_MODE=live)."
  exit 0
fi

if [[ "$MODE" == "full" ]]; then
  ready_code="$(curl_smoke -o /tmp/forge-smoke-ready.json -w "%{http_code}" "${BASE}/health/ready" || true)"
  if [[ "$ready_code" != "200" ]]; then
    echo "FAIL: GET ${BASE}/health/ready expected 200, got ${ready_code:-curl-error}" >&2
    exit 1
  fi
  echo "OK: GET ${BASE}/health/ready ($ready_code)"
fi

feed_code="$(curl_smoke -o /dev/null -w "%{http_code}" "${BASE}/videos/feed?limit=1&sort=latest" || true)"
if [[ "$feed_code" != "200" ]]; then
  echo "FAIL: GET feed expected 200, got ${feed_code}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/videos/feed ($feed_code)"

search_body="$(curl_smoke "${BASE}/search?q=test&limit=3" || true)"
if echo "$search_body" | grep -q passwordHash; then
  echo "FAIL: GET /search leaks passwordHash" >&2
  exit 1
fi
echo "OK: GET ${BASE}/search (no credential leaks)"

config_code="$(curl_smoke -o /tmp/forge-smoke-config.json -w "%{http_code}" "${BASE}/platform/config" || true)"
if [[ "$config_code" != "200" ]]; then
  echo "FAIL: GET ${BASE}/platform/config expected 200, got ${config_code}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/platform/config ($config_code)"

if [[ "${FORGE_EXPECT_FLAGS:-}" == *multipart* ]] || [[ "$BASE" == *forgestudios.net* ]]; then
  if python3 -c "import json,sys; f=json.load(open('/tmp/forge-smoke-config.json')); sys.exit(0 if 'multipart_upload' in (f.get('data',{}).get('featureFlags') or []) else 1)" 2>/dev/null; then
    echo "OK: platform/config includes multipart_upload"
  else
    echo "FAIL: production expected multipart_upload in platform/config" >&2
    cat /tmp/forge-smoke-config.json >&2 || true
    exit 1
  fi
fi

if [[ "$BASE" == *forgestudios.net* ]]; then
  if python3 -c "
import json, sys
d = json.load(open('/tmp/forge-smoke-config.json')).get('data', {})
auth, fb = d.get('auth'), d.get('firebase')
if auth and auth.get('provider') == 'custom' and fb is not None and fb.get('usesFirebaseAuth') is False:
    sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
    echo "OK: platform/config auth=custom, firebase.usesFirebaseAuth=false"
  else
    echo "FAIL: production platform/config missing auth/firebase capability blocks" >&2
    cat /tmp/forge-smoke-config.json >&2 || true
    exit 1
  fi

  if python3 -c "
import json, sys
d = json.load(open('/tmp/forge-smoke-config.json')).get('data', {})
admin = (d.get('adminUrl') or '').strip()
sys.exit(0 if admin.startswith('http') else 1)
" 2>/dev/null; then
    echo "OK: platform/config includes adminUrl"
  else
    echo "FAIL: production platform/config missing adminUrl" >&2
    cat /tmp/forge-smoke-config.json >&2 || true
    exit 1
  fi
fi

# Ready health — ADR-012 contentScan honesty (when health is reachable without auth).
ready_body="$(curl_smoke "${BASE}/health/ready" 2>/dev/null || true)"
if [[ -n "$ready_body" ]]; then
  if echo "$ready_body" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
except Exception:
  sys.exit(2)
checks=(d.get('checks') or d.get('data',{}).get('checks') or {})
scan=str(checks.get('contentScan') or '')
# noop without ack is only acceptable outside prod-like; warn always if present
if scan in ('noop_ack','webhook','misconfigured','stripe','stub'):
  sys.exit(0)
if scan == 'noop':
  sys.exit(1)
sys.exit(0)
" 2>/dev/null; then
    echo "OK: health contentScan present (or absent)"
  else
    echo "WARN: health contentScan=noop without ack — set CONTENT_SCAN_ALLOW_NOOP=true (ADR-012)" >&2
  fi
fi

API_ROOT="${BASE%/api/v1}"
health_headers="$(curl_smoke -sSI "${BASE}/health/live" 2>/dev/null || true)"
if echo "$health_headers" | grep -qi 'x-correlation-id:'; then
  echo "OK: health returns x-correlation-id"
else
  echo "WARN: health missing x-correlation-id header" >&2
fi

metrics_code="$(curl_smoke -o /dev/null -w "%{http_code}" "${API_ROOT}/metrics" 2>/dev/null || echo "000")"
if [[ "$metrics_code" == "200" ]]; then
  echo "OK: GET ${API_ROOT}/metrics (Prometheus enabled)"
elif [[ "$metrics_code" == "401" ]]; then
  echo "OK: GET ${API_ROOT}/metrics (401 — METRICS_SCRAPE_TOKEN required; use Bearer in scraper)"
elif [[ "$metrics_code" == "404" ]]; then
  echo "OK: GET ${API_ROOT}/metrics (404 — set METRICS_ENABLED=true to expose)"
else
  echo "WARN: GET ${API_ROOT}/metrics returned ${metrics_code}" >&2
fi

if [[ "$MODE" == "public" ]]; then
  echo "All public smoke checks passed (FORGE_SMOKE_MODE=public)."
  exit 0
fi

login_body="$(curl_smoke -X POST "${BASE}/auth/login" \
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

me_body="$(curl_smoke "${BASE}/users/me" -H "Authorization: Bearer ${TOKEN}")"
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

pl_code="$(curl_smoke -o /tmp/forge-smoke-pl.json -w "%{http_code}" "${BASE}/playlists/me" -H "Authorization: Bearer ${TOKEN}" || true)"
if [[ "$pl_code" != "200" ]]; then
  echo "FAIL: GET ${BASE}/playlists/me expected 200, got ${pl_code}" >&2
  cat /tmp/forge-smoke-pl.json >&2 || true
  exit 1
fi
echo "OK: GET ${BASE}/playlists/me ($pl_code)"

feed_cat_code="$(curl_smoke -o /dev/null -w "%{http_code}" "${BASE}/videos/feed?categorySlug=physical-crafts&limit=1" || true)"
if [[ "$feed_cat_code" != "200" ]]; then
  echo "FAIL: GET feed with categorySlug expected 200, got ${feed_cat_code}" >&2
  exit 1
fi
echo "OK: GET ${BASE}/videos/feed?categorySlug=… ($feed_cat_code)"

guest_like="$(curl_smoke -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/00000000-0000-4000-8000-000000000001/like" || true)"
if [[ "$guest_like" != "401" ]]; then
  echo "FAIL: guest POST like expected 401, got ${guest_like}" >&2
  exit 1
fi
echo "OK: guest cannot like (401)"

viewer_role="$(echo "$login_body" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['user']['role'])" 2>/dev/null || true)"
if [[ "$viewer_role" != "user" ]]; then
  echo "WARN: viewer@forge.local role is '${viewer_role}' (expected user). Run: cd apps/api && npm run seed" >&2
fi

viewer_upload="$(curl_smoke -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/presigned-url" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"contentType":"video/mp4","fileSizeBytes":1024}')"
if [[ "$viewer_upload" != "403" ]]; then
  echo "FAIL: viewer POST presigned-url expected 403, got ${viewer_upload}" >&2
  exit 1
fi
echo "OK: viewer cannot upload (403)"

CREATOR_LOGIN="$(curl_smoke -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"creator@forge.local","password":"ForgeDemo123!"}' 2>/dev/null || true)"
CREATOR_TOKEN="$(echo "$CREATOR_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || true)"
if [[ -z "$CREATOR_TOKEN" ]]; then
  echo "WARN: creator@forge.local login failed — run: npm run db:neon:setup" >&2
else
  echo "OK: POST ${BASE}/auth/login (creator@forge.local)"
  creator_upload="$(curl_smoke -o /dev/null -w "%{http_code}" -X POST "${BASE}/videos/presigned-url" \
    -H "Authorization: Bearer ${CREATOR_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"contentType":"video/mp4","fileSizeBytes":2048}')"
  if [[ "$creator_upload" != "200" && "$creator_upload" != "201" ]]; then
    echo "FAIL: creator POST presigned-url expected 200/201, got ${creator_upload}" >&2
    exit 1
  fi
  echo "OK: creator can presign upload (${creator_upload})"
fi

ADMIN_LOGIN="$(curl_smoke -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@forge.local","password":"ForgeAdmin123!"}' 2>/dev/null || true)"
ADMIN_TOKEN="$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || true)"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "WARN: admin@forge.local login failed — run: cd apps/api && npm run seed" >&2
else
  admin_stats="$(curl_smoke -o /dev/null -w "%{http_code}" "${BASE}/admin/stats" -H "Authorization: Bearer ${ADMIN_TOKEN}" || true)"
  if [[ "$admin_stats" != "200" ]]; then
    echo "FAIL: admin GET /admin/stats expected 200, got ${admin_stats}" >&2
    exit 1
  fi
  echo "OK: admin GET /admin/stats ($admin_stats)"
fi

echo "All smoke checks passed."
