# Grafana Cloud — Metrics Endpoint scrape job (Terraform)

Creates the `forge-api` scrape job pulling `https://api.forgestudios.net/metrics` into Grafana Cloud Prometheus.

## Prerequisites

1. Fly API: `METRICS_ENABLED=true` and `METRICS_SCRAPE_TOKEN` (`npm run setup:fly:metrics-token`).
2. **Grafana Cloud access policy token** (not a `glsa_` service account token).
   - Stack → **Administration** → **Cloud access policies** → create token with Connections / Metrics Endpoint permissions.
3. Bearer scrape token = same value as Fly `METRICS_SCRAPE_TOKEN`.

## Discover stack URLs (optional)

```bash
export GRAFANA_CLOUD_ACCESS_POLICY_TOKEN='...'
npm run discover:grafana-cloud
```

## Apply

```bash
cd infra/observability/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in — never commit
terraform init
terraform plan
terraform apply
```

One-liner token from Fly:

```bash
export TF_VAR_metrics_scrape_token="$(fly ssh console -a forge-studios-api -C 'printenv METRICS_SCRAPE_TOKEN' 2>/dev/null | tail -1)"
export TF_VAR_grafana_cloud_access_policy_token='...'
terraform apply
```

## UI alternative

```bash
SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape
```

## Verify

```bash
npm run verify:metrics-scrape
```

In Grafana **Explore** → `grafanacloud-forgesupport-prom` → `forge_http_requests_total`.

Dashboard: https://forgesupport.grafana.net/d/forge-api/forge-api
