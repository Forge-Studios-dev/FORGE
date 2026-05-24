#!/usr/bin/env bash
# Confirm FORGE Grafana alert rules exist (from grafana-alert-rules.json).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES="${ROOT}/infra/observability/grafana-alert-rules.json"
HOST="${GRAFANA_HOST:-https://forgesupport.grafana.net}"
TOKEN="${GRAFANA_SA_TOKEN:-${GRAFANA_API_KEY:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "SKIP: set GRAFANA_SA_TOKEN to verify Grafana alerts" >&2
  exit 0
fi

expected="$(python3 -c "import json; print(len(json.load(open('$RULES'))))")"
found=0
missing=0

while IFS= read -r uid; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${TOKEN}" \
    "${HOST}/api/v1/provisioning/alert-rules/${uid}")"
  if [[ "$code" == "200" ]]; then
    echo "OK: alert rule ${uid}"
    found=$((found + 1))
  else
    echo "MISSING: ${uid} (HTTP ${code})" >&2
    missing=$((missing + 1))
  fi
done < <(python3 -c "import json; [print(r['uid']) for r in json.load(open('$RULES'))]")

if [[ "$missing" -gt 0 ]]; then
  echo "Run: npm run import:grafana-alerts" >&2
  exit 1
fi
echo "OK: ${found}/${expected} alert rules present"
