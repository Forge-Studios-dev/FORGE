#!/usr/bin/env bash
# Bootstrap local auth: Mailpit SMTP + apps/api/.env + apps/web/.env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="${ROOT}/apps/api/.env"
WEB_ENV="${ROOT}/apps/web/.env.local"
API_EXAMPLE="${ROOT}/apps/api/.env.example"
WEB_EXAMPLE="${ROOT}/apps/web/.env.example"

echo "==> FORGE local auth bootstrap"

if [[ ! -f "$API_ENV" ]]; then
  cp "$API_EXAMPLE" "$API_ENV"
  echo "Created $API_ENV from example"
fi

if [[ ! -f "$WEB_ENV" ]]; then
  cp "$WEB_EXAMPLE" "$WEB_ENV"
  echo "Created $WEB_ENV from example"
fi

# Mailpit (local SMTP catcher) — UI http://localhost:8025
if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -qx forge-mailpit; then
    echo "==> Starting Mailpit (SMTP :1025, UI :8025)"
    docker run -d --name forge-mailpit --restart unless-stopped \
      -p 1025:1025 -p 8025:8025 \
      axllent/mailpit:latest 2>/dev/null || docker start forge-mailpit 2>/dev/null || true
  else
    echo "==> Mailpit already running"
  fi
fi

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
  fi
}

upsert_env "$API_ENV" SMTP_HOST localhost
upsert_env "$API_ENV" SMTP_PORT 1025
upsert_env "$API_ENV" SMTP_USER local
upsert_env "$API_ENV" SMTP_PASS local
upsert_env "$API_ENV" MAIL_FROM 'noreply@localhost'
upsert_env "$API_ENV" WEB_URL 'http://localhost:3000'
upsert_env "$API_ENV" GOOGLE_OAUTH_ENABLED 'false'
upsert_env "$WEB_ENV" NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED 'false'

echo ""
echo "==> Local SMTP → Mailpit (open http://localhost:8025 after signup)"
echo "==> Enable Google locally: set GOOGLE_OAUTH_ENABLED=true + GOOGLE_CLIENT_* in apps/api/.env"
echo "    and NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true in apps/web/.env.local"
echo ""
echo "Check: bash scripts/check-auth-env.sh"
echo "Production: cp secrets/auth-deploy.env.example secrets/auth-deploy.env && bash scripts/deploy-auth-secrets.sh"
