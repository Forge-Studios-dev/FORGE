# ADR-013: Cost-first Fly topology

**Status:** Accepted (2026-09-03)  
**Supersedes:** implied HA claims in older `DEPLOY.md` (2 always-on API machines)

## Context

`fly.toml` (2026-09-01 cost pass): **1** API machine, `auto_stop_machines=stop`, rolling deploys, `sin` only. Worker: `--ha=false` (single machine). `SCALE_*` docs are **proposed**, not implemented.

## Research

- YouTube-scale HA is multi-region + always-on + dedicated transcode. FORGE traffic and Mux already absorb media; API is a control plane.
- Cold starts (~20s) and rolling blips are acceptable for current MAU; they are **not** acceptable for a marketed 100K concurrent live event (`SCALE_LIVE.md` remains proposed).

## Alternatives considered

| Option | Why not now |
|--------|-------------|
| Restore min=2 always-on | Cost; reverse only when SLO/cold-start or live concurrency requires it (`FLY_SLO.md`). |
| Multi-region | `SCALE_MULTI_REGION.md` proposed; Neon+Redis+Mux are single-primary today. |

## Decision

**Keep cost-first single-region topology** as the production default. Document it honestly. Scale triggers:

| Trigger | Action |
|---------|--------|
| Auth/live p95 / cold starts unacceptable | `min_machines_running=2`, `auto_stop=false` |
| BullMQ backlog / worker downtime hurting ingest | Second worker **after** idempotency review |
| 100K concurrent live or multi-region RTO | Execute SCALE_* designs, not before |

## Code evidence

- `fly.toml`, `fly.worker.toml`, `docs/operations/FLY_SLO.md`

## Consequences

- `DEPLOY.md` must match `fly.toml`, not Wave-6 HA prose.
- Worker SPOF is **accepted** (jobs durable in Redis).
