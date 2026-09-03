#!/usr/bin/env bash
# Verify R1 health honesty labels on a running API (staging/prod diagnostic).
# Usage:
#   FORGE_API_URL=https://api.forgestudios.net/api/v1 bash scripts/verify-r1-health-honesty.sh
set -euo pipefail

API_URL="${FORGE_API_URL:-http://localhost:4000/api/v1}"
EVIDENCE_FILE="${FORGE_HEALTH_EVIDENCE_FILE:-}"

echo "FORGE R1 health honesty — $API_URL/health/ready"

JSON=$(curl -sS --fail --max-time 15 "$API_URL/health/ready")
echo "$JSON" | python3 -c '
import json, sys
body = json.load(sys.stdin)
checks = body.get("checks") or {}
required = [
  "database", "redis", "contentScan", "billing",
  "muxSigning", "appCheck", "mockSubscriptions",
]
missing = [k for k in required if k not in checks]
if missing:
  print("MISSING honesty labels:", ", ".join(missing), file=sys.stderr)
  sys.exit(1)
print("status:", body.get("status"))
for k in required:
  print(f"  {k}: {checks[k]}")
# Soft warnings (not failures) — ops still owns vendor/keys
warnings = []
if checks.get("contentScan") in ("noop", "noop_ack"):
  warnings.append("contentScan is still noop — CSAM vendor gate open")
if checks.get("billing") in ("stub", "misconfigured"):
  warnings.append("billing not live Stripe yet")
if checks.get("muxSigning") != "configured":
  warnings.append("muxSigning not configured — private playback withheld")
if checks.get("appCheck") == "misconfigured":
  warnings.append("appCheck misconfigured — guarded auth fails closed")
if checks.get("mockSubscriptions") == "enabled":
  warnings.append("mockSubscriptions enabled — must not be production money path")
if warnings:
  print("warnings:")
  for w in warnings:
    print(" -", w)
'

if [[ -n "$EVIDENCE_FILE" ]]; then
  mkdir -p "$(dirname "$EVIDENCE_FILE")"
  {
    echo "# FORGE R1 health honesty evidence"
    echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "api: $API_URL"
    echo
    echo "$JSON"
  } >"$EVIDENCE_FILE"
  echo "Wrote evidence → $EVIDENCE_FILE"
fi

echo "Done."
