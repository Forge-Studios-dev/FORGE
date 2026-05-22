# CI/CD — GitHub Actions

**Production:** Fly.io (API) · Vercel (web + admin) · Neon · Upstash

**Repo workflows:** [.github/workflows/](../.github/workflows/)

---

## Workflows

| Workflow | When | Purpose |
|----------|------|---------|
| **ci.yml** | Every PR + push to `main` | Lint, build, test (quality gate) |
| **release.yml** | After **CI** succeeds on `main`, or manual | Deploy API (Fly) + **worker** (`fly.worker.toml`) + web + admin (Vercel) |
| **deploy-fly.yml** | Manual only | Deploy API only (emergency) |
| **deploy-vercel.yml** | Manual only | Deploy web + admin only (emergency) |

Lint and test run only in **ci.yml**. Deploy workflows do not replace CI.

Self-hosted Docker (GHCR image workflows) was removed; production uses Fly + Vercel only.

---

## Required GitHub secrets

Set secrets in **both** places (Release jobs use `environment: production`, and environment secrets override repo secrets):

1. [Repo secrets](https://github.com/Forge-Studios-dev/FORGE/settings/secrets/actions)
2. [Environment `production`](https://github.com/Forge-Studios-dev/FORGE/settings/environments)

`npm run gh:secrets:set` updates repo + `production` when `VERCEL_TOKEN` is set.

| Secret | Used by | Notes |
|--------|---------|-------|
| `FLY_API_TOKEN` | deploy-fly | [Fly tokens](https://fly.io/user/personal_access_tokens) — shown once when created |
| `VERCEL_TOKEN` | deploy-vercel | [Vercel tokens](https://vercel.com/account/settings/tokens) — shown once |
| `VERCEL_ORG_ID` | deploy-vercel | `team_…` in `apps/web/.vercel/project.json` |
| `VERCEL_PROJECT_ID_WEB` | deploy-vercel | `prj_…` in `apps/web/.vercel/project.json` |
| `VERCEL_PROJECT_ID_ADMIN` | deploy-vercel | `prj_…` in `apps/admin/.vercel/project.json` |

**Not used:** `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (legacy EC2 deploy removed).

### Accounts on this project

| Service | Account |
|---------|---------|
| Fly.io | `forge-support@forgestudios.net` |
| Vercel | `forge-support-5996` (team: **forge-s-projects3**) |

### Non-secret IDs (copy into GitHub)

| Secret name | Value |
|-------------|--------|
| `VERCEL_ORG_ID` | `team_CaZHYULfOEkUneEn2CDN6CGw` |
| `VERCEL_PROJECT_ID_WEB` | `prj_XSO4gENpdrFBUmGWmxLSZSUXTbbC` |
| `VERCEL_PROJECT_ID_ADMIN` | `prj_zowMHYefTqYYQWD6ZaXxhLw2LxbC` |

### Create `FLY_API_TOKEN`

1. [fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens) → **Create token** → name `github-actions-forge`
2. Copy immediately → GitHub secret `FLY_API_TOKEN`

**Or on a Mac already logged into Fly:**

```bash
fly auth token | pbcopy   # paste into GitHub
```

### Create `VERCEL_TOKEN`

1. [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens) → **Create Token** → name `github-actions-forge`
2. Scope: deploy access for team **forge-s-projects3**
3. Copy immediately → GitHub secret `VERCEL_TOKEN`

### Local helper

```bash
npm run gh:secrets:set   # after: gh auth login (repo admin)
# or print values only:
npm run gh:secrets
```

`gh:secrets:set` pushes all five secrets from local Fly + Vercel CLI. Requires `gh auth login` with **admin** on `Forge-Studios-dev/FORGE`.

If you see **HTTP 504** (GitHub timeout), wait a minute and run `npm run gh:secrets:set` again — the script retries each secret.

Use a **classic** Vercel token for `VERCEL_TOKEN` (dashboard token, not OAuth):

```bash
export VERCEL_TOKEN='your_classic_vercel_token'
gh auth switch --user Forge-Studios-dev   # if you have multiple gh accounts
npm run gh:secrets:set
```

### Fly worker app (video transcoding)

API machines must **not** run FFmpeg. Create a dedicated worker once:

```bash
fly apps create forge-studios-worker --org personal
fly secrets set WORKER_ONLY=true --app forge-studios-worker
# Copy DATABASE_URL, REDIS_URL, AWS_*, JWT_* from forge-studios-api
fly deploy -c fly.worker.toml
```

`release.yml` deploys this app after the API. If the worker app does not exist, the worker job fails — create it before the first production release.

### Production smoke tests

After API deploy, release runs:

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
```

Full smoke (demo users) remains for local/staging: `npm run smoke:api`.

### Verify after all five secrets are set

1. Push to `main` (or open a PR) — **CI** should pass (includes **Mobile — Flutter analyze** when `apps/mobile/**` changes).
2. **Actions** → **Release (production)** runs automatically after green CI on `main`.
3. Or run **Release (production)** manually to deploy everything at once.

Emergency single-target deploys: **Deploy API (Fly.io)** or **Deploy Web & Admin (Vercel)**.

---

## Branch protection (recommended)

On `main`:

1. Require status check **CI passed** (or jobs: API, Web, Admin).
2. Require PR before merge.
3. Optionally run deploy workflows via **workflow_dispatch** until secrets are confirmed.

---

## Local parity (same as CI)

```bash
npm run ci          # scripts/ci-local.sh
# or step by step:
npm ci
npm run build --workspace=@forge/shared-types
npm run build --workspace=@forge/design-system
npm run lint:ci --workspace=@forge/api
npm run build --workspace=@forge/api
npm run test --workspace=@forge/api
npm run build --workspace=@forge/web
npm run build --workspace=@forge/admin
```

Requires local Postgres + Redis for API tests (see [GETTING_STARTED.md](./GETTING_STARTED.md)).

**Deploy locally:** `npm run deploy:production` — see [MVP_GO_LIVE.md](./MVP_GO_LIVE.md).

---

## Checklist

- [ ] `FLY_API_TOKEN`
- [ ] `VERCEL_TOKEN`
- [ ] `VERCEL_ORG_ID`
- [ ] `VERCEL_PROJECT_ID_WEB`
- [ ] `VERCEL_PROJECT_ID_ADMIN`

*Last updated: 2026-05-21*
