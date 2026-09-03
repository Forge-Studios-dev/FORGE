#!/usr/bin/env bash
# Approximate 50K-MAU hot-path load: public feed + search + video detail.
# Target staging only. Prints HTTP status histogram + latency p50/p95 (seconds).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load/lib-report.sh
source "$ROOT/scripts/load/lib-report.sh"

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-2000}"
CONCURRENCY="${CONCURRENCY:-40}"
VIDEO_ID="${FORGE_LOAD_VIDEO_ID:-}"
EVIDENCE_FILE="${FORGE_LOAD_EVIDENCE_FILE:-}"

echo "FORGE feed/watch load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  local n=$((RANDOM % 3))
  local out
  case "$n" in
    0)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/videos/feed?limit=24&sort=forYou" 2>/dev/null || echo "err 0")
      ;;
    1)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "$API_URL/search?q=a&limit=20" 2>/dev/null || echo "err 0")
      ;;
    *)
      if [[ -n "${VIDEO_ID:-}" ]]; then
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "$API_URL/videos/$VIDEO_ID" 2>/dev/null || echo "err 0")
      else
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "$API_URL/videos/feed?limit=12" 2>/dev/null || echo "err 0")
      fi
      ;;
  esac
  echo "$out"
}

export -f run_one
export API_URL VIDEO_ID

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' >"$TMP_OUT"

forge_load_report "$TMP_OUT" "$EVIDENCE_FILE" "FORGE load-test:feed evidence"
echo "Done. Attach evidence (FORGE_LOAD_EVIDENCE_FILE=...) or APM screenshots to the R1 ticket."
