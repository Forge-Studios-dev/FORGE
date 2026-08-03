# Phase 18 — Infrastructure & DevOps

**Status:** Documented; stack already production-shaped

## Verified

- Fly API + Vercel web/admin ship gates (`forge-ship`)
- BullMQ workers module, health checks
- Queues module centralization (Phase 02)
- Neon Postgres + Redis

## Ops note

- Prefer batch merges to `main`; run migrations in release
- Apply `1870000000000-video-caption-url` before caption-dependent deploys
