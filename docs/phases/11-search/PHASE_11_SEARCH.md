# Phase 11 — Search Platform

**Status:** Complete for filter parity slice

## Goal

YouTube-like search filters over the existing Postgres FTS index.

## Shipped

- `GET /search?type=all|video|channel` (default `all`)
- Cache key bumped to `search:v2` including type
- Web search chips: All / Videos / Channels
- Results section label: Channels (was Creators)

## Deferred

- Playlist search index
- Date / duration / upload filters
- Typo-tolerant suggest beyond title prefix

See [PHASE_11_REPORT.md](./PHASE_11_REPORT.md).
