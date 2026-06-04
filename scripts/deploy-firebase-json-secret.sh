#!/usr/bin/env bash
# Deploy Firebase Admin credentials when org policy blocks Console download but admin gave you a JSON file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JSON_PATH="${1:-}"
APP="${FLY_APP:-forge-studios-api}"

if [[ -z "$JSON_PATH" || ! -f "$JSON_PATH" ]]; then
  echo "Usage: $0 /path/to/firebase-adminsdk-*.json" >&2
  echo "See docs/AUTH.md (Firebase / org policy)" >&2
  exit 1
fi

if ! command -v fly >/dev/null 2>&1; then
  echo "FAIL: fly CLI required" >&2
  exit 1
fi

PROJECT_ID="$(python3 -c "import json; print(json.load(open('$JSON_PATH'))['project_id'])")"
EMAIL="$(python3 -c "import json; print(json.load(open('$JSON_PATH'))['client_email'])")"

echo "==> Deploying FIREBASE_SERVICE_ACCOUNT_JSON to $APP (project=$PROJECT_ID)"
echo "    client_email=$EMAIL"

# Compact JSON for Fly secret (avoid newline issues)
JSON_COMPACT="$(python3 -c "import json; print(json.dumps(json.load(open('$JSON_PATH'))))")"

fly secrets set \
  FIREBASE_PROJECT_ID="${PROJECT_ID}" \
  FIREBASE_SERVICE_ACCOUNT_JSON="${JSON_COMPACT}" \
  FCM_ENABLED='true' \
  APP_CHECK_ENABLED='false' \
  --app "$APP"

echo ""
echo "==> Wait for deploy, then:"
echo "  fly logs --app $APP | grep -i 'Firebase Admin'"
echo "  npm run firebase:check"
