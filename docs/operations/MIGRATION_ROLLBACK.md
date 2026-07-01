# Database migration rollback runbook

**Tracker:** CEOS-P16-T028 · **Audience:** Engineering / DevOps  
**Related:** [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) · [DEPLOY.md](../DEPLOY.md) · [STAGING.md](./STAGING.md)

How to safely roll back a TypeORM migration in FORGE. Every migration in `apps/api/src/database/migrations/` ships a paired `down()`, so logical revert is always available; this runbook covers when to use `migration:revert` vs PITR restore.

---

## How migrations apply in production

- Applied automatically on deploy via `fly.toml` `release_command`:
  ```
  node node_modules/typeorm/cli.js migration:run -d apps/api/dist/apps/api/src/database/data-source.js
  ```
- The release VM runs `migration:run` **before** app machines roll. A failing migration **aborts the deploy** (no traffic shift), so most bad migrations never reach users.

---

## Decision matrix

| Situation | Action |
|-----------|--------|
| Migration failed mid-deploy (release_command error) | Fix forward or `migration:revert`; deploy aborted, old release still serving |
| Migration applied, app code broken | **App rollback first** (`fly releases rollback`), then assess if schema revert needed |
| Additive change (new table/column/index) | `migration:revert` is safe — no data loss |
| Destructive change (drop column/table, type change) | **Do not** blind-revert; prefer Neon PITR branch (see below) |
| Data backfill migration | Revert only if `down()` restores prior state; otherwise PITR |

> **Rule:** application rollback is cheap and reversible; schema rollback is not. Always roll back the app first, confirm whether the schema is actually incompatible, and only then revert DB.

---

## A. Logical revert (additive / reversible migrations)

Reverts exactly one migration (the most recently applied):

```bash
cd apps/api

# Inspect what will be reverted
npm run build
node node_modules/typeorm/cli.js migration:show -d dist/apps/api/src/database/data-source.js

# Revert the latest migration
npm run migration:revert
```

For Fly (run against production DB via a one-off machine, never local laptop creds):

```bash
fly ssh console -a forge-studios-api -C \
  "node node_modules/typeorm/cli.js migration:revert -d apps/api/dist/apps/api/src/database/data-source.js"
```

Repeat `migration:revert` once per migration to unwind multiple (it only steps back one at a time).

**Verify after revert:**

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
```

---

## B. PITR restore (destructive migrations / data loss risk)

When a migration dropped data or `down()` cannot restore it, use Neon point-in-time recovery instead of `migration:revert`:

1. Neon console → create a branch from the timestamp **just before** the deploy.
2. Point a **staging** Fly app `DATABASE_URL` at the branch; validate with `smoke-api.sh`.
3. Promote: cut over production `DATABASE_URL` to the validated branch (or copy data back), then redeploy the matching app release.
4. Delete the temporary branch after validation.

See [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for RPO/RTO targets and Neon specifics.

---

## C. Pre-deploy safeguards (author checklist)

Before merging a migration:

- [ ] `up()` and `down()` both implemented and symmetric
- [ ] Additive-first: add columns nullable / with defaults; backfill; tighten constraints in a later migration
- [ ] Avoid destructive ops (DROP COLUMN/TABLE) in the same release as the code that stops using them — split across two releases (expand → contract)
- [ ] Large tables: create indexes `CONCURRENTLY` where possible; avoid long table locks
- [ ] Tested locally: `npm run migration:run` then `npm run migration:revert` round-trips cleanly
- [ ] Destructive change documented here in the per-migration log below

---

## D. Per-migration rollback notes (destructive / special cases)

Most migrations are additive and revert cleanly via `migration:revert`. Record only the ones needing special handling:

| Migration | Type | Rollback note |
|-----------|------|---------------|
| `1837100000000-channel-to-room-backfill` | Data backfill | `down()` removes channel→room mappings; legacy channels untouched, safe to revert. See [CHANNEL_SUNSET.md](./CHANNEL_SUNSET.md) |
| `1837000000000-member-subscription-active-unique` | Unique constraint | Revert drops the partial unique index; safe but re-allows duplicate active subs until re-applied |
| `1824000000000-stripe-connect` | Additive columns | Safe additive revert; ensure no live Connect accounts depend on the column before reverting in prod |

Add new destructive migrations here at author time.

---

## Quick reference

```bash
# Show applied/pending
node node_modules/typeorm/cli.js migration:show -d apps/api/dist/apps/api/src/database/data-source.js

# Revert latest (one step)
npm run migration:revert

# App rollback (do this first)
fly releases rollback -a forge-studios-api
fly releases rollback -a forge-studios-worker
```
