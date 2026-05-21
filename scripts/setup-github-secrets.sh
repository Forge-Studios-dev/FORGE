#!/usr/bin/env bash
# Push Fly + Vercel credentials to GitHub Actions secrets (repo: Forge-Studios-dev/FORGE).
# Requires: gh auth login as a user with admin on the repo (e.g. Forge-Studios-dev org account).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${GITHUB_REPO:-Forge-Studios-dev/FORGE}"
MAX_RETRIES="${GH_SECRET_RETRIES:-5}"
RETRY_DELAY_SEC="${GH_SECRET_RETRY_DELAY:-8}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

ensure_gh_auth() {
  # GH_TOKEN in the environment overrides keyring logins (often the wrong user).
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    if [[ "${FORGE_GH_USE_ENV_TOKEN:-}" == "1" ]]; then
      printf '%s' "${GH_TOKEN:-$GITHUB_TOKEN}" | gh auth login --with-token 2>/dev/null || true
    else
      echo "==> Unsetting GH_TOKEN/GITHUB_TOKEN so gh uses keyring (Forge-Studios-dev)"
      unset GH_TOKEN GITHUB_TOKEN
    fi
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "ERROR: Run: gh auth login"
    echo "  Log in as Forge-Studios-dev (or another account with admin on $REPO)."
    exit 1
  fi
  if gh auth status 2>&1 | grep -q 'Forge-Studios-dev'; then
    gh auth switch --user Forge-Studios-dev 2>/dev/null || true
  fi
  echo "==> GitHub CLI user: $(gh api user -q .login 2>/dev/null || echo unknown)"
}

set_secret_with_retry() {
  local name="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  printf '%s' "$value" >"$tmp"
  local attempt=1
  while [[ "$attempt" -le "$MAX_RETRIES" ]]; do
    if gh secret set "$name" --body-file "$tmp" --repo "$REPO" 2>&1; then
      rm -f "$tmp"
      echo "  OK: $name"
      return 0
    fi
    local err=$?
    echo "  WARN: $name attempt $attempt/$MAX_RETRIES failed (exit $err) — retry in ${RETRY_DELAY_SEC}s…"
    sleep "$RETRY_DELAY_SEC"
    attempt=$((attempt + 1))
  done
  rm -f "$tmp"
  echo "  FAIL: $name after $MAX_RETRIES attempts"
  return 1
}

ensure_gh_auth

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

# Classic Vercel token required for `vercel deploy --token` in GitHub Actions.
# OAuth tokens from `vercel login` do NOT work in CI (invalid token error).
VERCEL_TOKEN="${VERCEL_TOKEN:-}"

validate_vercel_token() {
  local tok="$1"
  [[ -n "$tok" ]] || return 1
  # OAuth session tokens from `vercel login` are ~60 chars and fail in GitHub Actions.
  if [[ "${#tok}" -lt 70 ]]; then
    echo "  (token length ${#tok} — need classic token from vercel.com/account/settings/tokens)"
    return 1
  fi
  export VERCEL_ORG_ID="$VERCEL_ORG_ID"
  if VERCEL_TOKEN="$tok" npx --yes vercel@54.2.0 whoami >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "ERROR: Set VERCEL_TOKEN to a classic token before running this script."
  echo ""
  echo "  1. Open https://vercel.com/account/settings/tokens"
  echo "  2. Create Token (full access or deploy scope for team forge-s-projects3)"
  echo "  3. Run:"
  echo "       export VERCEL_TOKEN='paste_token_here'"
  echo "       unset GH_TOKEN GITHUB_TOKEN"
  echo "       gh auth switch --user Forge-Studios-dev"
  echo "       npm run gh:secrets:set"
  echo ""
  echo "  Do NOT use the OAuth token from vercel login — CI rejects it."
  exit 1
fi

if ! validate_vercel_token "$VERCEL_TOKEN"; then
  echo "ERROR: VERCEL_TOKEN failed validation (vercel whoami)."
  echo "  Create a new classic token at https://vercel.com/account/settings/tokens"
  exit 1
fi
echo "==> VERCEL_TOKEN validated (classic token OK)"

missing=0
[[ -n "$FLY_API_TOKEN" ]] || { echo "ERROR: FLY_API_TOKEN missing — run: fly auth login"; missing=1; }
[[ "$missing" -eq 0 ]] || exit 1

echo "==> Setting GitHub Actions secrets on $REPO (retries=$MAX_RETRIES)"
failed=0
set_secret_with_retry VERCEL_ORG_ID "$VERCEL_ORG_ID" || failed=1
sleep 2
set_secret_with_retry VERCEL_PROJECT_ID_WEB "$VERCEL_PROJECT_ID_WEB" || failed=1
sleep 2
set_secret_with_retry VERCEL_PROJECT_ID_ADMIN "$VERCEL_PROJECT_ID_ADMIN" || failed=1
sleep 2
set_secret_with_retry FLY_API_TOKEN "$FLY_API_TOKEN" || failed=1
sleep 2
set_secret_with_retry VERCEL_TOKEN "$VERCEL_TOKEN" || failed=1

if [[ "$failed" -ne 0 ]]; then
  echo ""
  echo "Some secrets failed (often GitHub 504 timeout). Retry:"
  echo "  npm run gh:secrets:set"
  echo "Or set individually:"
  echo "  gh secret set VERCEL_ORG_ID --body '$VERCEL_ORG_ID' --repo $REPO"
  exit 1
fi

echo ""
echo "OK: all five secrets set."
echo "==> Verifying (names only)"
gh secret list --repo "$REPO" 2>/dev/null || true

echo ""
echo "==> Trigger Release (production)"
gh workflow run "Release (production)" --repo "$REPO" --ref main 2>/dev/null || \
  gh workflow run release.yml --repo "$REPO" --ref main || true
echo "Watch: https://github.com/$REPO/actions"
