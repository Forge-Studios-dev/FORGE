# FORGE observability assets

Import into your Prometheus / Grafana stack. Requires `METRICS_ENABLED=true` on the API.

| File | Use |
|------|-----|
| `prometheus-scrape.example.yml` | Scrape `https://api.forgestudios.net/metrics` |
| `prometheus-alerts.yml` | Reference PromQL (see `grafana-alert-rules.json` for Cloud) |
| `grafana-alert-rules.json` | Grafana-managed alert rules (`npm run import:grafana-alerts`) |
| `grafana-dashboard-forge-api.json` | Grafana → Dashboards → Import |
| `grafana-cloud.md` | Step-by-step Grafana Cloud scrape + import |
| `terraform/` | Metrics Endpoint scrape job (Terraform; Cloud access policy token) |

**Metrics exposed**

- `forge_http_requests_total{method,status}`
- `forge_http_request_duration_seconds_bucket{method,status,le}`

**Docs:** [docs/OBSERVABILITY.md](../../docs/OBSERVABILITY.md)
