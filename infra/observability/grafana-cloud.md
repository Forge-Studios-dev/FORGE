# Grafana Cloud — FORGE API metrics

Production API exposes Prometheus metrics at `https://api.forgestudios.net/metrics` when `METRICS_ENABLED=true` (already set on Fly).

## 1. Create a Grafana Cloud stack

1. [grafana.com](https://grafana.com/) → **Grafana Cloud** → free tier stack.
2. Note your **Prometheus remote write URL** and **username** (instance ID).
3. Create an **API key** with *MetricsPublisher* (or use a Prometheus scrape integration).

## 2. Scrape from Grafana Cloud (recommended)

Grafana Cloud → **Connections** → **Metrics Endpoint** → **Create scrape job** ([docs](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-metrics-endpoint/)).

| Field | Value |
|-------|--------|
| Name | `forge-api` |
| URL | `https://api.forgestudios.net/metrics` |
| Interval | `30s` |
| Auth | **Bearer** (token only — no `Bearer ` prefix) |

Grafana Cloud **requires** the metrics URL to be authenticated. On the API:

```bash
fly secrets set METRICS_SCRAPE_TOKEN='<random-hex>' -a forge-studios-api
```

Deploy the API after `METRICS_SCRAPE_TOKEN` support is on `main`, then use the same value in the scrape job. Test in Grafana before saving.

Within a few minutes, query `forge_http_requests_total` in **Explore** (datasource `grafanacloud-forgesupport-prom`).

Legacy self-hosted scrape YAML (not used for Grafana Cloud Metrics Endpoint): `prometheus-scrape.example.yml`.

## 3. Import dashboard and alerts

1. **Dashboards** → **Import** → upload `grafana-dashboard-forge-api.json`.
2. **Alerting** → **Alert rules** → import or recreate from `prometheus-alerts.yml` (error rate, p95 latency).

## 4. Fly.io alternative

Fly offers [managed Prometheus](https://fly.io/docs/reference/metrics/) per app. Point it at `forge-studios-api` or scrape the public `/metrics` URL if your security model allows it.

## 5. Verify

```bash
curl -sS https://api.forgestudios.net/metrics | head -5
FORGE_SMOKE_MODE=public npm run smoke:api:prod   # includes /metrics check
```

See also [docs/OBSERVABILITY.md](../../docs/OBSERVABILITY.md).
