#!/usr/bin/env bash
# Deploy FORGE BullMQ / FFmpeg worker on Fly (separate from API).
# API must NOT run video processors — only this app should (WORKER_ONLY=true).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKER_APP="${FLY_WORKER_APP:-forge-studios-worker}"
API_APP="${FLY_API_APP:-forge-studios-api}"

echo "==> FORGE Fly worker setup (app: $WORKER_APP)"

if command -v flyctl >/dev/null 2>&1; then
  FLY=flyctl
elif command -v fly >/dev/null 2>&1; then
  FLY=fly
else
  echo "ERROR: flyctl/fly not found. Install: brew install flyctl"
  exit 1
fi

if ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "ERROR: Not logged in. Run: fly auth login"
  exit 1
fi

if ! "$FLY" apps list 2>/dev/null | grep -q "$WORKER_APP"; then
  echo "==> Creating worker app: $WORKER_APP"
  "$FLY" apps create "$WORKER_APP"
fi

echo "==> Syncing production secrets from $API_APP (not local .env)..."
bash "$ROOT/scripts/sync-fly-worker-secrets.sh"

echo "==> Deploying worker (fly.worker.toml)..."
"$FLY" deploy -c fly.worker.toml -a "$WORKER_APP" --remote-only --ha=false

echo "==> Done. API app should NOT set ENABLE_VIDEO_WORKER or WORKER_ONLY."
echo "    Worker consumes BullMQ video-processing + analytics-ingest queues."
