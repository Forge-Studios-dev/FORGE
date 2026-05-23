#!/usr/bin/env bash
# Create Grafana Cloud Metrics Endpoint scrape job via Connections API.
# Requires GRAFANA_CLOUD_ACCESS_POLICY_TOKEN with Connections write + stack id.
set -euo pipefail

GLC="${GRAFANA_CLOUD_ACCESS_POLICY_TOKEN:-}"
STACK_ID="${GRAFANA_STACK_ID:-}"
CLUSTER="${GRAFANA_CONNECTIONS_CLUSTER:-prod-ap-south-1}"
JOB="${GRAFANA_SCRAPE_JOB_NAME:-forge-api}"
URL="${GRAFANA_SCRAPE_URL:-https://api.forgestudios.net/metrics}"
INTERVAL="${GRAFANA_SCRAPE_INTERVAL:-60}"
SCRAPE_TOKEN="${METRICS_SCRAPE_TOKEN:-}"

if [[ -z "$GLC" ]]; then
  echo "ERROR: set GRAFANA_CLOUD_ACCESS_POLICY_TOKEN" >&2
  exit 1
fi

if [[ -z "$SCRAPE_TOKEN" ]]; then
  API_APP="${FLY_API_APP:-forge-studios-api}"
  if command -v flyctl >/dev/null 2>&1; then FLY=flyctl
  elif command -v fly >/dev/null 2>&1; then FLY=fly
  else FLY=; fi
  if [[ -n "$FLY" ]] && { [[ -n "${FLY_API_TOKEN:-}" ]] || "$FLY" auth whoami >/dev/null 2>&1; }; then
    SCRAPE_TOKEN="$("$FLY" ssh console -a "$API_APP" -C 'printenv METRICS_SCRAPE_TOKEN' 2>&1 | grep -v '^Connecting' | tail -1 || true)"
  fi
fi
if [[ -z "$SCRAPE_TOKEN" ]]; then
  echo "ERROR: METRICS_SCRAPE_TOKEN required (Fly or env)" >&2
  exit 1
fi

if [[ -z "$STACK_ID" ]]; then
  echo "ERROR: set GRAFANA_STACK_ID (Prometheus user id from datasource, often numeric)" >&2
  echo "  Grafana → Connections → Metrics Endpoint, or datasource grafanacloud-forgesupport-prom basicAuthUser" >&2
  exit 1
fi

BASE="https://connections-api-${CLUSTER}.grafana.net/api/v1/stacks/${STACK_ID}/metrics-endpoint/jobs"
PAYLOAD="$(python3 <<PY
import json
print(json.dumps({
  "enabled": True,
  "url": "$URL",
  "scrapeIntervalSeconds": int("$INTERVAL"),
  "authenticationMethod": "bearer",
  "authenticationBearerToken": "$SCRAPE_TOKEN",
}))
PY
)"

echo "==> PUT ${BASE}/${JOB}"
code="$(curl -sS -o /tmp/grafana-scrape-resp.json -w '%{http_code}' \
  -X PUT \
  -H "Authorization: Bearer ${GLC}" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  "${BASE}/${JOB}")"

if [[ "$code" == "200" || "$code" == "201" ]]; then
  echo "OK: scrape job ${JOB} created/updated (HTTP ${code})"
  cat /tmp/grafana-scrape-resp.json | python3 -m json.tool 2>/dev/null || cat /tmp/grafana-scrape-resp.json
  exit 0
fi

echo "FAIL: HTTP ${code}" >&2
cat /tmp/grafana-scrape-resp.json >&2
echo "" >&2
echo "If 403/404: add Connections + stacks scopes to your Cloud access policy, or use UI:" >&2
echo "  SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape" >&2
exit 1
