#!/usr/bin/env bash
# Community 2.0 read-heavy load test. Run against staging only — not production.
set -euo pipefail

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-500}"
CONCURRENCY="${CONCURRENCY:-20}"
SEARCH_Q="${SEARCH_Q:-test}"

echo "FORGE community load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  local n=$((RANDOM % 4))
  case "$n" in
    0) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=${SEARCH_Q}" || echo "err" ;;
    1) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/streams/live" || echo "err" ;;
    2) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/health" || echo "err" ;;
    3) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=forge" || echo "err" ;;
  esac
}

export -f run_one
export API_URL SEARCH_Q

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' | awk '
  { c[$1]++ } END { for (k in c) print k, c[k] }
'

echo "Done."
