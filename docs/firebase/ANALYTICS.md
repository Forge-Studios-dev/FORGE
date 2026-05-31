# Analytics Architecture

## Primary pipeline

`POST /api/v1/analytics/events` → BullMQ `analytics-ingest` → `analytics_events` table.

**Firebase Analytics is not used** for web product analytics.

## Allowlisted events

Defined in `@forge/shared-types` (`ANALYTICS_EVENTS`) and enforced server-side.

| Event | Source | Properties |
|-------|--------|------------|
| `auth.signup` | API | `method` |
| `auth.login` | API | `method` |
| `watch.progress` | Web/mobile player | `videoId`, `positionSec` |
| `watch.complete` | Web/mobile player | `videoId`, `durationSec` |
| `search.query` | Web (client) | `resultCount` (no raw query text) |
| `navigation.page` | Web (10% sample) | `path` |
| `watch.startup_ms` | Web watch page | `videoId`, `ms` |

## Anti-spam

- Throttle: 120 req/min per IP (controller)
- Allowlist validation on `eventName`
- Max properties JSON size 4KB
- Optional App Check header on public ingest

## Client wiring

- Web: `apps/web/src/lib/analytics.ts`
- Mobile: `apps/mobile/lib/core/analytics/forge_analytics.dart`

## Warehouse path (post-PMF)

Export `analytics_events` to BigQuery/Snowflake or add PostHog — not Firebase Analytics.
