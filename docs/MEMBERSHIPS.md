# Memberships & billing

Creator-controlled tiers, Stripe recurring checkout, entitlements, and access sessions.

**Implementation tracker:** [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md) (Phase 5 — `CEOS-P05-*`)

## Providers

| Mode | Config | Behavior |
|------|--------|----------|
| Mock | `BILLING_PROVIDER=stub` (default) | `POST /subscriptions/mock` when `MOCK_SUBSCRIPTIONS_ENABLED` |
| Stripe | `BILLING_PROVIDER=stripe` + keys | Checkout sessions + webhooks |

Web checkout: `NEXT_PUBLIC_BILLING_ENABLED=true`

**Production cutover:** [operations/STRIPE_PRODUCTION_ENABLEMENT.md](./operations/STRIPE_PRODUCTION_ENABLEMENT.md)

## API

| Endpoint | Notes |
|----------|-------|
| `GET /creators/:id/tiers` | Public tier list |
| `POST /creators/me/tiers` | Creator tier CRUD + Stripe price sync |
| `GET /creators/:id/membership/me` | Viewer membership for creator |
| `GET /subscriptions/me` | Member's active subscriptions |
| `DELETE /subscriptions/me/:creatorId` | Cancel membership (Stripe when `externalRef` set) |
| `POST /subscriptions/mock` | Dev mock join |
| `POST /billing/checkout` | Recurring membership checkout |
| `POST /billing/checkout/event` | Paid live event checkout |
| `POST /billing/subscriptions/change-tier` | In-place tier change (Stripe sub update) or new checkout |
| `POST /billing/portal` | Stripe billing portal (payment methods, invoices) |
| `GET /billing/connect/status` | Stripe Connect account status |
| `POST /billing/connect/onboard` | Express Connect onboarding link |
| `POST /billing/webhook` | Stripe webhooks |
| `POST /admin/subscriptions/grant` | Admin grant |

## Stripe Connect & payouts

When `BILLING_PROVIDER=stripe`, membership checkout uses **destination charges**:

- Funds transfer to the creator's Connect Express account (`users.stripe_connect_account_id`)
- Platform retains `STRIPE_PLATFORM_FEE_PERCENT` (default **10**)
- Checkout is blocked until Connect onboarding completes (`chargesEnabled`)

Creators: Studio → Memberships → **Set up payouts** → complete Stripe onboarding.

## Tier changes

`POST /billing/subscriptions/change-tier` with `{ creatorId, tierId }`:

- If the member has an active **Stripe** subscription → updates in place with proration (`subscriptions.update`)
- Otherwise → returns a new checkout session URL

Web: Settings → My memberships (tier change UI can call this endpoint).

## Entitlements

`EntitlementsService` gates VOD, live, community channels, and tier-scoped resources via `tier_entitlements`.

Visibility values: `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event` — see `@forge/shared-types`.

## Subscription lifecycle

`MemberSubscriptionStatus` transitions. Access-granting statuses: `active`, `trial`, `grace_period`, `renewal_pending`.

```
trialing ──(Stripe sub.updated → active)──▶ active ──(expiresAt passes)──▶ expired
    │                                          │
    └──(expiresAt passes, no conversion)──┐    └──(cancel / payment fail / refund)──▶ canceled / failed_payment / refunded
                                          ▼
                                       expired
```

- **Trial → active**: driven by the Stripe `customer.subscription.updated` webhook (`billing.service` → `grantSubscription`).
- **Expiry safety net**: `entitlementsService.expireDueSubscriptions()` (hourly `subscription-maintenance` worker) transitions any `active`, `trial`, or `renewal_pending` subscription whose `expiresAt` has passed to `expired`, revokes access, busts the entitlement cache, and suspends scoped community membership. This is the only end-of-trial mechanism for non-Stripe (mock/admin) trials, and a backstop for missed Stripe webhooks (e.g. a `cancel-at-period-end` `subscription.deleted` event that never arrives). The Stripe webhook forward-dates `expiresAt` on each renewal, so live subscriptions are never caught here. `grace_period` is **excluded** — its `expiresAt` is the already-past period end, so time-expiring it would collapse the dunning window; it exits only via Stripe webhooks (recovered → `active`, final failure → `canceled`).
- **Trial-ending reminders**: `getExpiringSubscriptions()` includes `trial` subscriptions; the maintenance service emits trial-specific copy (`trial_ending` push, "free trial ends in N day(s)") vs. membership-expiry copy, deduped per subscription via Redis.

## Access sessions

One concurrent premium session per user by default. Tiers can allow **1–10 simultaneous devices** via `maxConcurrentDevices` on `subscription_tiers`. Access sessions track device fingerprints in Redis; exceeding the tier cap returns `device_limit`. See `access-sessions` module.

Optional `creatorId` on `POST /access-sessions/start` scopes the device cap to that creator's subscription tier.

## QA

1. Studio → Memberships → create tier
2. Profile → Join (or Stripe checkout when enabled)
3. Verify gated channel/content access
4. Settings → My memberships → cancel

`bash scripts/smoke-community-2.0.sh` · worker queue `subscription-maintenance`

## Deferred

- Signed Mux URLs — F-1101

See [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md).
