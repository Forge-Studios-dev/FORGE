#!/usr/bin/env bash
# Simulates entitlement-heavy API load (feed + live list). Run against staging only.
set -euo pipefail

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-1000}"
CONCURRENCY="${CONCURRENCY:-20}"

echo "FORGE entitlement load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/streams/live" || echo "err"
}

export -f run_one
export API_URL

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' | awk '
  { c[$1]++ } END { for (k in c) print k, c[k] }
'

echo "Done."
