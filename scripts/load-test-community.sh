#!/usr/bin/env bash
# Community 2.0 read-heavy load test. Run against staging only — not production.
set -euo pipefail

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-500}"
CONCURRENCY="${CONCURRENCY:-20}"
SEARCH_Q="${SEARCH_Q:-test}"
CREATOR_ID="${FORGE_LOAD_CREATOR_ID:-}"

echo "FORGE community load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  local n=$((RANDOM % 7))
  case "$n" in
    0) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=${SEARCH_Q}" || echo "err" ;;
    1) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/streams/live" || echo "err" ;;
    2) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/health" || echo "err" ;;
    3) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=forge" || echo "err" ;;
    4)
      if [[ -n "$CREATOR_ID" ]]; then
        curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/creators/${CREATOR_ID}/bundles" || echo "err"
      else
        curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=community" || echo "err"
      fi
      ;;
    5) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/discover/featured" || echo "err" ;;
    6) curl -sf -o /dev/null -w "%{http_code}\n" "$API_URL/communities/search?q=lms" || echo "err" ;;
  esac
}

export -f run_one
export API_URL SEARCH_Q CREATOR_ID

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' | awk '
  { c[$1]++ } END { for (k in c) print k, c[k] }
'

echo "Done. Set FORGE_LOAD_CREATOR_ID to include public bundle list in the mix."
