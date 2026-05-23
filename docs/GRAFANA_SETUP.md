# Grafana Cloud setup — FORGE production

## Status checklist

| Step | Command / link | Done when |
|------|----------------|-----------|
| API metrics enabled | `METRICS_ENABLED=true` on Fly | `npm run verify:metrics-scrape` → bearer **200** |
| Scrape token on Fly | `npm run setup:fly:metrics-token` | `/metrics` returns **401** without auth |
| Dashboard imported | `GRAFANA_SA_TOKEN=... npm run import:grafana-dashboard` | [FORGE API dashboard](https://forgesupport.grafana.net/d/forge-api/forge-api) loads |
| **Scrape job** | UI or Terraform below | Explore shows `forge_http_requests_total` |
| Rotate leaked tokens | Revoke any `glsa_` pasted in chat | New SA token only in secrets |

## Create scrape job (pick one)

### UI

1. [Metrics Endpoint connection](https://forgesupport.grafana.net/connections/datasources/metrics-endpoint) → **Create scrape job**
2. Name `forge-api`, URL `https://api.forgestudios.net/metrics`, interval `60s`, **Bearer** (token only)
3. `SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape` → paste token → **Test** → **Save**

### Terraform

See [infra/observability/terraform/README.md](../infra/observability/terraform/README.md).

Requires **Cloud access policy** token (`GRAFANA_CLOUD_ACCESS_POLICY_TOKEN`), not `glsa_`.

## Scripts

| NPM | Purpose |
|-----|---------|
| `npm run verify:metrics-scrape` | Prod `/metrics` auth check |
| `npm run configure:grafana-scrape` | Scrape job field values |
| `npm run import:grafana-dashboard` | Re-import dashboard |
| `npm run discover:grafana-cloud` | Stack + Connections API URLs |

Full observability notes: [OBSERVABILITY.md](./OBSERVABILITY.md).
