#!/usr/bin/env bash
set -euo pipefail
# Neon consumption + endpoint health report (invoice-aligned v2 metrics).
# Usage:
#   export NEON_API_KEY='napi_...'
#   export NEON_ORG_ID='org-...'          # optional if NEON_PROJECT_ID set
#   export NEON_PROJECT_ID='...'          # optional; defaults to first project in org
#   bash scripts/neon-consumption-report.sh
#   bash scripts/neon-consumption-report.sh --days 14
set -euo pipefail

API_BASE="https://console.neon.tech/api/v2"
DAYS=14
LAUNCH_CU_RATE="0.106"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "${NEON_API_KEY:-}" ]]; then
  echo "ERROR: Set NEON_API_KEY (Neon console → Account → API keys)."
  exit 1
fi

auth() {
  curl -sS -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" "$@"
}

if [[ -z "${NEON_ORG_ID:-}" ]]; then
  NEON_ORG_ID="$(auth "$API_BASE/users/me/organizations" | python3 -c "
import json,sys
orgs=json.load(sys.stdin).get('organizations',[])
print(orgs[0]['id'] if orgs else '')
")"
fi

if [[ -z "$NEON_ORG_ID" ]]; then
  echo "ERROR: Could not resolve NEON_ORG_ID. Export it explicitly."
  exit 1
fi

if [[ -z "${NEON_PROJECT_ID:-}" ]]; then
  NEON_PROJECT_ID="$(auth "$API_BASE/projects?org_id=$NEON_ORG_ID" | python3 -c "
import json,sys
projs=json.load(sys.stdin).get('projects',[])
print(projs[0]['id'] if projs else '')
")"
fi

if [[ -z "$NEON_PROJECT_ID" ]]; then
  echo "ERROR: No Neon project found for org $NEON_ORG_ID"
  exit 1
fi

FROM="$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)-timedelta(days=$DAYS)).strftime('%Y-%m-%dT00:00:00Z'))")"
TO="$(python3 -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).strftime('%Y-%m-%dT00:00:00Z'))")"

echo "==> Neon consumption report"
echo "    org:     $NEON_ORG_ID"
echo "    project: $NEON_PROJECT_ID"
echo "    range:   $FROM → $TO (${DAYS}d)"
echo

echo "==> Daily compute (CU-hours)"
auth "$API_BASE/consumption_history/v2/projects?org_id=$NEON_ORG_ID&project_ids=$NEON_PROJECT_ID&from=$FROM&to=$TO&granularity=daily&metrics=compute_unit_seconds,root_branch_bytes_month,public_network_transfer_bytes" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
total=0
for p in d.get('projects',[]):
  for period in p.get('periods',[]):
    for c in period.get('consumption',[]):
      day=c['timeframe_start'][:10]
      cu=0
      storage=0
      xfer=0
      for m in c.get('metrics',[]):
        if m['metric_name']=='compute_unit_seconds': cu=m['value']
        if m['metric_name']=='root_branch_bytes_month': storage=m['value']
        if m['metric_name']=='public_network_transfer_bytes': xfer=m['value']
      total+=cu
      print(f\"  {day}  CU-hr={cu/3600:6.2f}  storage_bytes={storage}  transfer_bytes={xfer}\")
print(f\"TOTAL CU-hr: {total/3600:.2f}  est_compute_usd=\${total/3600*$LAUNCH_CU_RATE:.2f}\")
"

echo
echo "==> Endpoints (autosuspend / CU limits)"
auth "$API_BASE/projects/$NEON_PROJECT_ID/endpoints" \
  | python3 -c "
import json,sys
for ep in json.load(sys.stdin).get('endpoints',[]):
  print(f\"  {ep['id']}\")
  print(f\"    state={ep.get('current_state')}  last_active={ep.get('last_active')}\")
  print(f\"    min_cu={ep.get('autoscaling_limit_min_cu')}  max_cu={ep.get('autoscaling_limit_max_cu')}\")
  print(f\"    suspend_timeout_seconds={ep.get('suspend_timeout_seconds')}\")
"

echo
echo "==> Branches"
auth "$API_BASE/projects/$NEON_PROJECT_ID/branches" \
  | python3 -c "
import json,sys
for b in json.load(sys.stdin).get('branches',[]):
  mb=b.get('logical_size',0)/1024/1024
  print(f\"  {b['name']} ({b['id']})  size={mb:.1f}MB  primary={b.get('primary')}\")
"

echo
echo "Done. Alert if daily CU-hr > 6 with no live traffic."
