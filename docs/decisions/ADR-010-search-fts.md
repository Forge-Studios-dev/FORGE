# ADR-010: Search — Postgres FTS first

**Status:** Accepted (2026-09-02)

## Context

Search uses Postgres FTS with filters. F-1302 defers Meilisearch until 500K videos or FTS p95 degrades.

## Decision

**Keep Postgres FTS.** Add Meilisearch sidecar only at F-1302 trigger. Course catalog search remains separate until P4 unified discovery.

## Consequences

- Monitor search p95 in production
- `scripts/` load tests validate FTS at scale before sidecar
