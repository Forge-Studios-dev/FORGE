#!/usr/bin/env bash
# Diagnose Firebase connection: CLI access, Fly secrets, API platform config, mobile stubs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${FORGE_SMOKE_API:-https://api.forgestudios.net/api/v1}"
APP="${FLY_APP:-forge-studios-api}"
EXPECTED_PROJECT="${FORGE_FIREBASE_PROJECT:-forge-studios-prod-61de0}"

echo "==> FORGE Firebase connection check"
echo ""

echo "--- 1) Firebase CLI"
if command -v firebase >/dev/null 2>&1; then
  firebase login:list 2>/dev/null | head -3 || true
  echo "Projects visible to CLI:"
  firebase projects:list 2>/dev/null | tail -n +4 || echo "  (failed to list)"
else
  echo "  MISS: firebase CLI not installed"
fi
echo "  Expected project in repo: $EXPECTED_PROJECT (firebase/.firebaserc)"
echo ""

echo "--- 2) Fly API secrets (names only)"
if command -v fly >/dev/null 2>&1; then
  names="$(fly secrets list --app "$APP" 2>/dev/null | awk 'NR>1 {print $1}' || true)"
  for s in FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY FCM_ENABLED; do
    if echo "$names" | grep -qx "$s"; then
      echo "  OK   $s"
    else
      echo "  MISS $s"
    fi
  done
else
  echo "  SKIP: fly CLI missing"
fi
echo ""

echo "--- 3) Production API capability flags"
cfg="$(curl -sf "${API}/platform/config" 2>/dev/null || echo '{}')"
echo "$cfg" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
d = raw.get('data', raw)
fb = d.get('firebase') or {}
print('  adminConfigured:', fb.get('adminConfigured'))
print('  fcmEnabled:', fb.get('fcmEnabled'))
print('  usesFirebaseAuth:', fb.get('usesFirebaseAuth'))
if fb.get('adminConfigured'):
    print('  STATUS: API Firebase Admin CONNECTED')
else:
    print('  STATUS: API Firebase Admin NOT CONNECTED (set FIREBASE_* on Fly)')
" 2>/dev/null || echo "  FAIL: could not fetch platform/config"
echo ""

echo "--- 4) Web Vercel (NEXT_PUBLIC_FIREBASE_*)"
if command -v vercel >/dev/null 2>&1 && [[ -f "$ROOT/apps/web/.vercel/project.json" ]]; then
  cd "$ROOT/apps/web"
  if vercel env ls 2>/dev/null | grep -q NEXT_PUBLIC_FIREBASE_API_KEY; then
    echo "  OK   NEXT_PUBLIC_FIREBASE_API_KEY (Vercel)"
  else
    echo "  MISS NEXT_PUBLIC_FIREBASE_* on Vercel web project"
  fi
else
  echo "  SKIP: vercel CLI or project link missing"
fi
echo ""

echo "--- 5) Mobile firebase_options.dart"
opts="$ROOT/apps/mobile/lib/firebase_options.dart"
if grep -q REPLACE_ME "$opts" 2>/dev/null; then
  echo "  MISS: mobile still has REPLACE_ME — run: FIREBASE_PROJECT_ID=... bash scripts/configure-mobile-firebase.sh"
else
  echo "  OK   mobile firebase_options.dart configured"
fi
echo ""

echo "--- Important"
echo "  Firebase Console → Authentication will stay EMPTY (custom JWT login, not Firebase Auth)."
echo "  Connection means: Admin SDK on API + client SDK for FCM/App Check."
echo ""
echo "  If CLI shows 403 adding Firebase: log in with the GCP/Firebase OWNER account:"
echo "    firebase logout && firebase login"
echo "  Then: cd firebase && firebase use $EXPECTED_PROJECT"
echo "  Guide: docs/auth-enterprise/ENABLEMENT_GUIDE.md"
