# FORGE — Backend

> Scope: **Apply when touching** `apps/api/**`, `packages/shared-types/**`. Mirrors `.cursor/rules/forge-backend.mdc`.

## API

- Feature modules; DTOs + validation; proper Nest exceptions; structured logging.
- **Route order:** register `/creators/me/...` before `/creators/:creatorId/...` in the same controller. Use `ReservedCreatorIdPipe` on public `:creatorId` params without `ParseUUIDPipe` as a safety net.
- JWT + refresh rotation; RBAC; rate limiting; request IDs where the codebase already does.
- Offload heavy/IO work to BullMQ (retries, idempotency). Do not block request handlers on CPU-heavy jobs.
- Transactions for multi-step writes; paginate list endpoints.

## Data & cache

- Prevent N+1; index hot paths; avoid unbounded queries and huge payloads.
- Redis for hot reads only when the path already warrants it; invalidate deliberately.
- Soft deletes only where the domain already uses them.

## Security

- Validate/sanitize inputs; never log secrets or stack traces to clients.
- Validate uploads; audit sensitive actions when patterns exist in-module.

## Real-time & async

- Socket.IO: keep gateways thin; throttle; use Redis adapter patterns already in repo.
- Video/feed/analytics: queues and async events on hot paths — follow existing pipeline modules, do not invent parallel systems.

## Observability

- Correlate with request/user IDs; prefer existing metrics/logging helpers over new stacks.
