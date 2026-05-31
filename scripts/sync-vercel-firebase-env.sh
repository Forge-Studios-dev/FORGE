#!/usr/bin/env bash
# Push Firebase web client env from Firebase CLI to Vercel production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${FIREBASE_PROJECT_ID:-forge-studios-prod-61de0}"
WEB_APP_ID="${FIREBASE_WEB_APP_ID:-1:616295087859:web:33c0a44f86a5443ee00186}"

if ! command -v firebase >/dev/null 2>&1 || ! command -v vercel >/dev/null 2>&1; then
  echo "FAIL: firebase and vercel CLIs required" >&2
  exit 1
fi

if [[ ! -f "$ROOT/apps/web/.vercel/project.json" ]]; then
  echo "FAIL: run vercel link in apps/web first" >&2
  exit 1
fi

CFG="$(cd "$ROOT/firebase" && firebase apps:sdkconfig WEB "$WEB_APP_ID" --project "$PROJECT" 2>/dev/null)"
API_KEY="$(echo "$CFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['apiKey'])" 2>/dev/null)"
AUTH_DOMAIN="$(echo "$CFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['authDomain'])" 2>/dev/null)"
PROJECT_ID="$(echo "$CFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['projectId'])" 2>/dev/null)"
SENDER="$(echo "$CFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['messagingSenderId'])" 2>/dev/null)"
APP_ID="$(echo "$CFG" | python3 -c "import json,sys; print(json.load(sys.stdin)['appId'])" 2>/dev/null)"

cd "$ROOT/apps/web"
set_vercel() {
  local name="$1" val="$2"
  echo "$val" | vercel env rm "$name" production -y 2>/dev/null || true
  printf '%s' "$val" | vercel env add "$name" production
  echo "  OK $name"
}

echo "==> Sync Firebase web env to Vercel (project=$PROJECT_ID)"
set_vercel NEXT_PUBLIC_FIREBASE_API_KEY "$API_KEY"
set_vercel NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "$AUTH_DOMAIN"
set_vercel NEXT_PUBLIC_FIREBASE_PROJECT_ID "$PROJECT_ID"
set_vercel NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$SENDER"
set_vercel NEXT_PUBLIC_FIREBASE_APP_ID "$APP_ID"

echo ""
echo "Add VAPID manually in Firebase Console → Cloud Messaging → Web Push →"
echo "  vercel env add NEXT_PUBLIC_FIREBASE_VAPID_KEY production"
echo ""
echo "Redeploy web: cd $ROOT && bash scripts/vercel-setup.sh"
