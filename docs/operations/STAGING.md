# Staging environment (F-902)

**Purpose:** Safe integration testing without touching production Fly/Vercel/Neon production branch.

**Deploy:** Manual only — `.github/workflows/deploy-staging.yml` (`workflow_dispatch`). No auto-deploy on PR.

---

## Naming convention

| Resource | Suggested name |
|----------|----------------|
| Fly API | `forge-studios-api-staging` |
| Fly worker | `forge-studios-worker-staging` |
| Neon branch | `staging` (child of `main`) |
| Vercel web | Preview deployments OR dedicated project `forge-web-staging` |
| Vercel admin | Preview OR `forge-admin-staging` |

---

## 1. Neon (database)

1. In [Neon console](https://console.neon.tech), create a branch `staging` from production or `main`.
2. Copy **pooled** connection string → `DATABASE_URL` (with `sslmode=require`).
3. Run migrations once:
   ```bash
   DATABASE_URL='postgresql://...' npm run migration:run --workspace=@forge/api
   ```
4. Do **not** point staging at production `main` branch URL.

---

## 2. Redis

Use a separate Redis Cloud database (or local Redis for dev-only staging).

```bash
REDIS_URL=rediss://...   # staging instance only
```

---

## 3. Fly API + worker

```bash
# One-time app create (if not exists)
fly apps create forge-studios-api-staging --org personal
fly apps create forge-studios-worker-staging --org personal

# Copy secrets from production template — use STAGING values only
fly secrets set DATABASE_URL='...' REDIS_URL='...' JWT_SECRET='...' \
  --app forge-studios-api-staging

fly secrets set WORKER_ONLY=true DATABASE_URL='...' REDIS_URL='...' \
  --app forge-studios-worker-staging

# Deploy (or use GitHub Actions deploy-staging workflow)
fly deploy --app forge-studios-api-staging
fly deploy -c fly.worker.toml --app forge-studios-worker-staging
```

Use `fly.staging.toml` if you fork config with `app = 'forge-studios-api-staging'` — or pass `--app` on CLI.

**Staging API URL example:** `https://forge-studios-api-staging.fly.dev/api/v1`

---

## 4. Vercel (web + admin)

**Option A — Preview (fastest):** Use Vercel preview URLs per PR; set preview env:

- `NEXT_PUBLIC_API_URL=https://forge-studios-api-staging.fly.dev/api/v1`

**Option B — Dedicated staging project:** Clone production Vercel project; assign `staging.forgestudios.net` when ready.

---

## 5. GitHub environment

1. Repo → Settings → Environments → **staging**
2. Add secrets: `FLY_API_TOKEN`, `DATABASE_URL`, `REDIS_URL`, staging `JWT_*`, `MUX_*` (test keys), `VERCEL_*` if using workflow deploy.
3. Do not reuse production-only webhooks (Mux staging webhook URL → staging API).

---

## 6. Smoke test

```bash
FORGE_SMOKE_API=https://forge-studios-api-staging.fly.dev/api/v1 \
  FORGE_SMOKE_MODE=public \
  bash scripts/smoke-api.sh
```

---

## Checklist (under 2 hours)

- [ ] Neon `staging` branch + migrations
- [ ] Redis staging instance
- [ ] Fly API + worker apps with secrets
- [ ] Vercel preview or staging project points at staging API
- [ ] GitHub `staging` environment secrets
- [ ] Smoke script passes

See [apps/api/.env.staging.example](../../apps/api/.env.staging.example) for variable list.
