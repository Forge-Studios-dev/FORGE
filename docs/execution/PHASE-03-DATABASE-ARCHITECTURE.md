# Phase 03 — Database Architecture Audit & Implementation

**Status:** Audit complete, scoped implementation complete, phase report below.
**Date:** 2026-08-23
**Scope:** Postgres/TypeORM schema — migration history (113 files), entity/index design, N+1 query risk, soft-delete consistency, connection pooling.
**Method:** Fresh code-level audit, evidence-based, **empirically verified against a real from-scratch Postgres bootstrap** (not just static analysis — see §2).

---

## 1. Existing State

113 migrations at `apps/api/src/database/migrations`, timestamp range 1714950000000–2180000000000 (before this phase's additions). `synchronize: false` in production; schema is migration-driven only.

---

## 2. Problems Found

### Migration history — a real fresh-bootstrap bug, found and fixed by actually running it

The initial audit flagged a "Critical" migration-ordering bug: `1778065236275-InitialSchema.ts`'s **filename** sorts alphabetically after many later migrations, seemingly meaning a fresh database would try to run migrations that depend on tables InitialSchema hasn't created yet.

**This was verified false.** TypeORM's `MigrationExecutor.getMigrations()` (`node_modules/typeorm/migration/MigrationExecutor.js:427-438`) sorts migrations by parsing the **last 13 digits of the migration class's `name` property** — filenames are irrelevant to execution order, only used for the initial glob-load. `InitialSchema`'s class name is `InitialSchema1714960000000`, which sorts correctly (second migration, right after `1714950000000`). Confirmed by reading the class name directly and cross-checking against TypeORM's own sort implementation.

**What actually breaks a fresh bootstrap, found by running `migration:run` against a genuinely empty local Postgres:**

- **Critical (confirmed via live test, fixed):** No migration ever creates the `uuid-ossp` Postgres extension, but every migration from InitialSchema onward uses `uuid_generate_v4()` as a column default. A fresh database fails immediately with `function uuid_generate_v4() does not exist`. The extension must have been enabled out-of-band on the real Neon database at some point outside migration history — a comment in `typeorm-shared-options.ts:22` incorrectly claims "uuid-ossp is created by migrations." **This is very likely why the staging environment mentioned in `docs/operations/STAGING.md` was never successfully provisioned** — anyone following that doc's own instructions to run migrations against a fresh Neon branch would hit this exact wall.
- **High (confirmed via grep, fixed):** A dead, orphaned duplicate table `admin_audit_logs` (plural, `1780000000002-admin-audit-log.ts`) coexists with the real `admin_audit_log` (singular, `2140000000000-admin-audit-log.ts`) — incompatible schemas, only the singular has a TypeORM entity, zero code references the plural one anywhere in the repo.
- Idempotency/reversibility otherwise solid: all sampled migrations use `IF NOT EXISTS`/`IF EXISTS` guards; `down()` methods correctly reverse `up()`; the one `SET NOT NULL` found is correctly preceded by a backfill; two early UUID-fix migrations are honestly documented as non-reversible (acceptable for early-schema fixups).

### Entity/index design

- **Medium-High (confirmed, fixed):** `notifications.user_id` had no foreign key to `users` at all — a bare column, unlike every other user-owned table sampled (Video, Comment, Stream, MemberSubscription, WatchHistory, StreamMessage all declare explicit `onDelete`). Deleting a user left their notifications orphaned forever with zero referential integrity.
- Cascade behavior is otherwise consistent (explicit `CASCADE`/`SET NULL` on every other sampled relation, no bare defaults).
- Video/Stream hot-path indexes exist but are added via raw migration SQL rather than entity `@Index` decorators — functionally fine (`synchronize: false` means entities don't drive schema), but means auditing indexes from entity files alone under-documents the real index set. Not fixed this pass — documentation/convention issue, not a bug.

### Soft-delete consistency

- **High (confirmed, partially fixed):** Video deletion is a hard delete (`videos.service.ts` → `videoRepository.remove()`), and `copyright_notices.video_id` was `ON DELETE CASCADE` — deleting a video destroyed any DMCA notice/counter-notice history tied to it, undermining the legally-defensible audit trail the copyright module exists for. **Fixed**: changed to `ON DELETE SET NULL` — the notice record (claimant info, statements, signature) now survives; only the video link is cleared.
- **Medium (confirmed, partially fixed):** User soft-delete (`deletedAt`/`isActive`) is enforced inconsistently across query paths — `auth.service.ts` correctly checks it before login/refresh, but general-purpose lookups (`findById`, `findByUsername`) don't filter it at all, and `searchUsersForPicker` (mention autocomplete) let deleted/deactivated users surface in new @mentions. **Fixed the clearly-wrong case** (`searchUsersForPicker`); left `findById`/`findByUsername` untouched — deliberately, see §3.

### N+1 query patterns

No Critical/High findings. Feed/engagement code is deliberately batched (`engagement.service.ts`'s `getViewerVideoReactions`, `notifications.service.ts`'s chunked bulk insert, `push-dispatch.service.ts`'s `In()` lookups). The only per-item-await loops found are in bounded one-off admin flows, not list/feed endpoints.

### Connection pooling & observability

Solid, no action needed. `parse-database-config.ts` correctly sizes the pool for Neon's pooler model (`poolMax: 5` for Neon vs. 20 direct), hard-fails production boot if `DATABASE_URL` isn't the pooler endpoint (prevents double-pooling/exhaustion), and `idleTimeoutMs` is deliberately tuned against a cited cost audit. `database-observability.service.ts`'s `pg_stat_statements` integration is reasonable.

---

## 3. Recommended Architecture / Fixes

Same principle as Phases 01–02: ship what's mechanically safe and empirically verified; defer anything needing a product/UX decision.

**Deliberately not touched — `findById`/`findByUsername` soft-delete filtering:** these are used pervasively (video ownership checks, channel pages, comment authorship) where filtering out a deleted user could be *wrong* depending on intent — e.g., a video's `creator` relation probably should still resolve even if the creator later deleted their account (matching how YouTube shows "This channel has been deleted" rather than erasing all trace of past uploads). Blindly adding a filter to a broadly-used lookup risks breaking flows that need the opposite behavior. This needs a per-call-site product decision (what should visiting a deleted user's profile actually show?), not a mechanical fix — captured in the roadmap.

---

## 4. Roadmap

| Task | Priority | Effort | Risk | Notes |
|---|---|---|---|---|
| Decide + implement consistent deleted-user display behavior across `findById`/`findByUsername` call sites | P2 | M | Medium | Product decision needed first (hide entirely vs. "deleted account" placeholder, YouTube/Reddit-style) |
| Document the real hot-path index set (raw-SQL migrations) alongside entity files | P3 | S | Low | Documentation only, no functional risk |
| Consider soft-delete for Video (vs. hard delete) if more cascade-sensitive tables get added later | P3 | L | Medium | Only worth it if another compliance-sensitive table starts referencing videos; not urgent today now that copyright_notices is fixed |

---

## 5. Acceptance Criteria (this pass)

- [x] A genuinely fresh database can bootstrap via `migration:run` alone, verified end-to-end (not just read — actually run against an empty local Postgres).
- [x] The orphaned duplicate `admin_audit_logs` table is removed.
- [x] `notifications` has real referential integrity to `users` (orphan rows cleaned, FK added).
- [x] Copyright/DMCA records survive video deletion.
- [x] Deleted/deactivated users no longer surface in mention autocomplete.
- [x] All 3 new migrations' `down()` methods verified to actually reverse `up()` (not just written — executed).
- [x] No regressions: lint/build clean, all touched-area tests green.

---

## 6. Implementation Log

| Fix | Files |
|---|---|
| `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` — new early migration (timestamp before InitialSchema) | `database/migrations/1714950000000-enable-uuid-ossp.ts` |
| Dropped confirmed-orphaned `admin_audit_logs` (plural) table | `database/migrations/2230000000000-drop-orphaned-admin-audit-logs-plural.ts` |
| Cleaned orphaned rows, added `notifications.user_id` → `users.id` FK (`ON DELETE CASCADE`) | `database/migrations/2220000000000-notifications-user-fk.ts` |
| Changed `copyright_notices.video_id` from `NOT NULL ON DELETE CASCADE` to nullable `ON DELETE SET NULL`; updated entity types; added a null-guard in the one call site that writes through `notice.videoId` | `database/migrations/2210000000000-copyright-notices-preserve-on-video-delete.ts`, `modules/copyright/entities/copyright-notice.entity.ts`, `modules/copyright/copyright.service.ts` |
| `searchUsersForPicker` now excludes `isActive: false` / soft-deleted users; also fixed its pagination-clamping bypass while touching the same lines (Phase 02 pattern) | `modules/users/users.service.ts` |
| New tests: null-videoId reinstatement path, deleted-user exclusion from mention search | `modules/copyright/copyright.service.spec.ts`, `modules/users/users.service.spec.ts` |

**Validation:** every schema-level fix was proven by actually running it — spun up a fresh, empty local Postgres (docker, separate from the dev-persistent one), ran `migration:run` from zero to confirm the `uuid-ossp` bug and fix it, then ran the 3 new migrations end-to-end (117 total, exit 0, "No migrations are pending" on re-run confirming idempotent tracking), then reverted and re-applied all 3 `down()` methods individually to confirm real reversibility, then queried the resulting schema directly (`\d` on each affected table) to confirm the exact FK/nullability changes landed as intended. Separately: `eslint --max-warnings 0` clean, `nest build` clean, targeted test run (copyright + users + notifications): 33 tests, 100% pass, including 2 new test cases.

---

## 7. Deferred / Backlog

The deleted-user-display product decision and the hot-path-index documentation gap are captured in the roadmap above, not dropped.
