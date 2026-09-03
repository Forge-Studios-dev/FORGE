#!/usr/bin/env bash
# Community 2.0 read-heavy load test. Staging only — not production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load/lib-report.sh
source "$ROOT/scripts/load/lib-report.sh"

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-500}"
CONCURRENCY="${CONCURRENCY:-20}"
SEARCH_Q="${SEARCH_Q:-test}"
CREATOR_ID="${FORGE_LOAD_CREATOR_ID:-}"
EVIDENCE_FILE="${FORGE_LOAD_EVIDENCE_FILE:-}"

echo "FORGE community load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  local n=$((RANDOM % 7))
  local out
  case "$n" in
    0)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/communities/search?q=${SEARCH_Q}" 2>/dev/null || echo "err 0")
      ;;
    1)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/streams/live" 2>/dev/null || echo "err 0")
      ;;
    2)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/health/ready" 2>/dev/null || echo "err 0")
      ;;
    3)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/communities/search?q=forge" 2>/dev/null || echo "err 0")
      ;;
    4)
      if [[ -n "${CREATOR_ID:-}" ]]; then
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "$API_URL/creators/${CREATOR_ID}/bundles" 2>/dev/null || echo "err 0")
      else
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "$API_URL/communities/search?q=community" 2>/dev/null || echo "err 0")
      fi
      ;;
    5)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/communities/discover/featured" 2>/dev/null || echo "err 0")
      ;;
    *)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/communities/search?q=lms" 2>/dev/null || echo "err 0")
      ;;
  esac
  echo "$out"
}

export -f run_one
export API_URL SEARCH_Q CREATOR_ID

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' >"$TMP_OUT"

forge_load_report "$TMP_OUT" "$EVIDENCE_FILE" "FORGE load-test:community evidence"
echo "Done. Set FORGE_LOAD_CREATOR_ID to include public bundle list in the mix."
