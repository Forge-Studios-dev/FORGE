# Phase 18 — Infrastructure & DevOps

**Status:** Documented; stack already production-shaped. This page is a thin summary — for the actual current risk picture (single-region SPOF, worker HA, branch-protection/CI findings) see [docs/operations/](../../operations/README.md) and [docs/audits/](../../audits/README.md), which are more detailed and more current than this doc.

## Known risks (not resolved, tracked in `docs/audits/`)

- Single-region deployment (Fly `bom` only) — no full-region failover procedure yet, but see [SCALE_MULTI_REGION.md](../../SCALE_MULTI_REGION.md) (2026-08-11) for the sequenced design
- Worker tier is a single machine (`--ha=false`) — accepted SPOF for all background job processing

## Fixed 2026-08-11

- Cache-stampede protection (jittered TTL / single-flight) on the two hottest read-through caches (video detail, search) — `common/redis/cache-stampede.util.ts`
- Continuous synthetic monitoring — `.github/workflows/synthetic-monitoring.yml`, 15-min public-mode smoke against production
- Distributed tracing was already fully built (`otel-bootstrap.ts` + OpenTelemetry SDK, documented in `OBSERVABILITY.md`) — an earlier audit pass incorrectly listed it as missing; it only needs `OTEL_EXPORTER_OTLP_ENDPOINT` set to activate (ops decision, not a code gap)

## Verified

- Fly API + Vercel web/admin ship gates (`forge-ship`)
- BullMQ workers module, health checks
- Queues module centralization (Phase 02)
- Neon Postgres + Redis

## Ops note

- Prefer batch merges to `main`; run migrations in release
- Apply `1870000000000-video-caption-url` before caption-dependent deploys
