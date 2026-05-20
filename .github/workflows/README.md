# GitHub Actions — FORGE CI/CD

Production stack: **Fly.io** (API) + **Vercel** (web/admin) + **Neon** + **Upstash**.

## Workflows

| Workflow | When it runs | Purpose |
|----------|----------------|---------|
| **[ci.yml](./ci.yml)** | Every PR + push to `main` | Lint, build, test (quality gate) |
| **[deploy-fly.yml](./deploy-fly.yml)** | Push to `main` (API paths) or manual | Deploy API to Fly.io |
| **[deploy-vercel.yml](./deploy-vercel.yml)** | Push to `main` (web/admin paths) or manual | Deploy web + admin to Vercel |
| **[api.yml](./api.yml)** | Push to `main` (API paths) | Push API Docker image to GHCR |
| **[web.yml](./web.yml)** | Push to `main` (web/admin paths) | Push web/admin Docker images to GHCR (optional) |

## Required secrets (Settings → Secrets and variables → Actions)

| Secret | Used by | How to get it |
|--------|---------|----------------|
| `FLY_API_TOKEN` | deploy-fly | [Fly tokens](https://fly.io/user/personal_access_tokens) |
| `VERCEL_TOKEN` | deploy-vercel | Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | deploy-vercel | `team_…` in `apps/web/.vercel/project.json` |
| `VERCEL_PROJECT_ID_WEB` | deploy-vercel | `prj_…` in `apps/web/.vercel/project.json` |
| `VERCEL_PROJECT_ID_ADMIN` | deploy-vercel | `prj_…` in `apps/admin/.vercel/project.json` |

`GITHUB_TOKEN` is automatic (GHCR push).

**Not used for current production:** `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (legacy EC2 deploy removed).

## Branch protection (recommended)

On `main`:

1. Require status check **CI passed** (or individual jobs: API, Web, Admin).
2. Require PR before merge.
3. Optionally require **Deploy** workflows only via manual `workflow_dispatch` until secrets are confirmed.

## Local parity

```bash
npm ci
npm run build --workspace=@forge/shared-types
npm run build --workspace=@forge/design-system
npm run lint:ci --workspace=@forge/api
npm run build --workspace=@forge/api
npm run test --workspace=@forge/api
npm run build --workspace=@forge/web
npm run build --workspace=@forge/admin
```

Deploy locally: `npm run deploy:production` (see [docs/MVP_GO_LIVE.md](../../docs/MVP_GO_LIVE.md)).
