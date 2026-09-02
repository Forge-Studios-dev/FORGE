# ADR-011: Creator route ordering and `me` param safety

**Status:** Accepted (2026-09-02)

## Context

NestJS matches routes in registration order. Controllers that expose both `/creators/me/...` (authenticated creator shortcut) and `/creators/:creatorId/...` (public consumer routes) can shadow the `me` path when `:creatorId` routes are registered first — e.g. Studio `GET /creators/me/programs` was incorrectly handled as `creatorId = "me"`.

## Decision

1. **Register** all `/creators/me/*` routes **before** `/creators/:creatorId/*` in the same controller.
2. **Add** `ReservedCreatorIdPipe` on public `:creatorId` params that do not use `ParseUUIDPipe` (courses catalog, programs, LMS bundles) to reject `creatorId=me` with `400`.
3. **Mobile clients** unwrap nested service payloads via `readApiList` / `readApiMap` (`apps/mobile/lib/core/network/api_envelope.dart`) because some services return `{ data: payload }` inside the global `{ success, data }` envelope.

## Consequences

- Studio program CRUD and public program pages behave correctly.
- Future controllers follow the same pattern (documented in `forge-backend.mdc`).
- Mobile discover/profile/studio course surfaces parse API lists reliably.
