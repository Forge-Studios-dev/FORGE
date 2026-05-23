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

### Terraform / API script

See [infra/observability/terraform/README.md](../infra/observability/terraform/README.md).

Requires **Cloud access policy** token (`glc_…`), not `glsa_`.

**Access policy scopes:** your `forge_setup` token has metrics read/write but **cannot list stacks** via Cloud API. For Terraform/API automation, add **`stacks:read`** (or use the UI below). Find **Stack ID** in Grafana Cloud → your stack → **Administration** → **Stack details** (numeric id, not the Prometheus `basicAuthUser`).

```bash
export GRAFANA_CLOUD_ACCESS_POLICY_TOKEN='glc_...'
export GRAFANA_STACK_ID='<stack-id-from-portal>'
export GRAFANA_CONNECTIONS_CLUSTER='prod-ap-south-1'
npm run create:grafana-scrape-job
```

### UI (works with current token — recommended)

1. [Metrics Endpoint](https://forgesupport.grafana.net/connections/datasources/metrics-endpoint) → **Create scrape job**
2. Name `forge-api`, URL `https://api.forgestudios.net/metrics`, interval `60s`, **Bearer**
3. `SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape` → paste token (no `Bearer ` prefix) → **Test** → **Save**

## Scripts

| NPM | Purpose |
|-----|---------|
| `npm run verify:metrics-scrape` | Prod `/metrics` auth check |
| `npm run configure:grafana-scrape` | Scrape job field values |
| `npm run import:grafana-dashboard` | Re-import dashboard |
| `npm run discover:grafana-cloud` | Stack + Connections API URLs |

Full observability notes: [OBSERVABILITY.md](./OBSERVABILITY.md).
