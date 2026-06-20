# QA test matrix

Role × flow × expected behavior across API, Web, Mobile, Admin.

**Setup:** [GETTING_STARTED.md](./GETTING_STARTED.md) · **Deploy:** [DEPLOY.md](./DEPLOY.md)

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `viewer@forge.local` | `ForgeDemo123!` | Viewer |
| `creator@forge.local` | `ForgeDemo123!` | Approved creator |
| `admin@forge.local` | `ForgeAdmin123!` | Admin (`:3002` only) |

Prefer `npm run dev:api` over stale Docker `api` image. `bash scripts/smoke-api.sh` · `npm run verify:roles`

## Access tiers

Rules: `packages/shared-types/src/access.ts`. `GET /users/me` returns `permissions[]`.

| Tier | Upload / live | Studio |
|------|---------------|--------|
| guest | no | no |
| viewer | no | apply only |
| creator_pending | no | waiting UI |
| creator (approved + verified) | yes | full |
| admin | N/A (admin app) | moderation |

## Quick smokes

**Web auth:** login → avatar visible without refresh → `/library` works → logout → guest gates.

**API:**

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@forge.local","password":"ForgeDemo123!"}'
```

**Flows:** sign up → watch → creator request → admin approve → upload (if S3/Mux) → admin reports → DMs (`/messages`) → memberships (`npm run smoke:memberships`) → Community 2.0 (`npm run smoke:community-2.0`).

**Stripe recurring (staging):** set `STRIPE_SECRET_KEY` + webhook secret, create a tier with `billingInterval`, complete checkout; webhook `customer.subscription.*` should upsert `subscriptions` using metadata from checkout `subscription_data`.

Route catalog: [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) · social contracts: [API_SCHEMAS.md](./API_SCHEMAS.md)

## Environment (local)

| App | Key var |
|-----|---------|
| API | `WEB_URL=http://localhost:3000` |
| Web | `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1` |
| Admin | same API URL + `NEXT_PUBLIC_WEB_URL` |
| Mobile | `--dart-define=API_BASE_URL=http://localhost:3001/api/v1` |
