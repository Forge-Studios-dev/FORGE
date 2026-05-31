#!/usr/bin/env bash
# Verify production auth stack (custom API + optional Firebase complement).
set -euo pipefail

API="${FORGE_SMOKE_API:-https://api.forgestudios.net/api/v1}"

echo "==> Health"
curl -sf "${API}/health" | head -c 200
echo ""

echo "==> Platform config (auth + firebase flags)"
CONFIG="$(curl -sf "${API}/platform/config")"
echo "$CONFIG" | python3 -m json.tool 2>/dev/null || echo "$CONFIG"

echo ""
echo "==> Public smoke"
FORGE_SMOKE_API="$API" FORGE_SMOKE_MODE=public bash "$(dirname "$0")/smoke-api.sh"

echo ""
echo "==> Assert auth/firebase capability blocks"
echo "$CONFIG" | python3 -c "
import json, sys
data = json.load(sys.stdin).get('data', {})
auth = data.get('auth')
firebase = data.get('firebase')
if not auth or auth.get('provider') != 'custom':
    sys.exit('FAIL: platform/config missing auth.provider=custom')
if firebase is None or firebase.get('usesFirebaseAuth') is not False:
    sys.exit('FAIL: platform/config missing firebase.usesFirebaseAuth=false')
print('OK: auth.provider=custom, firebase.usesFirebaseAuth=false')
print(f\"    googleOAuth={auth.get('googleOAuth')}, mailConfigured={auth.get('mailConfigured')}, fcmEnabled={firebase.get('fcmEnabled')}\")
if auth.get('googleOAuth') is not True:
    print('WARN: auth.googleOAuth is false — Google button hidden until GOOGLE_OAUTH_* Fly secrets set')
if auth.get('mailConfigured') is not True:
    print('WARN: auth.mailConfigured is false — verification emails will not send until SMTP_* set')
if firebase.get('adminConfigured') is not True:
    print('WARN: firebase.adminConfigured is false — set FIREBASE_* on Fly')
"

echo ""
echo "Done."
