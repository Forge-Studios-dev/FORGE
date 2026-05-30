#!/usr/bin/env bash
# Pre-deploy checklist (reads apps/api/.env or env vars). Does not deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${FORGE_ENV_FILE:-$ROOT/apps/api/.env}"
FAIL=0

warn() { echo "WARN: $*" >&2; }
fail() { echo "FAIL: $*" >&2; FAIL=1; }
ok() { echo "OK: $*"; }

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ok "Loaded $ENV_FILE"
else
  warn "No $ENV_FILE — using existing environment only"
fi

NODE_ENV="${NODE_ENV:-development}"
if [[ "$NODE_ENV" == "production" ]]; then
  for var in JWT_SECRET JWT_REFRESH_SECRET MUX_WEBHOOK_SECRET DATABASE_URL; do
    if [[ -z "${!var:-}" ]]; then
      fail "production missing $var"
    fi
  done
  if [[ "${JWT_SECRET:-}" == *change-this* ]] || [[ "${JWT_SECRET:-}" == your-super-secret* ]]; then
    fail "JWT_SECRET still uses example placeholder"
  fi
  if [[ "${ENABLE_VIDEO_WORKER:-false}" == "true" && "${WORKER_ONLY:-false}" != "true" ]]; then
    fail "ENABLE_VIDEO_WORKER on API in production — use separate worker app"
  fi
  if [[ "${ALLOW_PROXY_UPLOAD:-false}" == "true" ]]; then
    warn "ALLOW_PROXY_UPLOAD=true in production (large uploads through API)"
  fi
  ok "production env vars present"
else
  ok "NODE_ENV=$NODE_ENV (skipping strict production secret checks)"
fi

if [[ -n "${REDIS_URL:-}" ]]; then
  ok "Redis configured"
else
  fail "Redis not configured"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  ok "DATABASE_URL set"
else
  fail "DATABASE_URL missing"
fi

if [[ "${METRICS_ENABLED:-false}" == "true" ]]; then
  ok "METRICS_ENABLED=true"
else
  warn "METRICS_ENABLED not true — Prometheus scrape will 404"
fi

if [[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
  ok "OpenTelemetry endpoint configured"
fi

if [[ -n "${FEATURE_FLAGS:-}" ]] && echo "$FEATURE_FLAGS" | grep -q multipart_upload; then
  ok "multipart_upload feature flag enabled"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Production readiness checks passed (see docs/MVP_GO_LIVE.md for deploy steps)."
else
  echo "Fix failures before promoting to production." >&2
  exit 1
fi
