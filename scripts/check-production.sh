#!/usr/bin/env bash
# One-shot production health: public API smoke + secured Prometheus scrape.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> FORGE production check"
echo ""

FORGE_SMOKE_MODE=public npm run smoke:api:prod
echo ""
npm run verify:metrics-scrape
echo ""
npm run verify:grafana-metrics

echo ""
echo "==> Summary"
echo "  API:     https://api.forgestudios.net/api/v1/health"
echo "  Metrics: https://api.forgestudios.net/metrics (Bearer required)"
echo "  Grafana: https://forgesupport.grafana.net/d/forge-api/forge-api"
echo "  Web:     https://forgestudios.net"
echo "  Admin:   https://admin.forgestudios.net"
