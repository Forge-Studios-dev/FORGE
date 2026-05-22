#!/usr/bin/env bash
# Start Next standalone server for Playwright (CI). Copies static assets first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STANDALONE="$ROOT/.next/standalone/apps/web"
if [[ ! -f "$STANDALONE/server.js" ]]; then
  echo "Missing $STANDALONE/server.js — run npm run build first" >&2
  exit 1
fi

mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/.next/static" "$STANDALONE/public"
cp -r .next/static "$STANDALONE/.next/static"
cp -r public "$STANDALONE/public"

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
cd "$STANDALONE"
exec node server.js
