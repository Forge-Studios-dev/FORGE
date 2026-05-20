#!/usr/bin/env bash
# Prints non-secret GitHub Actions values and copies Fly token to clipboard (macOS).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=============================================="
echo "  GitHub Actions secrets — FORGE"
echo "=============================================="
echo ""
echo "Add these at:"
echo "  https://github.com/Forge-Studios-dev/FORGE/settings/secrets/actions"
echo ""
echo "--- Copy these three (from .vercel/project.json) ---"
echo ""
echo "VERCEL_ORG_ID"
python3 -c "import json; print(json.load(open('$ROOT/apps/web/.vercel/project.json'))['orgId'])"
echo ""
echo "VERCEL_PROJECT_ID_WEB"
python3 -c "import json; print(json.load(open('$ROOT/apps/web/.vercel/project.json'))['projectId'])"
echo ""
echo "VERCEL_PROJECT_ID_ADMIN"
python3 -c "import json; print(json.load(open('$ROOT/apps/admin/.vercel/project.json'))['projectId'])"
echo ""
echo "--- FLY_API_TOKEN ---"
if command -v fly >/dev/null 2>&1 && fly auth whoami >/dev/null 2>&1; then
  FLY_TOKEN="$(fly auth token 2>/dev/null | tr -d '\n')"
  if [[ -n "$FLY_TOKEN" ]]; then
    if command -v pbcopy >/dev/null 2>&1; then
      printf '%s' "$FLY_TOKEN" | pbcopy
      echo "Fly token copied to clipboard → paste as GitHub secret FLY_API_TOKEN"
    else
      echo "Fly token (paste as FLY_API_TOKEN):"
      echo "$FLY_TOKEN"
    fi
  else
    echo "Could not read Fly token. Create one: https://fly.io/user/personal_access_tokens"
  fi
else
  echo "Fly CLI not logged in. Run: fly auth login"
  echo "Then create token: https://fly.io/user/personal_access_tokens"
fi
echo ""
echo "--- VERCEL_TOKEN ---"
echo "Create manually (shown once): https://vercel.com/account/settings/tokens"
echo "Account: forge-support-5996 / team forge-s-projects3"
echo ""
echo "Full guide: docs/GITHUB_ACTIONS_SECRETS.md"
echo "=============================================="
