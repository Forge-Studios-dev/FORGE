#!/usr/bin/env bash
# Set Sentry env on Vercel web + admin production.
# Usage: SENTRY_DSN='https://...@....ingest.us.sentry.io/...' bash scripts/set-sentry-vercel-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSN="${SENTRY_DSN:-${NEXT_PUBLIC_SENTRY_DSN:-}}"
TRACES="${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:-0.1}"

if [[ -z "$DSN" || "$DSN" == *xxx* ]]; then
  echo "FAIL: Set SENTRY_DSN from your Sentry project settings" >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "FAIL: vercel CLI required (npm i -g vercel && vercel login)" >&2
  exit 1
fi

set_vercel_env() {
  local subdir="$1"
  local name="$2"
  local val="$3"
  echo "  $name → $subdir (production)"
  (
    cd "$ROOT/$subdir"
    vercel env rm "$name" production -y 2>/dev/null || true
    printf '%s' "$val" | vercel env add "$name" production
  )
}

for app in apps/web apps/admin; do
  if [[ ! -f "$ROOT/$app/.vercel/project.json" ]]; then
    echo "WARN: skip $app — run: cd $app && vercel link" >&2
    continue
  fi
  echo "==> $app"
  set_vercel_env "$app" NEXT_PUBLIC_SENTRY_DSN "$DSN"
  set_vercel_env "$app" NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE "$TRACES"
  set_vercel_env "$app" NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII false
done

echo ""
echo "Done. Redeploy web/admin for env to take effect:"
echo "  bash scripts/vercel-setup.sh"
