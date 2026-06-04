#!/usr/bin/env bash
# Full production deploy: Fly API + Vercel web/admin + env + DNS instructions
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${FORGE_API_URL:-https://api.forgestudios.net/api/v1}"
WEB_URL="${FORGE_WEB_URL:-https://forgestudios.net}"
ADMIN_URL="${FORGE_ADMIN_URL:-https://admin.forgestudios.net}"

echo "=============================================="
echo "  FORGE production deploy"
echo "=============================================="

# --- Fly API ---
echo ""
echo "[1/4] Fly.io API"
if fly apps list 2>/dev/null | grep -q forge-studios-api; then
  echo "  App exists. Updating secrets..."
  fly secrets set \
    WEB_URL="$WEB_URL" \
    ADMIN_URL="$ADMIN_URL" \
    --app forge-studios-api
  echo "  Health: $(curl -sf https://forge-studios-api.fly.dev/api/v1/health | head -c 80)..."
else
  echo "  Run: bash scripts/fly-setup.sh"
fi

if ! fly certs list --app forge-studios-api 2>/dev/null | grep -q api.forgestudios.net; then
  echo "  Adding TLS cert for api.forgestudios.net..."
  fly certs add api.forgestudios.net --app forge-studios-api || true
fi
echo "  DNS — see: docs/DEPLOY.md (Part 3)"
fly certs setup api.forgestudios.net --app forge-studios-api 2>/dev/null | head -20 || true

# --- Vercel ---
echo ""
echo "[2/4] Vercel web + admin"
if ! vercel whoami >/dev/null 2>&1; then
  echo "  ERROR: run vercel login"
  exit 1
fi

bash "$ROOT/scripts/vercel-setup.sh"

# --- Domain hints ---
echo ""
echo "[3/4] Custom domains (manual in Squarespace + Vercel UI)"
echo "  DNS (Squarespace): docs/DEPLOY.md"
echo "  Vercel: add forgestudios.net → web, admin.forgestudios.net → admin"
echo ""
echo "  Current DNS apex (should become 76.76.21.21):"
dig +short forgestudios.net A 2>/dev/null | head -3 || true

# --- Demo data ---
echo ""
echo "[4/4] Database (Neon)"
if [[ -f apps/api/.env ]] && grep -q neon.tech apps/api/.env; then
  echo "  Neon configured. Seed if needed: npm run db:neon:setup"
else
  echo "  Set DATABASE_URL in apps/api/.env then: npm run db:neon:setup"
fi

echo ""
echo "=============================================="
echo "  Deploy automation finished"
echo "=============================================="
echo "  API:   $API_URL"
echo "  Web:   $WEB_URL"
echo "  Admin: $ADMIN_URL"
echo ""
echo "  DNS: docs/DEPLOY.md"
echo "=============================================="
