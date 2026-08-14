#!/usr/bin/env bash
# Approximate 50K-MAU hot-path load: public feed + search + video detail.
# Target staging only. Scale: ~50k MAU ≈ few hundred concurrent peak on feed.
set -euo pipefail

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
ITERATIONS="${ITERATIONS:-2000}"
CONCURRENCY="${CONCURRENCY:-40}"
VIDEO_ID="${FORGE_LOAD_VIDEO_ID:-}"

echo "FORGE feed/watch load test — $ITERATIONS requests @ concurrency $CONCURRENCY"
echo "API: $API_URL"

run_one() {
  local n=$((RANDOM % 3))
  local code
  case "$n" in
    0)
      code=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/videos/feed?limit=24&sort=forYou" || echo err)
      ;;
    1)
      code=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/search?q=a&limit=20" || echo err)
      ;;
    *)
      if [[ -n "${VIDEO_ID:-}" ]]; then
        code=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/videos/$VIDEO_ID" || echo err)
      else
        code=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/videos/feed?limit=12" || echo err)
      fi
      ;;
  esac
  echo "$code"
}

export -f run_one
export API_URL VIDEO_ID

seq "$ITERATIONS" | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one' | awk '
  { c[$1]++ } END { for (k in c) print k, c[k] }
'

echo "Done. Review p95/error rates in APM; raise CONCURRENCY toward peak-estimate for 50K MAU."
