# FORGE Observability

## Logging

- **nestjs-pino** with JSON in production, pretty in dev
- **Correlation ID:** `x-correlation-id` on every HTTP response
- **Trace ID:** W3C `traceparent` header parsed into logs as `traceId` when present

## Metrics (Prometheus)

Enable on the API:

```bash
METRICS_ENABLED=true
```

Scrape `GET /metrics` (not under `/api/v1`).

| Metric | Description |
|--------|-------------|
| `forge_http_requests_total` | Counter by method + status |
| `forge_http_request_duration_seconds` | Histogram by method + status |
| Default Node/process metrics | via `prom-client` collectDefaultMetrics |

## Error tracking (Sentry)

```bash
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Loaded from `apps/api/src/instrument.ts` before Nest boots.

## Distributed tracing (OpenTelemetry)

Optional — only starts when:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector:4318
OTEL_SERVICE_NAME=forge-api
```

Uses OTLP HTTP (`/v1/traces`). Compatible with Grafana Tempo, Jaeger OTLP, Datadog agent.

## Health

`GET /api/v1/health` — database, Redis, BullMQ `video-processing` job counts.

## Production smoke

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
```

## E2E (web)

```bash
# Public routes only (CI default)
cd apps/web && npm run test:e2e

# With demo/staging user
E2E_TEST_EMAIL=viewer@forge.local E2E_TEST_PASSWORD=ForgeDemo123! npm run test:e2e
```

Set GitHub secrets `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` to enable authenticated tests in CI.

## Grafana / Prometheus (as code)

Starter assets in [`infra/observability/`](../infra/observability/):

| File | Purpose |
|------|---------|
| `prometheus-scrape.example.yml` | Scrape `GET /metrics` on the API |
| `prometheus-alerts.yml` | Error rate + latency alerts |
| `grafana-dashboard-forge-api.json` | Import into Grafana (Dashboards → Import) |
| `grafana-cloud.md` | Grafana Cloud scrape + dashboard import |

Requires `METRICS_ENABLED=true` on the API (enabled on production Fly API).

**Grafana Cloud:** [infra/observability/grafana-cloud.md](../infra/observability/grafana-cloud.md).

## Feature flags (large uploads)

Multipart S3 uploads (≥50MB) require:

```bash
FEATURE_FLAGS=multipart_upload   # Fly: fly secrets set -a forge-studios-api
```

Web merges flags from `GET /api/v1/platform/config` — no extra Vercel env needed.
