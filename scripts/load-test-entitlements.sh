#!/usr/bin/env bash
# Entitlement-heavy API load (tiers, membership me, live, feed). Staging only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=load/lib-report.sh
source "$ROOT/scripts/load/lib-report.sh"

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-1000}"
CONCURRENCY="${CONCURRENCY:-20}"
CREATOR_ID="${FORGE_LOAD_CREATOR_ID:-}"
TOKEN="${FORGE_LOAD_TOKEN:-}"
EVIDENCE_FILE="${FORGE_LOAD_EVIDENCE_FILE:-}"

echo "FORGE entitlement load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"
[[ -n "$CREATOR_ID" ]] && echo "Creator: $CREATOR_ID" || echo "Tip: set FORGE_LOAD_CREATOR_ID to hit /creators/:id/tiers"
[[ -n "$TOKEN" ]] && echo "Auth: bearer token set" || echo "Auth: anonymous (optional FORGE_LOAD_TOKEN)"

run_one() {
  local n=$((RANDOM % 5))
  local out
  local auth_args=()
  if [[ -n "${TOKEN:-}" ]]; then
    auth_args=(-H "Authorization: Bearer ${TOKEN}")
  fi
  case "$n" in
    0)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "${auth_args[@]}" "$API_URL/streams/live" 2>/dev/null || echo "err 0")
      ;;
    1)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "${auth_args[@]}" "$API_URL/videos/feed?limit=24&sort=forYou" 2>/dev/null || echo "err 0")
      ;;
    2)
      if [[ -n "${CREATOR_ID:-}" ]]; then
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "${auth_args[@]}" "$API_URL/creators/${CREATOR_ID}/tiers" 2>/dev/null || echo "err 0")
      else
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "${auth_args[@]}" "$API_URL/streams/live" 2>/dev/null || echo "err 0")
      fi
      ;;
    3)
      if [[ -n "${CREATOR_ID:-}" ]]; then
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "${auth_args[@]}" "$API_URL/creators/${CREATOR_ID}/membership/me" 2>/dev/null || echo "err 0")
      else
        out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
          "${auth_args[@]}" "$API_URL/health/ready" 2>/dev/null || echo "err 0")
      fi
      ;;
    *)
      out=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" \
        "${auth_args[@]}" "$API_URL/health/ready" 2>/dev/null || echo "err 0")
      ;;
  esac
  echo "$out"
}

export -f run_one
export API_URL CREATOR_ID TOKEN

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' >"$TMP_OUT"

forge_load_report "$TMP_OUT" "$EVIDENCE_FILE" "FORGE load-test:entitlements evidence"
echo "Done."
