#!/usr/bin/env bash
# Enable Google OAuth, SMTP, and Firebase complement on production.
# See docs/AUTH.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> FORGE production auth enablement"
echo ""
echo "1. Copy and fill secrets:"
echo "   cp secrets/auth-deploy.env.example secrets/auth-deploy.env"
echo ""
echo "2. Deploy to Fly:"
echo "   bash scripts/deploy-auth-secrets.sh"
echo ""
echo "3. Set Vercel web env (Firebase client + optional NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED):"
echo "   See apps/web/.env.example and docs/AUTH.md"
echo ""
echo "4. Verify:"
echo "   bash scripts/verify-production-auth.sh"
echo ""

if [[ -f "${ROOT}/secrets/auth-deploy.env" ]]; then
  echo "Found secrets/auth-deploy.env — run deploy-auth-secrets.sh to apply."
else
  echo "No secrets/auth-deploy.env yet — copy from secrets/auth-deploy.env.example"
fi
