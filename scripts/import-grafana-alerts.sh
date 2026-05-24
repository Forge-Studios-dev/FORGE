#!/usr/bin/env bash
# Import infra/observability/grafana-alert-rules.json into Grafana Cloud (Grafana-managed alerting).
# Requires GRAFANA_SA_TOKEN with alerting provisioning permissions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES="${ROOT}/infra/observability/grafana-alert-rules.json"
HOST="${GRAFANA_HOST:-https://forgesupport.grafana.net}"
TOKEN="${GRAFANA_SA_TOKEN:-${GRAFANA_API_KEY:-}}"
FOLDER="${GRAFANA_ALERT_FOLDER_UID:-dfmwlxxyccvswe}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: set GRAFANA_SA_TOKEN or GRAFANA_API_KEY" >&2
  exit 1
fi

if [[ ! -f "$RULES" ]]; then
  echo "ERROR: missing $RULES" >&2
  exit 1
fi

count="$(python3 <<PY
import json
with open("$RULES") as f:
    print(len(json.load(f)))
PY
)"

echo "==> Import ${count} alert rules → ${HOST}"
ok=0
fail=0

while IFS= read -r payload; do
  uid="$(echo "$payload" | python3 -c "import json,sys; print(json.load(sys.stdin)['uid'])")"
  code="$(curl -sS -o /tmp/grafana-alert-resp.json -w '%{http_code}' \
    -X PUT "${HOST}/api/v1/provisioning/alert-rules/${uid}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -H "X-Disable-Provenance: disabled" \
    -d "$payload")"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    echo "OK: ${uid} (HTTP ${code})"
    ok=$((ok + 1))
  else
    echo "FAIL: ${uid} HTTP ${code}" >&2
    cat /tmp/grafana-alert-resp.json >&2
    fail=$((fail + 1))
  fi
done < <(FOLDER="$FOLDER" RULES="$RULES" python3 <<'PY'
import json, os
folder = os.environ["FOLDER"]
with open(os.environ["RULES"]) as f:
    rules = json.load(f)
for r in rules:
    body = dict(r)
    body["folderUID"] = folder
    print(json.dumps(body))
PY
)

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
echo "Done: ${ok}/${count} rules"
