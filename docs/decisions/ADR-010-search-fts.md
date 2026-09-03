# ADR-010: Search — Postgres FTS first

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

Search uses Postgres `tsvector` / `plainto_tsquery` / `ts_rank_cd` for videos, channels, playlists. Courses go through `CoursesService.discoverCourses` (not FTS). F-1302 deferred Meilisearch.

## Research

- YouTube search is a dedicated retrieval stack (not Postgres). That is justified at hundreds of millions of docs.
- Postgres FTS + GIN is the standard MVP through mid-scale (hundreds of thousands of videos) if indexes exist and p95 is watched.
- Meilisearch/Typesense add ops (another cluster, sync, ranking drift) before the corpus hurts.

## Alternatives considered

| Option | Why not now |
|--------|-------------|
| Meilisearch sidecar immediately | F-1302 trigger: ~500K videos **or** search p95 regression. |
| Elasticsearch | Heavier than Meili; same premature ops. |

## Decision

**Keep Postgres FTS** as the search engine. Add Meilisearch only at F-1302. Course hits stay on the courses discover API until a course `search_vector` is justified by catalog size.

Harden in-repo: typo/suggest already exist; keep filter parity (duration, captions, kind, watched); do not unbounded-scan.

## Code evidence

- `apps/api/src/modules/search/search.service.ts`
- GIN indexes on videos/users/playlists

## Consequences

- Load-test search on staging before marketing spikes (`npm run load-test:feed`).
- Monitor search p95 in Grafana.
