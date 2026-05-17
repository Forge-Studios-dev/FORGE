#!/usr/bin/env bash
# One-shot local demo setup: env files, Postgres/Redis, deps, seed, smoke check.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> FORGE local demo setup"

copy_if_missing() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    echo "  keep $dest"
  else
    cp "$src" "$dest"
    echo "  created $dest from $(basename "$src")"
  fi
}

copy_if_missing apps/api/.env.example apps/api/.env
copy_if_missing apps/web/.env.example apps/web/.env.local
copy_if_missing apps/admin/.env.example apps/admin/.env.local

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required. Install Docker Desktop and retry."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 20+ is required."
  exit 1
fi

echo "==> Starting Postgres + Redis"
docker compose up postgres redis -d

echo "==> Waiting for Postgres..."
for i in {1..30}; do
  if docker exec forge-postgres pg_isready -U forge -d forge_db >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Installing npm dependencies"
npm install

echo "==> Seeding database (categories + demo users)"
npm run seed --workspace=apps/api

echo "==> Smoke check (API must be running separately for full pass)"
if curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1; then
  bash scripts/smoke-api.sh || true
else
  echo "  (skip smoke — start API first: npm run dev:api)"
fi

cat <<'EOF'

==> Setup complete

Start three terminals:

  npm run dev:api
  npm run dev:web
  npm run dev:admin

URLs:
  Web    http://localhost:3000
  Admin  http://localhost:3002
  API    http://localhost:3001/api/v1
  Swagger http://localhost:3001/api/docs

Demo logins (see docs/mvp-test-matrix.md):
  viewer@forge.local / ForgeDemo123!   → web & mobile
  admin@forge.local  / ForgeAdmin123!  → admin panel only

Optional: bash scripts/reset-demo-users.sh  (fix roles in DB)
Optional: bash scripts/smoke-api.sh         (after API is up)

For hosting a remote client demo, read docs/DEPLOYMENT_DEMO.md

EOF
