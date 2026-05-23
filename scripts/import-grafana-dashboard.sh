#!/usr/bin/env bash
# Import infra/observability/grafana-dashboard-forge-api.json into Grafana Cloud.
# Requires GRAFANA_SA_TOKEN (service account token with Admin) or GRAFANA_API_KEY.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD="${ROOT}/infra/observability/grafana-dashboard-forge-api.json"
HOST="${GRAFANA_HOST:-https://forgesupport.grafana.net}"
TOKEN="${GRAFANA_SA_TOKEN:-${GRAFANA_API_KEY:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: set GRAFANA_SA_TOKEN or GRAFANA_API_KEY" >&2
  exit 1
fi

if [[ ! -f "$DASHBOARD" ]]; then
  echo "ERROR: missing $DASHBOARD" >&2
  exit 1
fi

payload="$(python3 <<PY
import json
with open("$DASHBOARD") as f:
    dash = json.load(f)
print(json.dumps({"dashboard": dash, "overwrite": True, "message": "FORGE import script"}))
PY
)"

code="$(curl -sS -o /tmp/grafana-import.json -w "%{http_code}" \
  -X POST "${HOST}/api/dashboards/db" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")"

if [[ "$code" == "200" ]]; then
  url="$(python3 -c "import json; print(json.load(open('/tmp/grafana-import.json')).get('url',''))" 2>/dev/null || true)"
  echo "OK: dashboard imported (HTTP $code)"
  [[ -n "$url" ]] && echo "    ${HOST}${url}"
else
  echo "FAIL: import HTTP $code" >&2
  cat /tmp/grafana-import.json >&2
  exit 1
fi
