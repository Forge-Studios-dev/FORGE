#!/usr/bin/env bash
# Print Grafana Cloud Metrics Endpoint scrape setup (token read from Fly API).
# Does not call Grafana APIs — scrape jobs are created in the Grafana UI or via Terraform.
set -euo pipefail

API_APP="${FLY_API_APP:-forge-studios-api}"
GRAFANA_HOST="${GRAFANA_HOST:-https://forgesupport.grafana.net}"

if command -v flyctl >/dev/null 2>&1; then FLY=flyctl
elif command -v fly >/dev/null 2>&1; then FLY=fly
else echo "ERROR: flyctl/fly required" >&2; exit 1; fi

if [[ -z "${FLY_API_TOKEN:-}" ]] && ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "ERROR: fly auth login or FLY_API_TOKEN" >&2
  exit 1
fi

SCRAPE_TOKEN="${METRICS_SCRAPE_TOKEN:-}"
if [[ -z "$SCRAPE_TOKEN" ]]; then
  SCRAPE_TOKEN="$("$FLY" ssh console -a "$API_APP" -C 'printenv METRICS_SCRAPE_TOKEN' 2>&1 | grep -v '^Connecting' | tail -1 || true)"
fi
if [[ -z "$SCRAPE_TOKEN" ]]; then
  echo "METRICS_SCRAPE_TOKEN not set. Run: npm run setup:fly:metrics-token" >&2
  echo "Or: METRICS_SCRAPE_TOKEN=... npm run configure:grafana-scrape" >&2
  exit 1
fi

noauth="$(curl -sS -o /dev/null -w '%{http_code}' https://api.forgestudios.net/metrics 2>/dev/null || echo 000)"
auth="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${SCRAPE_TOKEN}" https://api.forgestudios.net/metrics 2>/dev/null || echo 000)"
echo "API /metrics: unauthenticated=${noauth} bearer=${auth} (expect 401 / 200)"
echo ""
echo "=== Grafana Cloud: Metrics Endpoint scrape job ==="
echo "1. Open: ${GRAFANA_HOST}/connections  (NOT .../datasources/metrics-endpoint)"
echo "   Or:   ${GRAFANA_HOST}/a/grafana-metricsendpoints-app"
echo "2. Select Metrics Endpoint integration → Create scrape job:"
echo "   Name:     forge-api"
echo "   URL:      https://api.forgestudios.net/metrics"
echo "   Interval: 60s"
echo "   Auth:     Bearer (paste token only — no 'Bearer ' prefix in the field)"
echo ""
if [[ "${SHOW_SCRAPE_TOKEN:-0}" == "1" ]]; then
  echo "Bearer credential (METRICS_SCRAPE_TOKEN):"
  echo "  ${SCRAPE_TOKEN}"
else
  echo "Bearer credential: set (length ${#SCRAPE_TOKEN}). Export SHOW_SCRAPE_TOKEN=1 to print."
fi
echo ""
echo "3. Test connection → Save"
echo "4. Explore → datasource grafanacloud-forgesupport-prom → query: forge_http_requests_total"
echo ""
echo "Import dashboard: GRAFANA_SA_TOKEN=... npm run import:grafana-dashboard"
