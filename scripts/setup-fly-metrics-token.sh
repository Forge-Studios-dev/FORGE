#!/usr/bin/env bash
# Generate METRICS_SCRAPE_TOKEN and set on forge-studios-api (locks /metrics to Bearer auth).
set -euo pipefail

APP="${FLY_API_APP:-forge-studios-api}"

if command -v flyctl >/dev/null 2>&1; then
  FLY=flyctl
elif command -v fly >/dev/null 2>&1; then
  FLY=fly
else
  echo "ERROR: flyctl/fly not found" >&2
  exit 1
fi

if [[ -z "${FLY_API_TOKEN:-}" ]] && ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "ERROR: fly auth login or set FLY_API_TOKEN" >&2
  exit 1
fi

TOKEN="${METRICS_SCRAPE_TOKEN:-$(openssl rand -hex 32)}"
echo "==> Setting METRICS_SCRAPE_TOKEN on $APP"
"$FLY" secrets set "METRICS_SCRAPE_TOKEN=${TOKEN}" -a "$APP"

echo ""
echo "Grafana Cloud Metrics Endpoint → scrape job → Bearer credential:"
echo "  ${TOKEN}"
echo ""
echo "Verify (expect 401 without header, 200 with Bearer):"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://api.forgestudios.net/metrics"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' -H \"Authorization: Bearer ${TOKEN}\" https://api.forgestudios.net/metrics"
