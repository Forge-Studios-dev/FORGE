# Stripe production enablement runbook

**Tracker:** `CEOS-P05-T026` · **Related:** [MEMBERSHIPS.md](../MEMBERSHIPS.md) · [DEPLOY.md](../DEPLOY.md) · F-1101 (deferred signed Mux URLs)

Enable real membership billing, paid live events, and super chat on production. `fly.toml` already bakes `BILLING_PROVIDER=stripe` into the production env by default — this runbook sets the remaining `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` keys, not the provider itself.

**Graceful degradation:** if `STRIPE_SECRET_KEY` is unset, the API still boots successfully — `billingProviderFactory` logs a loud warning at startup and billing calls fail softly at call time (`StripePaymentProvider.client()` throws `NotImplementedException`) instead of crash-looping the app.

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Stripe account | Live mode enabled; **Connect** with Express accounts |
| Fly API app | `forge-studios-api` (webhooks hit API only) |
| Vercel web | `forgestudios.net` |
| Creator onboarding | At least one creator completes Connect before membership checkout works |
| Tests green | `stripe-tier-sync.service.spec.ts`, `billing.service.spec.ts` |

**Code paths (no duplicate billing stack):**

- `StripePaymentProvider` — Checkout + webhook parsing
- `StripeTierSyncService` — Product/price sync on tier save
- `StripeConnectService` — Express onboarding + destination charges
- `BillingService` — Checkout orchestration, webhook idempotency, entitlements grant

---

## 2. Environment variables

### API (Fly `forge-studios-api`)

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `BILLING_PROVIDER` | Yes | `stripe` |
| `STRIPE_SECRET_KEY` | Yes | `sk_live_...` (never commit) |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_...` from Stripe Dashboard webhook |
| `STRIPE_CONNECT_REFRESH_URL` | Recommended | `https://forgestudios.net/studio/memberships` |
| `STRIPE_PLATFORM_FEE_PERCENT` | Optional | Default `10` (platform fee on Connect destination charges) |
| `MOCK_SUBSCRIPTIONS_ENABLED` | Must be unset/false | Production schema rejects `true` |

### Web (Vercel)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_BILLING_ENABLED` | Yes | `true` — switches UI from mock join to Stripe checkout |

### Worker

Worker does **not** need Stripe secrets (billing is API-only). No change to `forge-studios-worker`.

---

## 3. Stripe Dashboard setup

### 3.1 Connect

1. Stripe Dashboard → **Connect** → Get started (Express).
2. Branding / support URL: `https://forgestudios.net`.
3. Redirect URLs must allow creator return paths from Studio memberships.

### 3.2 Webhook endpoint

**URL:** `https://api.forgestudios.net/api/v1/billing/webhook`

Subscribe to these events (handled in `stripe-payment.provider.ts`):

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Membership, lifetime, paid event, super chat |
| `invoice.upcoming` | Renewal pending state |
| `invoice.paid` | Renew active subscription |
| `invoice.payment_failed` | Failed payment / grace |
| `customer.subscription.updated` | Trial, pause, tier status sync |
| `customer.subscription.deleted` | Cancel membership |
| `charge.refunded` | Refund → revoke entitlement / reverse Super Chat + Super Thanks creator ledger |
| `charge.dispute.created` | Chargeback → revoke entitlement / reverse Super Chat + Super Thanks creator ledger |

Copy the **signing secret** → `STRIPE_WEBHOOK_SECRET`.

### 3.3 Products & prices

Created automatically when creators save tiers (`StripeTierSyncService.syncTier`). Manual Stripe catalog setup is **not** required.

---

## 4. Deployment procedure

### Phase A — Staging validation (recommended)

1. Use Stripe **test** keys on a staging API host (see [STAGING.md](./STAGING.md)).
2. Set `BILLING_PROVIDER=stripe`, test keys, test webhook secret.
3. Set `NEXT_PUBLIC_BILLING_ENABLED=true` on staging web.
4. Run validation checklist (§6) with test card `4242 4242 4242 4242`.
5. Confirm `member_subscriptions` row + `external_ref` populated after checkout.

### Phase B — Production cutover

```bash
# 1. Export live secrets locally (never commit)
export STRIPE_SECRET_KEY='sk_live_...'
export STRIPE_WEBHOOK_SECRET='whsec_...'
export STRIPE_CONNECT_REFRESH_URL='https://forgestudios.net/studio/memberships'
export STRIPE_PLATFORM_FEE_PERCENT=10   # optional

# 2. Apply Fly secrets
bash scripts/set-stripe-secrets-fly.sh

# 3. Vercel — enable billing UI
cd apps/web && vercel env add NEXT_PUBLIC_BILLING_ENABLED production
# value: true

# 4. Redeploy web (Vercel auto on env change or manual promote)
```

API restarts automatically when Fly secrets change.

---

## 5. Rollback

If checkout or webhooks misbehave:

```bash
# API — revert to stub (stops new charges; existing Stripe subs remain in Stripe)
fly secrets set BILLING_PROVIDER=stub --app forge-studios-api

# Web — hide Stripe checkout UI
# Vercel: NEXT_PUBLIC_BILLING_ENABLED=false → redeploy
```

| Action | Effect |
|--------|--------|
| `BILLING_PROVIDER=stub` | New checkouts use stub provider; webhooks ignored |
| `NEXT_PUBLIC_BILLING_ENABLED=false` | Web shows mock join where allowed |
| Existing `member_subscriptions` | Unchanged in DB; cancel via admin or Stripe Dashboard if needed |

**Do not** set `MOCK_SUBSCRIPTIONS_ENABLED=true` in production (boot fails).

---

## 6. Validation checklist

Run after cutover:

```bash
# Health + membership smoke
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 \
  bash scripts/smoke-memberships.sh

# Optional billing-aware smoke (connect status endpoint)
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 \
FORGE_SMOKE_BILLING=true \
  bash scripts/smoke-memberships.sh
```

| # | Check | Expected |
|---|-------|----------|
| 1 | Creator → Studio → Memberships → **Set up payouts** | Stripe Connect onboarding opens |
| 2 | `GET /billing/connect/status` (creator JWT) | `chargesEnabled: true` after onboarding |
| 3 | Creator creates tier (monthly) | `subscription_tiers.stripe_price_id` populated |
| 4 | Viewer → profile → Join membership | Redirect to Stripe Checkout |
| 5 | Complete checkout (live/test card per mode) | Webhook 200; `member_subscriptions` active |
| 6 | Gated content / community | Entitlement grants access |
| 7 | Settings → My memberships → Cancel | Stripe cancel or period-end per config |
| 8 | Paid live event checkout | `checkout.session.completed` with `type=stream_event` |
| 9 | Stripe Dashboard → Webhooks | No sustained 4xx/5xx on endpoint |
| 10 | Admin → creator Connect status | `listCreatorConnectStatus` shows connected |

**Unit tests (local):**

```bash
cd apps/api && npx jest --testPathPattern="stripe-tier-sync|billing\.service" --watchman=false
```

---

## 7. Security & operations

| Topic | Guidance |
|-------|----------|
| Secrets | Fly secrets only; rotate if exposed |
| Webhook signature | Required — unsigned payloads rejected |
| Idempotency | `WebhookIdempotencyService` dedupes by event id |
| Connect gating | Checkout blocked until `chargesEnabled` (prevents stranded payments) |
| Platform fee | `STRIPE_PLATFORM_FEE_PERCENT` on destination charges |
| Admin impersonation | Audit event `admin.impersonate` — do not use for billing QA |
| PII in logs | Do not log full Stripe payloads in production |

---

## 8. Monitoring

| Signal | Where |
|--------|-------|
| Webhook failures | Stripe Dashboard → Webhooks → event log |
| API errors | Sentry (`billing`, `stripe`) |
| Subscription state | `member_subscriptions.status`, worker `subscription-maintenance` |
| Connect incomplete | Admin → Creators → Connect status |

---

## 9. Known limitations (F-1101)

- Signed Mux playback URLs (DRM) — deferred; unrelated to Stripe cutover.
- `BILLING_PROVIDER=stub` remains the **local dev default** in `.env.example`.

---

## 10. References

| Resource | Path |
|----------|------|
| Membership API | [MEMBERSHIPS.md](../MEMBERSHIPS.md) |
| Tier sync tests | `apps/api/src/modules/billing/stripe-tier-sync.service.spec.ts` |
| Fly secrets script | `scripts/set-stripe-secrets-fly.sh` |
| Env templates | `apps/api/.env.example`, `apps/web/.env.example` |
| Master tracker | `CEOS-P05-T011`–`T028` |
