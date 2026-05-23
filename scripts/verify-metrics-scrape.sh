#!/usr/bin/env bash
# Verify production /metrics auth (optional METRICS_SCRAPE_TOKEN or read from Fly).
set -euo pipefail

URL="${FORGE_METRICS_URL:-https://api.forgestudios.net/metrics}"
TOKEN="${METRICS_SCRAPE_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  API_APP="${FLY_API_APP:-forge-studios-api}"
  if command -v flyctl >/dev/null 2>&1; then FLY=flyctl
  elif command -v fly >/dev/null 2>&1; then FLY=fly
  else FLY=; fi
  if [[ -n "$FLY" ]] && { [[ -n "${FLY_API_TOKEN:-}" ]] || "$FLY" auth whoami >/dev/null 2>&1; }; then
    TOKEN="$("$FLY" ssh console -a "$API_APP" -C 'printenv METRICS_SCRAPE_TOKEN' 2>&1 | grep -v '^Connecting' | tail -1 || true)"
  fi
fi

noauth="$(curl -sS -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
echo "GET $URL without auth → $noauth (expect 401 when METRICS_SCRAPE_TOKEN is set)"

if [[ -z "$TOKEN" ]]; then
  echo "WARN: METRICS_SCRAPE_TOKEN not set — skip bearer check (set env or fly auth)" >&2
  exit 0
fi

auth="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "$URL" 2>/dev/null || echo 000)"
if [[ "$auth" != "200" ]]; then
  echo "FAIL: bearer scrape returned $auth (expected 200)" >&2
  exit 1
fi
echo "OK: bearer scrape → 200"
body="$(curl -sS -H "Authorization: Bearer ${TOKEN}" "$URL" 2>/dev/null || true)"
if echo "$body" | head -1 | grep -q '^{'; then
  echo "FAIL: /metrics returned JSON (Prometheus scrapers need raw text). Deploy metrics transform skip." >&2
  exit 1
fi
if echo "$body" | grep -q forge_http_requests_total; then
  echo "OK: raw Prometheus body includes forge_http_requests_total"
else
  echo "WARN: 200 but forge_http_requests_total not found in body" >&2
fi
