#!/usr/bin/env bash
# Print Grafana Cloud stack + Connections API URLs (requires Cloud API key).
# Create at: https://grafana.com/orgs/<org>/api-keys or Cloud access policies.
set -euo pipefail

SLUG="${GRAFANA_STACK_SLUG:-forgesupport}"
KEY="${GRAFANA_CLOUD_API_KEY:-${GRAFANA_CLOUD_ACCESS_POLICY_TOKEN:-}}"

if [[ -z "$KEY" ]]; then
  echo "ERROR: set GRAFANA_CLOUD_API_KEY or GRAFANA_CLOUD_ACCESS_POLICY_TOKEN" >&2
  exit 1
fi

echo "==> Stack: $SLUG"
curl -sS -H "Authorization: Bearer ${KEY}" "https://grafana.com/api/instances/${SLUG}" \
  | python3 -m json.tool 2>/dev/null | head -35

echo ""
echo "==> Connections info"
curl -sS -H "Authorization: Bearer ${KEY}" "https://grafana.com/api/instances/${SLUG}/connections" \
  | python3 -m json.tool 2>/dev/null

echo ""
echo "Use connections_api_url + access policy token in infra/observability/terraform/"
