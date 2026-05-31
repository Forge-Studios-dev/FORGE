#!/usr/bin/env bash
# Full production auth + Firebase audit (read-only).
set -euo pipefail

API="${FORGE_SMOKE_API:-https://api.forgestudios.net/api/v1}"
WEB="${FORGE_WEB_URL:-https://forgestudios.net}"
ANDROID_CLIENT_SUFFIX="${FORGE_ANDROID_OAUTH_SUFFIX:-sfpi88tlumvlov1hotun5vtrq7m43j4h}"

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
  echo "  client_id=$CID"
  if [[ "$CID" == *"$ANDROID_CLIENT_SUFFIX"* ]]; then
    echo "  WARN: client_id looks like Firebase ANDROID client — Google sign-in often fails."
    echo "        Create a Web OAuth client: docs/auth-enterprise/PRODUCTION_AUTH_AUDIT.md"
  else
    echo "  OK: client_id does not match known Android suffix"
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
echo "Audit doc: docs/auth-enterprise/PRODUCTION_AUTH_AUDIT.md"
