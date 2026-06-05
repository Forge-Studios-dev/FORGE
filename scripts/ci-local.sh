#!/usr/bin/env bash
# Run the same checks as .github/workflows/ci.yml locally.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> shared packages"
npm run build --workspace=@forge/shared-types
npm run test --workspace=@forge/shared-types
npm run build --workspace=@forge/design-system

echo "==> API lint + build + test"
npm run build --workspace=@forge/shared-types
npm run lint:ci --workspace=@forge/api
npm run build --workspace=@forge/api
DATABASE_URL="${DATABASE_URL:-postgresql://forge:forge@localhost:5432/forge}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-min-32-chars}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-local-dev-refresh-secret-min-32-chars}"
export DATABASE_URL REDIS_URL JWT_SECRET JWT_REFRESH_SECRET NODE_ENV=test MIGRATIONS_RUN=true
npm run test --workspace=@forge/api
npm run test:e2e --workspace=@forge/api
npm run test:cov --workspace=@forge/api

echo "==> Web lint + build"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.forgestudios.net/api/v1}"
export API_INTERNAL_URL="${API_INTERNAL_URL:-$NEXT_PUBLIC_API_URL}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://forgestudios.net}"
export NEXT_PUBLIC_WEB_URL="${NEXT_PUBLIC_WEB_URL:-https://forgestudios.net}"
export NEXT_PUBLIC_ADMIN_URL="${NEXT_PUBLIC_ADMIN_URL:-https://admin.forgestudios.net}"
npm run lint --workspace=@forge/web
npm run build --workspace=@forge/web

echo "==> Admin lint + build"
npm run lint --workspace=@forge/admin
npm run build --workspace=@forge/admin

if command -v flutter >/dev/null 2>&1; then
  echo "==> Mobile analyze"
  (cd apps/mobile && flutter pub get && flutter analyze --no-fatal-infos)
else
  echo "==> Skip mobile (flutter not installed)"
fi

echo "==> CI local checks passed"
echo "Optional: cd apps/web && npm run test:e2e  (requires web build + playwright)"
