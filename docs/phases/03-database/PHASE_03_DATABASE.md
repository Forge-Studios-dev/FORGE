# Phase 03 — Database (updated after apply)

**Status:** Closed — Neon caught up through migration **197**.

## Applied (2026-08-04)

`npm run migration:run` in `apps/api` against configured `DATABASE_URL`:

185 YoutubeReplicaWave1 → 197 WatchHistoryIndexCleanup

## Fix

`186` discoverable index uses `published_at DESC NULLS LAST` (no `COALESCE(timestamptz)` — non-IMMUTABLE on PG17/Neon).
