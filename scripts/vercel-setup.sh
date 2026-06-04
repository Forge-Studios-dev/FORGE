#!/usr/bin/env bash
# Deploy FORGE web + admin to Vercel — uploads full monorepo from repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${FORGE_API_URL:-https://api.forgestudios.net/api/v1}"
WEB_URL="${FORGE_WEB_URL:-https://forgestudios.net}"
ADMIN_URL="${FORGE_ADMIN_URL:-https://admin.forgestudios.net}"

echo "==> FORGE Vercel setup"
echo "    API_URL=$API_URL"
echo "    WEB_URL=$WEB_URL"
echo "    ADMIN_URL=$ADMIN_URL"

if ! command -v vercel >/dev/null 2>&1; then
  npm i -g vercel@latest
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "ERROR: Run: vercel login"
  exit 1
fi

echo "Logged in as: $(vercel whoami 2>/dev/null | tail -1)"

load_vercel_ids() {
  local subdir="$1"
  local link="$subdir/.vercel/project.json"
  if [[ ! -f "$link" ]]; then
    echo "ERROR: Missing $link — run: cd $subdir && vercel link"
    exit 1
  fi
  export VERCEL_ORG_ID
  export VERCEL_PROJECT_ID
  VERCEL_ORG_ID="$(python3 -c "import json; print(json.load(open('$link'))['orgId'])")"
  VERCEL_PROJECT_ID="$(python3 -c "import json; print(json.load(open('$link'))['projectId'])")"
}

deploy_web() {
  echo ""
  echo "==> Deploying web (full monorepo upload)"
  load_vercel_ids "apps/web"
  cd "$ROOT"
  vercel deploy . --prod --yes \
    --local-config=apps/web/vercel.project.json \
    -e "NEXT_PUBLIC_API_URL=${API_URL}" \
    -e "API_INTERNAL_URL=${API_URL}" \
    -e "NEXT_PUBLIC_APP_URL=${WEB_URL}" \
    -e "NEXT_PUBLIC_WEB_URL=${WEB_URL}"
}

deploy_admin() {
  echo ""
  echo "==> Deploying admin (full monorepo upload)"
  load_vercel_ids "apps/admin"
  cd "$ROOT"
  vercel deploy . --prod --yes \
    --local-config=apps/admin/vercel.project.json \
    -e "NEXT_PUBLIC_API_URL=${API_URL}" \
    -e "NEXT_PUBLIC_WEB_URL=${WEB_URL}" \
    -e "NEXT_PUBLIC_ADMIN_URL=${ADMIN_URL}"
}

deploy_web
deploy_admin

echo ""
echo "==> Done. Production URLs in Vercel dashboard."
echo "Custom domains: docs/DEPLOY.md"
