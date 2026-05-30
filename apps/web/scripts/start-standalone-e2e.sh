#!/usr/bin/env bash
# Start Next standalone server for Playwright (CI). Copies static assets first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STANDALONE_ROOT="$ROOT/.next/standalone"
APP_DIR="$STANDALONE_ROOT/apps/web"

if [[ ! -f "$APP_DIR/server.js" ]]; then
  echo "Missing $APP_DIR/server.js — run npm run build first" >&2
  exit 1
fi

mkdir -p "$APP_DIR/.next"
rm -rf "$APP_DIR/.next/static" "$APP_DIR/public"
cp -r .next/static "$APP_DIR/.next/static"
cp -r public "$APP_DIR/public"

# GHA sets HOSTNAME to the runner id — force loopback so Playwright can reach the server.
export HOSTNAME="127.0.0.1"
export PORT="${PORT:-3000}"
cd "$STANDALONE_ROOT"
exec node apps/web/server.js
