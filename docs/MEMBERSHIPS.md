# Memberships (mock + partial Stripe)

Phase 1: **mock/admin grants** — no recurring Stripe subs. Access: `EntitlementsService` on VOD, live, chat, community.

**Partial Stripe (shipped):** one-off checkout for **paid events** and **super chat**; **recurring membership checkout** when `BILLING_PROVIDER=stripe`. Stripe Connect payouts remain deferred — see [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) F-1101.

**Schemas:** [API_SCHEMAS.md](./API_SCHEMAS.md)

## API

| Endpoint | Notes |
|----------|-------|
| `GET /creators/:id/tiers` | Public tiers |
| `POST /creators/me/tiers` | Creator CRUD |
| `POST /subscriptions/mock` | `{ creatorId, tierId }` — `MOCK_SUBSCRIPTIONS_ENABLED` |
| `DELETE /subscriptions/me/:creatorId` | Cancel mock subscription |
| `POST /admin/subscriptions/grant` | Admin grant |
| `POST /billing/checkout` | Stripe checkout session (paid events) |
| `POST /billing/checkout/event` | Stripe checkout for stream event |
| `POST /billing/webhook` | Stripe webhook handler |

Visibility: `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event` — `@forge/shared-types`.

## QA

Studio → Memberships → create tier → profile “Join (test)” → verify gated playback hidden when denied.

`npm run smoke:memberships` · worker queue `subscription-maintenance`

## Phase 2 (deferred)

Recurring membership Stripe subs, signed Mux URLs, Stripe Connect creator payouts — tracked as F-1101.
