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

Optional bearer protection for production scrapers:

```bash
METRICS_SCRAPE_TOKEN=your-long-random-token
```

When set, scrapers must send `Authorization: Bearer <token>`. Leave unset for open scrape (current production default).

| Metric | Description |
|--------|-------------|
| `forge_http_requests_total` | Counter by method + status |
| `forge_http_request_duration_seconds` | Histogram by method + status |
| `forge_bullmq_jobs_waiting` | Gauge by queue name (refreshed on each `/metrics` scrape) |
| `forge_bullmq_jobs_active` | Gauge by queue name |
| `forge_bullmq_jobs_delayed` | Gauge by queue name |
| `forge_bullmq_jobs_failed` | Gauge by queue name |
| Default Node/process metrics | via `prom-client` collectDefaultMetrics |

Queues exported when registered: `mux-vod-ingest`, `analytics-ingest`, `analytics-retention`, `push-dispatch`, `subscription-maintenance`, and `video-processing` when present.

### Analytics retention (F-504)

Daily job on the Fly worker deletes `analytics_events` older than `ANALYTICS_RETENTION_DAYS` (default **90**). Set `ANALYTICS_RETENTION_DAYS=0` or `DISABLE_ANALYTICS_RETENTION=true` to disable.

### BullMQ alerts (F-903)

Import rules from [infra/observability/prometheus-alerts.yml](../infra/observability/prometheus-alerts.yml):

- `ForgeMuxVodQueueBacklog` — `forge_bullmq_jobs_waiting{queue="mux-vod-ingest"} > 100` for 10m
- `ForgeAnalyticsIngestQueueBacklog` — `analytics-ingest` waiting > 5000 for 15m

```bash
bash scripts/import-grafana-alerts.sh   # after updating grafana-alert-rules.json if needed
```

## Client error tracking (Sentry)

Web and admin use `@sentry/nextjs` when `NEXT_PUBLIC_SENTRY_DSN` is set.

## Error tracking (Sentry) — API

```bash
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_SEND_DEFAULT_PII=false  # production default (F-803); omit or false to avoid sending PII
```

Loaded from `apps/api/src/instrument.ts` before Nest boots. Production:

```bash
SENTRY_DSN='https://...' bash scripts/set-sentry-secrets-fly.sh
```

If production was previously configured with `SENTRY_SEND_DEFAULT_PII=true`, run a one-time update:

```bash
fly secrets set SENTRY_SEND_DEFAULT_PII=false --app forge-studios-api
fly secrets set SENTRY_SEND_DEFAULT_PII=false --app forge-studios-worker
```

Web/admin: set `NEXT_PUBLIC_SENTRY_DSN` (same DSN) on Vercel (`NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII=false`):

```bash
SENTRY_DSN='https://...' bash scripts/set-sentry-vercel-env.sh
bash scripts/vercel-setup.sh   # redeploy to pick up env
```

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

**Grafana Cloud:** [infra/observability/grafana-cloud.md](../infra/observability/grafana-cloud.md)

### Grafana quick setup

1. `METRICS_ENABLED=true` + `npm run setup:fly:metrics-token` on Fly API
2. Connections → **Metrics Endpoint** → scrape `https://api.forgestudios.net/metrics` (60s, Bearer token)
3. `npm run import:grafana-dashboard` · `npm run verify:grafana-metrics`

## Feature flags (large uploads)

Multipart S3 uploads (≥50MB) require:

```bash
FEATURE_FLAGS=multipart_upload   # Fly: fly secrets set -a forge-studios-api
```

Web merges flags from `GET /api/v1/platform/config` — no extra Vercel env needed.
