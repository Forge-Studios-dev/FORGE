# Grafana Cloud — Metrics Endpoint scrape job (Terraform)

Creates the `forge-api` scrape job that pulls `https://api.forgestudios.net/metrics` into Grafana Cloud Prometheus.

## Prerequisites

1. API has `METRICS_ENABLED=true` and `METRICS_SCRAPE_TOKEN` set on Fly (`npm run setup:fly:metrics-token`).
2. **Grafana Cloud Access Policy** token with Connections / Metrics Endpoint scopes (not the same as a Grafana `glsa_` service account token).
   - Portal → your stack → **Administration** → **Cloud access policies** → create policy → add token.
   - Copy the token once; use as `connections_api_access_token`.
3. **Connections API URL** for your stack (from Grafana Cloud → Connections → Metrics Endpoint → Terraform/docs link), e.g.  
   `https://connections-api-prod-us-east-0.grafana.net/connections`

## Apply

```bash
cd infra/observability/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in — never commit
terraform init
terraform plan
terraform apply
```

Or pass via env:

```bash
export TF_VAR_connections_api_access_token='...'
export TF_VAR_metrics_scrape_token="$(fly ssh console -a forge-studios-api -C 'printenv METRICS_SCRAPE_TOKEN' 2>/dev/null | tail -1)"
terraform apply
```

## UI alternative

```bash
npm run configure:grafana-scrape
```
