# ADR-011: Creator route ordering and `me` param safety

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

NestJS matches routes in registration order. `/creators/me/...` vs `/creators/:creatorId/...` can treat `me` as a UUID-less public id.

This is an engineering invariant, not a product choice. Re-audit confirms it remains correct.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Only `ParseUUIDPipe` on all creator ids | Breaks `me` shortcut used by Studio. |
| Separate controllers/hosts | Unnecessary split. |

## Decision

1. Register all `/creators/me/*` routes **before** `/creators/:creatorId/*` in the same controller.
2. Use `ReservedCreatorIdPipe` on public `:creatorId` params that are not UUID-parsed.
3. Mobile unwraps nested `{ data }` envelopes via `readApiList` / `readApiMap`.

## Code evidence

- `forge-backend.mdc` route-order rule
- Courses/programs controllers

## Consequences

- Future controllers follow the same pattern.
