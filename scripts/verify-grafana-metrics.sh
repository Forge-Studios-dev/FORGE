#!/usr/bin/env bash
# Confirm FORGE API metrics appear in Grafana Cloud Prometheus (scrape job active).
# Requires GRAFANA_SA_TOKEN (service account) or GRAFANA_API_KEY with datasource query access.
set -euo pipefail

HOST="${GRAFANA_HOST:-https://forgesupport.grafana.net}"
TOKEN="${GRAFANA_SA_TOKEN:-${GRAFANA_API_KEY:-}}"
DS_UID="${GRAFANA_PROM_DS_UID:-grafanacloud-prom}"
JOB="${GRAFANA_SCRAPE_JOB_NAME:-forge-api}"

if [[ -z "$TOKEN" ]]; then
  echo "SKIP: set GRAFANA_SA_TOKEN to verify Grafana ingest (API scrape still checked separately)" >&2
  exit 0
fi

payload="$(JOB="$JOB" DS_UID="$DS_UID" python3 <<'PY'
import json, os
job = os.environ["JOB"]
uid = os.environ["DS_UID"]
expr = f'count(forge_http_requests_total{{job="{job}"}}) or count(forge_http_requests_total)'
print(json.dumps({
  "queries": [{
    "refId": "A",
    "datasource": {"type": "prometheus", "uid": uid},
    "expr": expr,
    "instant": True,
  }],
  "from": "now-15m",
  "to": "now",
}))
PY
)"

resp="$(curl -sS -X POST "${HOST}/api/ds/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")"

count="$(echo "$resp" | python3 -c "
import json, sys
r = json.load(sys.stdin)
frames = r.get('results', {}).get('A', {}).get('frames', [])
if not frames:
    print('0')
    sys.exit(0)
vals = frames[0].get('data', {}).get('values', [])
if len(vals) >= 2 and vals[1]:
    print(int(float(vals[1][0])))
else:
    print('0')
" 2>/dev/null || echo "0")"

if [[ "$count" -gt 0 ]]; then
  echo "OK: Grafana has ${count} forge_http_requests_total series (job=${JOB})"
  exit 0
fi

echo "FAIL: no forge_http_requests_total in Grafana (last 15m)" >&2
echo "  Save scrape job: docs/GRAFANA_SETUP.md" >&2
echo "  API side: npm run verify:metrics-scrape" >&2
exit 1
