#!/usr/bin/env bash
# Full production auth + Firebase audit (read-only).
set -euo pipefail

API="${FORGE_SMOKE_API:-https://api.forgestudios.net/api/v1}"
WEB="${FORGE_WEB_URL:-https://forgestudios.net}"
EXPECTED_CALLBACK="${FORGE_GOOGLE_CALLBACK:-${API}/auth/google/callback}"

echo "==> FORGE production auth audit"
echo ""

bash "$(dirname "$0")/check-firebase-connection.sh" 2>/dev/null || true
echo ""

echo "==> Platform config"
CFG="$(curl -sf "${API}/platform/config")"
echo "$CFG" | python3 -m json.tool 2>/dev/null || echo "$CFG"
echo ""

echo "==> Google OAuth redirect (client id check)"
LOC="$(curl -sSI "${API}/auth/google" 2>/dev/null | tr -d '\r' | grep -i '^location:' | sed 's/location: //I' || true)"
if [[ -z "$LOC" ]]; then
  echo "  FAIL: no redirect from GET /auth/google"
else
  CID="$(python3 -c "from urllib.parse import urlparse,parse_qs; u=urlparse('''$LOC'''); print(parse_qs(u.query).get('client_id',[''])[0])" 2>/dev/null || true)"
  REDIRECT="$(python3 -c "from urllib.parse import urlparse,parse_qs; u=urlparse('''$LOC'''); print(parse_qs(u.query).get('redirect_uri',[''])[0])" 2>/dev/null || true)"
  echo "  client_id=$CID"
  echo "  redirect_uri=$REDIRECT"
  if [[ -z "$CID" ]]; then
    echo "  FAIL: missing client_id in Google authorize URL"
  elif [[ "$REDIRECT" == "$EXPECTED_CALLBACK" ]]; then
    echo "  OK: server-side OAuth uses API callback (Web application client)"
  else
    echo "  WARN: redirect_uri is not $EXPECTED_CALLBACK"
    echo "        Fix GOOGLE_CALLBACK_URL / OAuth Web client: docs/AUTH.md"
  fi
fi

echo ""
echo "==> Web login page"
HTML="$(curl -sf "${WEB}/login" 2>/dev/null || true)"
for text in "Sign in" "Continue with Google" "Create account"; do
  if echo "$HTML" | grep -q "$text"; then
    echo "  OK: login contains '$text'"
  else
    echo "  MISS: login missing '$text' (may be client-rendered)"
  fi
done

echo ""
echo "Audit doc: docs/AUTH.md"
