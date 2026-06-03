# Memberships & entitlements (Phase 1)

FORGE Phase 1 monetization uses **mock/admin-granted memberships** — no real payment provider yet. Access control is centralized in `EntitlementsService` and applied to streams, VOD, live chat, and community channels.

## Data model

| Table | Purpose |
|-------|---------|
| `subscription_tiers` | Per-creator tiers (name, slug, price, benefits, `sort_order`) |
| `member_subscriptions` | User ↔ creator ↔ tier; `status`, `source`, `expires_at` |

`source` values: `mock`, `admin_grant` (test), `payment` (Phase 2).

## Visibility

Shared enums in `@forge/shared-types` and API `content-access.types.ts`:

- `public`, `followers`, `subscribers`, `tier`, `private`, `paid_event`, `unlisted` (videos)

Streams and videos call `EntitlementsService.checkAccess()` before returning `playbackUrl` / `hlsUrl`.

## Dev & QA

1. Set `MOCK_SUBSCRIPTIONS_ENABLED=true` (default in non-production).
2. Creator: Studio → **Memberships** → create tiers.
3. Viewer: creator profile → **Join (test)** or `POST /api/v1/subscriptions/mock` with `{ creatorId, tierId }`.
4. Admin override: `POST /api/v1/admin/subscriptions/grant` (admin role).

Test memberships show a **Test membership** badge in the web UI.

## API highlights

| Endpoint | Description |
|----------|-------------|
| `GET /creators/:id/tiers` | Public tier list |
| `GET /creators/:id/membership/me` | Current viewer membership |
| `POST /subscriptions/mock` | Grant test subscription (gated by env) |
| `POST /admin/subscriptions/grant` | Admin grant |

## Background jobs

- **Subscription maintenance** (BullMQ queue `subscription-maintenance`, hourly):
  - Notify users whose membership expires within 3 days (Redis dedupe per subscription).
  - Mark expired subscriptions inactive and bust entitlement cache.
- API registers the repeatable scheduler; the Fly **worker** app (`WORKER_ONLY=true`) processes jobs in production.
- Local/dev: worker module also registers the consumer when `NODE_ENV !== 'production'`.
- Disable with `DISABLE_SUBSCRIPTION_MAINTENANCE=true`.

## Caching

- Active subscription: Redis `ent:sub:{userId}:{creatorId}` TTL 60s; invalidated on grant/expire.
- Stream chat first page: short Redis cache (5s) on hot streams.

## Phase 2 (not implemented)

- `BillingModule` `PaymentProvider` → Stripe / Razorpay adapters
- Webhook → BullMQ `billing-webhook` → idempotent subscription upsert
- Mux signed playback URLs for gated HLS
- Paid events, tips, payouts

## Security notes

- Never return playback URLs when `checkAccess` denies.
- Do not trust client-side “subscribed” flags; always verify server-side.
- Real entitlements after checkout only via verified webhooks (Phase 2).

## Deploy checklist (Phase 1)

1. Merge on a feature branch; one deploy to `main` when ready ([forge-git-branching](../.cursor/rules/forge-git-branching.mdc)).
2. Confirm migration `1750000000000-live-subs-community` ran (`migrationsRun: true` on API boot).
3. Production worker: `WORKER_ONLY=true` on Fly worker app (consumes `subscription-maintenance` + `push-dispatch`).
4. Optional non-prod: `MOCK_SUBSCRIPTIONS_ENABLED=true` for test joins.
5. Smoke after deploy:
   - `bash scripts/smoke-api.sh`
   - `bash scripts/smoke-memberships.sh` (with demo user in DB)
6. Manual QA: mock join → gated live/VOD → chat → community → end stream → VOD “Recorded from live” link.

## Tests

- `apps/api`: `entitlements.service.spec.ts`, `streaming.service.spec.ts`, `stream-chat.service.spec.ts`
- Run: `npm test --workspace=apps/api -- --testPathPattern="entitlements|streaming.service|stream-chat"`
