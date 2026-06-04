# Memberships (mock)

Phase 1: **mock/admin grants** — no Stripe. Access: `EntitlementsService` on VOD, live, chat, community.

**Schemas:** [API_SCHEMAS.md](./API_SCHEMAS.md)

## API

| Endpoint | Notes |
|----------|-------|
| `GET /creators/:id/tiers` | Public tiers |
| `POST /creators/me/tiers` | Creator CRUD |
| `POST /subscriptions/mock` | `{ creatorId, tierId }` — `MOCK_SUBSCRIPTIONS_ENABLED` |
| `POST /admin/subscriptions/grant` | Admin |

Visibility: `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event` — `@forge/shared-types`.

## QA

Studio → Memberships → create tier → profile “Join (test)” → verify gated playback hidden when denied.

`npm run smoke:memberships` · worker queue `subscription-maintenance`

## Phase 2

Stripe webhooks, signed Mux URLs — not implemented (`BillingModule` scaffold only).
