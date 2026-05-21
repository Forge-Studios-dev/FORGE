#!/usr/bin/env bash
# Push Fly + Vercel credentials to GitHub Actions secrets (repo: Forge-Studios-dev/FORGE).
# Requires: gh auth login (or GH_TOKEN / GITHUB_TOKEN with repo admin).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${GITHUB_REPO:-Forge-Studios-dev/FORGE}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    printf '%s' "${GH_TOKEN:-$GITHUB_TOKEN}" | gh auth login --with-token
  else
    echo "ERROR: Run: gh auth login"
    echo "  Or: export GH_TOKEN=ghp_... && bash scripts/setup-github-secrets.sh"
    exit 1
  fi
fi

VERCEL_ORG_ID="$(python3 -c "import json; print(json.load(open('$ROOT/apps/web/.vercel/project.json'))['orgId'])")"
VERCEL_PROJECT_ID_WEB="$(python3 -c "import json; print(json.load(open('$ROOT/apps/web/.vercel/project.json'))['projectId'])")"
VERCEL_PROJECT_ID_ADMIN="$(python3 -c "import json; print(json.load(open('$ROOT/apps/admin/.vercel/project.json'))['projectId'])")"

FLY_API_TOKEN=""
if command -v fly >/dev/null 2>&1 && fly auth whoami >/dev/null 2>&1; then
  FLY_API_TOKEN="$(fly auth token 2>/dev/null | tr -d '\n')"
fi
if [[ -z "$FLY_API_TOKEN" && -n "${FLY_API_TOKEN_FILE:-}" && -f "$FLY_API_TOKEN_FILE" ]]; then
  FLY_API_TOKEN="$(tr -d '\n' <"$FLY_API_TOKEN_FILE")"
fi

VERCEL_TOKEN=""
VERCEL_AUTH="${VERCEL_AUTH:-$HOME/Library/Application Support/com.vercel.cli/auth.json}"
if [[ ! -f "$VERCEL_AUTH" && -f "$HOME/.local/share/com.vercel.cli/auth.json" ]]; then
  VERCEL_AUTH="$HOME/.local/share/com.vercel.cli/auth.json"
fi
if [[ -f "$VERCEL_AUTH" ]]; then
  VERCEL_TOKEN="$(python3 -c "import json; print(json.load(open('$VERCEL_AUTH')).get('token',''))" 2>/dev/null || true)"
fi
if [[ -z "$VERCEL_TOKEN" && -n "${VERCEL_TOKEN:-}" ]]; then
  VERCEL_TOKEN="${VERCEL_TOKEN}"
fi

missing=0
[[ -n "$FLY_API_TOKEN" ]] || { echo "ERROR: FLY_API_TOKEN missing (fly auth login)"; missing=1; }
[[ -n "$VERCEL_TOKEN" ]] || { echo "ERROR: VERCEL_TOKEN missing (vercel login)"; missing=1; }
[[ "$missing" -eq 0 ]] || exit 1

echo "==> Setting GitHub Actions secrets on $REPO"
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID" --repo "$REPO"
gh secret set VERCEL_PROJECT_ID_WEB --body "$VERCEL_PROJECT_ID_WEB" --repo "$REPO"
gh secret set VERCEL_PROJECT_ID_ADMIN --body "$VERCEL_PROJECT_ID_ADMIN" --repo "$REPO"
gh secret set FLY_API_TOKEN --body "$FLY_API_TOKEN" --repo "$REPO"
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN" --repo "$REPO"

echo "OK: secrets set (FLY_API_TOKEN, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN)"
echo ""
echo "==> Triggering CI + Release workflows"
gh workflow run CI.yml --repo "$REPO" --ref main 2>/dev/null || gh workflow run ci.yml --repo "$REPO" --ref main || true
sleep 3
echo "Watch: https://github.com/$REPO/actions"
