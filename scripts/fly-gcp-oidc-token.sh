#!/bin/sh
# Emit Fly OIDC JWT for GCP Workload Identity Federation (credential_source.executable).
# Usage in gcp-wif JSON: command = "/app/apps/api/bin/fly-gcp-oidc-token https://oidc.fly.io/<ORG_SLUG>"
set -eu
AUD="${1:-https://sts.googleapis.com}"
if [ ! -S /.fly/api ]; then
  echo "Fly OIDC socket /.fly/api not found (not running on Fly?)" >&2
  exit 1
fi
curl -sf --unix-socket /.fly/api \
  -X POST "http://localhost/v1/tokens/oidc" \
  -H "Content-Type: application/json" \
  -d "{\"aud\":\"${AUD}\"}"
