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

**Flows:** sign up → watch → creator request → admin approve → upload (if S3/Mux) → admin reports.

## Gated playback (VOD + live) — F-1102

Requires Mux signing keys in API (`MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`) for signed HLS on tier/subscriber content.

| Case | Web | Mobile | Expected |
|------|-----|--------|----------|
| Public VOD | `/watch/[id]` | Watch screen | Plays without membership |
| Tier-gated VOD (logged out) | `/watch/[id]` | Watch screen | `accessDenied` UI; membership CTA; no player |
| Tier-gated VOD (member) | `/watch/[id]` | Watch screen | Signed `hlsUrl` plays |
| Public live | `/live/[id]` | Live watch | Plays when `playbackUrl` present |
| Gated live (no access) | `/live/[id]` | Live watch | `accessDenied` + membership CTA; chat hidden |
| Stripe checkout (staging) | Creator profile → tier | — | Checkout redirect; webhook grants `source: payment` |

Stripe staging: [operations/STAGING.md](./operations/STAGING.md). Billing: [MEMBERSHIPS.md](./MEMBERSHIPS.md).

Full route matrix and negative cases: see git history of `mvp-test-matrix.md` or expand in PRs as features ship.

## Environment (local)

| App | Key var |
|-----|---------|
| API | `WEB_URL=http://localhost:3000` |
| Web | `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1` |
| Admin | same API URL + `NEXT_PUBLIC_WEB_URL` |
| Mobile | `--dart-define=API_BASE_URL=http://localhost:3001/api/v1` |
