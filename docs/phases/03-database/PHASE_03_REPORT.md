# Phase 03 — Report (2026-08-04 · migrations applied)

**Completion:** ~100%  
**Readiness:** 9 / 10  
**Recommendation:** Closed. Continue Phase 05+.

## Applied to Neon (via local `apps/api` TypeORM)

185 → 197 inclusive, including:
- YouTube wave (reactions, system playlists, captions, notify_level, Super Thanks, pin/heart, channel links, unlisted, history pause)
- Hot-path indexes (`IDX_videos_discoverable_sort` without non-immutable COALESCE)
- Watch-history index cleanup (drop duplicate `*_watched_at`)

## Fix shipped in repo

`186…phase-03-hot-path-indexes.ts` no longer uses `COALESCE(timestamptz)` (PG rejects as non-IMMUTABLE). Uses `published_at DESC NULLS LAST` under discoverable WHERE clause.

## Verify

`migration:show` should list all through `WatchHistoryIndexCleanup197…` as `[X]`.
