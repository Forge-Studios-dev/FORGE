#!/usr/bin/env bash
# Push secrets/auth-deploy.env values to GitHub Actions secrets (for deploy-auth-secrets.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${FORGE_AUTH_DEPLOY_ENV:-${ROOT}/secrets/auth-deploy.env}"
REPO="${GITHUB_REPO:-Forge-Studios-dev/FORGE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: $ENV_FILE not found. Copy secrets/auth-deploy.env.example first." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "FAIL: gh CLI required" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

keys=(
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
  SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM
  FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY
)

for k in "${keys[@]}"; do
  v="${!k:-}"
  if [[ -z "$v" ]]; then
    echo "SKIP $k (empty)"
    continue
  fi
  printf '%s' "$v" | gh secret set "$k" --repo "$REPO"
  echo "OK: $k"
done

echo ""
echo "Run workflow: gh workflow run deploy-auth-secrets.yml --ref main"
