# CI/CD — GitHub Actions

**Production:** Fly.io (API) · Vercel (web + admin) · Neon · Upstash

**Repo workflows:** [.github/workflows/](../.github/workflows/)

---

## Workflows

| Workflow | When | Purpose |
|----------|------|---------|
| **ci.yml** | Every PR + push to `main` | Lint, build, test (quality gate) |
| **deploy-fly.yml** | Push to `main` (API paths) or manual | Deploy API to Fly.io |
| **deploy-vercel.yml** | Push to `main` (web/admin paths) or manual | Deploy web + admin to Vercel |

Lint and test run only in **ci.yml**. Deploy workflows do not replace CI.

Self-hosted Docker (GHCR image workflows) was removed; production uses Fly + Vercel only.

---

## Required GitHub secrets

**Path:** [github.com/Forge-Studios-dev/FORGE/settings/secrets/actions](https://github.com/Forge-Studios-dev/FORGE/settings/secrets/actions)

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
npm run gh:secrets
# or: bash scripts/print-github-secrets.sh
```

Prints Vercel IDs and copies Fly token to clipboard (macOS). Vercel token must still be created in the dashboard.

### Verify after all five secrets are set

1. **Actions** → **Deploy API (Fly.io)** → **Run workflow**
2. **Actions** → **Deploy Web & Admin (Vercel)** → **Run workflow**

Both should finish without missing-secret or auth errors.

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
