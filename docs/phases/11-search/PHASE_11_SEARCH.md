# Phase 11 — Search Platform

**Status:** Complete for filter parity slice. Corrected 2026-08-09 — playlist search and date/duration filters were listed below as Deferred but are shipped; see `docs/PLATFORM_AUDIT_2026-08-09.md §2.5`.

## Goal

YouTube-like search filters over the existing Postgres FTS index.

## Shipped

- `GET /search?type=all|video|channel|playlist` (default `all`)
- Duration buckets (`any|short|medium|long`) and upload-date filter (`apps/api/src/modules/search/search.controller.ts`, `search.service.ts`)
- Cache key bumped to `search:v2` including type
- Web search chips: All / Videos / Channels
- Results section label: Channels (was Creators)

## Shipped 2026-08-11

- Transcript/caption search: primary caption track's WebVTT is fetched (reusing the existing SSRF-safe fetch path), stripped to plain text (`webvtt.util.ts`), and folded into `videos.search_vector` at weight D (migration `2050000000000-video-caption-text-search.ts`). Best-effort — a fetch failure never blocks setting the caption URL.
- Playlist search now ranked by `ts_rank_cd` over a real `search_vector` column (migration `2060000000000-playlist-search-vector.ts`), not `ILIKE` + `updatedAt DESC`. Falls back to the old ILIKE query if FTS errors, same resilience pattern as video/user search.

## Deferred

- Typo-tolerant suggest beyond title prefix
- Multi-language caption indexing (only the primary/default track is indexed today)

See [PHASE_11_REPORT.md](./PHASE_11_REPORT.md).
