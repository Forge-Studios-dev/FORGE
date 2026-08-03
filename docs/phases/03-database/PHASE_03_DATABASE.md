# Phase 03 — Database Architecture (Fresh Verification)

**Status:** Complete (verified post Phase 01/02)  
**Stack:** TypeORM + Postgres, `synchronize: false`, migration-driven

---

## Fresh audit (2026-08-03)

### Already shipped (retain)

| Item | Evidence |
| --- | --- |
| Discoverable feed partial index | Migration `186…` `IDX_videos_discoverable_sort` |
| Likes playlist index | `IDX_likes_user_reaction_created` + Like entity `@Index` |
| Watch history video anti-join | `IDX_watch_history_video_id` |
| Top-level comments | `IDX_comments_video_top_level` |
| Drop duplicate watch_history index | `186` down recreates if rolled back |

### YouTube-replica schema waves (187–196)

| Migration | Purpose | Index posture |
| --- | --- | --- |
| 187 caption_url | Video captions | Column only |
| 188 notify_level | Follow bell | Covered by `followingId` index for fanout |
| 189–192 Super Thanks | Ledger + fees | Entity `@Index(creatorId,createdAt)`, `(videoId,createdAt)` |
| 193 watch_history_paused | User privacy | Boolean on users |
| 194 pin / creator heart | Comments | Existing video+created indexes |
| 195 channel_links | JSONB profile | No list query hotspot |
| 196 playlist unlisted | Visibility enum | `userId` index sufficient for owner lists |

### No new Critical/High index gaps found

Notify fanout loads by `followingId` (indexed). Super Thanks studio list uses `creatorId, createdAt` (indexed). Unlisted playlists are link-access / owner-scoped.

---

## Explicit non-goals / deferred

- Soft-delete → `@DeleteDateColumn` standardization
- Partitioning / sharding
- Renaming `skill_tags` tables/columns (data contract phase)
- Unloading LMS tables (opt-in flag may still need schema)

---

## Ops

- Prod: `MIGRATIONS_RUN=false`; release job applies migrations
- Prefer Neon pooler URL
- Ensure `186…` applied before expecting feed plan improvements

---

## Acceptance

- [x] Hot-path indexes exist in migrations + entities
- [x] Post–YouTube-wave schema reviewed for missing indexes
- [x] No irreversible schema rename in this phase
- [x] Report filed → Phase 04

**Readiness:** 9 / 10  
**Next:** Phase 04 — Navigation & Routing
