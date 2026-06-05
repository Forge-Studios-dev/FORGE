# Memberships

Access control: `EntitlementsService` on VOD, live, chat, community.

**Schemas:** [API_SCHEMAS.md](./API_SCHEMAS.md) · **Deploy:** [DEPLOY.md](./DEPLOY.md) Phase 6

## API

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /creators/:id/tiers` | Public | Active tiers; `hasStripePrice` when linked |
| `POST /creators/me/tiers` | Creator | Optional `stripePriceId` (`price_...`) |
| `PATCH /creators/me/tiers/:id` | Creator | Update tier incl. `stripePriceId` |
| `GET /creators/:id/membership/me` | User | Active membership + `isTestMembership` |
| `POST /subscriptions/mock` | User | `{ creatorId, tierId }` when `MOCK_SUBSCRIPTIONS_ENABLED` |
| `POST /billing/checkout` | User | Stripe Checkout — `{ creatorId, tierId }` when `STRIPE_ENABLED` |
| `POST /billing/subscriptions/cancel` | User | `{ creatorId }` — cancels paid sub |
| `POST /billing/webhooks/stripe` | Public | Raw body + `stripe-signature` |
| `POST /admin/subscriptions/grant` | Admin | Manual grant |

Visibility: `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event` — `@forge/shared-types`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOCK_SUBSCRIPTIONS_ENABLED` | `true` (non-prod) | Test memberships without payment |
| `STRIPE_ENABLED` | `false` | Enable Stripe checkout + webhooks |
| `STRIPE_SECRET_KEY` | — | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | — | Webhook signature verification |

`GET /platform/config` exposes `billing.stripeEnabled` and `billing.mockSubscriptionsEnabled` for web/mobile.

## Stripe setup (staging / prod)

1. Stripe Dashboard → Products → create recurring Price per tier
2. Creator Studio → link `stripePriceId` on each paid tier (or PATCH via API)
3. Webhook endpoint: `https://<api>/api/v1/billing/webhooks/stripe`
4. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Fly secrets: `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Note:** Platform is merchant of record (no Stripe Connect yet). Revenue offsets Mux/infra COGS (audit F-1101).

## Gated playback

Non-public VOD/live uses Mux signed URLs when `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` are set — see [MEDIA.md](./MEDIA.md#signed-playback-gated-content).

## QA

**Mock path:** Studio → Memberships → create tier → profile “Join (test)” → verify gated playback denied when not subscribed.

**Stripe path (test mode):** Link `price_...` on tier → Subscribe → complete Checkout → webhook grants `source: payment` → gated playback allowed.

`npm run smoke:memberships` · worker queue `subscription-maintenance`
