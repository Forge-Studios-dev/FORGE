# Monitoring Architecture

## Unified strategy

| Surface | Tool | Notes |
|---------|------|-------|
| API errors | Sentry (`@sentry/nestjs`) | Existing |
| Web errors | `@sentry/nextjs` | Added |
| Admin errors | `@sentry/nextjs` | Added |
| API metrics | Prometheus `forge_http_*` | `METRICS_ENABLED=true` |
| API traces | OpenTelemetry OTLP | Optional |
| Mobile errors | Sentry Flutter (recommended) | Not Crashlytics by default |
| API | **No Crashlytics** | Server stack traces via Sentry |

## Auth failures

- Structured logs in `AuthService`
- Optional metric: `forge_auth_failures_total` (future)

## Performance

| Tier | Tool |
|------|------|
| API p95 | Prometheus + OTel |
| Web LCP | Sentry transactions / Vercel Speed Insights |
| Search | Log duration in `SearchService` |
| Video startup | `watch.startup_ms` analytics event |
| Flutter | Firebase Performance optional post-PMF |

## Env (web/admin)

```bash
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=          # CI source maps
SENTRY_ORG=
SENTRY_PROJECT=
```

See [OBSERVABILITY.md](../OBSERVABILITY.md) for API metrics and health checks.
