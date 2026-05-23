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

### UI (correct navigation)

**Do not open** `/connections/datasources/metrics-endpoint` — that URL is wrong and shows *Unknown datasource* (see Grafana docs: Metrics Endpoint is a **Connection integration**, not a datasource).

1. Open **[Connections](https://forgesupport.grafana.net/connections)** (left menu → **Connections**).
2. Search or browse for the **Metrics Endpoint** tile → click it.  
   Direct app URL (if listed): [Metrics Endpoint app](https://forgesupport.grafana.net/a/grafana-metricsendpoints-app)
3. On the integration page, add a **scrape job** (or open **Configuration** first, then create job).
4. Fill in:

   | Field | Value |
   |-------|--------|
   | Name | `forge-api` |
   | URL | `https://api.forgestudios.net/metrics` |
   | Interval | `60s` |
   | Auth | **Bearer** (paste token only — no `Bearer ` prefix) |

5. `SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape` → copy token → **Test connection** → **Save**.

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

## Scripts

| NPM | Purpose |
|-----|---------|
| `npm run verify:metrics-scrape` | Prod `/metrics` auth check |
| `npm run configure:grafana-scrape` | Scrape job field values |
| `npm run import:grafana-dashboard` | Re-import dashboard |
| `npm run discover:grafana-cloud` | Stack + Connections API URLs |

Full observability notes: [OBSERVABILITY.md](./OBSERVABILITY.md).
