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

deploy_from_root() {
  local config="$1"
  local subdir="$2"
  local label="$3"
  echo ""
  echo "==> Deploying $label (full monorepo upload)"

  load_vercel_ids "$subdir"
  cd "$ROOT"
  vercel deploy . --prod --yes \
    --local-config="$config" \
    -e "NEXT_PUBLIC_API_URL=${API_URL}" \
    -e "API_INTERNAL_URL=${API_URL}" \
    -e "NEXT_PUBLIC_APP_URL=${WEB_URL}" \
    -e "NEXT_PUBLIC_ADMIN_URL=${ADMIN_URL}" \
    -e "NEXT_PUBLIC_WEB_URL=${WEB_URL}"
}

deploy_from_root "apps/web/vercel.project.json" "apps/web" "web"
deploy_from_root "apps/admin/vercel.project.json" "apps/admin" "admin"

echo ""
echo "==> Done. Production URLs in Vercel dashboard."
echo "Custom domains: docs/DOMAIN_FORGESTUDIOS.md"
