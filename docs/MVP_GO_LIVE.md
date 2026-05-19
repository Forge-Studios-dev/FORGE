# FORGE MVP — Go live (free tier, step-by-step)

**Repo:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

This is the **single guide** to put your MVP on the internet using free (or free-tier) services. You already have **Neon** (Postgres) and **Upstash** (Redis) configured locally — this doc finishes the rest.

---

## Recommended free stack (best for this project)

| Layer | Service | Why |
|-------|---------|-----|
| **Web** | [Vercel](https://vercel.com) | Best Next.js hosting, free hobby tier |
| **Admin** | [Vercel](https://vercel.com) | Second project, same repo |
| **API** | [Fly.io](https://fly.io) | Runs your Docker/NestJS API + BullMQ |
| **Database** | [Neon](https://neon.tech) | Serverless Postgres, free tier |
| **Redis** | [Upstash](https://upstash.com) | Free tier, works with BullMQ |
| **CI/CD** | GitHub Actions | Already in repo (`.github/workflows/`) |
| **Code** | GitHub | `Forge-Studios-dev/FORGE` |

**Skip for first MVP go-live** (add later): AWS S3, Mux live, FFmpeg worker VM, custom domain (optional), mobile store builds.

### What works on free MVP without AWS/Mux

- Sign up / login, roles (guest → viewer → creator flow UI)
- Feed, explore, search, watch pages
- Admin panel (users, reports, impersonation)
- Real-time toasts (single Fly machine)

### What needs paid services later

- Video **upload** + transcoding (S3 + worker)
- **Live** streaming (Mux)

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           GitHub (main branch)       │
                    │  deploy-vercel.yml │ deploy-fly.yml  │
                    └──────────┬───────────────┬───────────┘
                               │               │
              ┌────────────────┘               └────────────────┐
              ▼                                                  ▼
   ┌──────────────────────┐                         ┌──────────────────────┐
   │ Vercel               │                         │ Fly.io               │
   │  • apps/web  :3000   │   NEXT_PUBLIC_API_URL   │  • apps/api  :3001   │
   │  • apps/admin :3002  │ ──────────────────────► │  NestJS + BullMQ     │
   └──────────────────────┘                         └──────────┬───────────┘
                                                               │
                                    ┌──────────────────────────┴──────────┐
                                    ▼                                     ▼
                         ┌──────────────────┐                 ┌──────────────────┐
                         │ Neon (Postgres)  │                 │ Upstash (Redis)  │
                         └──────────────────┘                 └──────────────────┘
```

---

## Before you start (checklist)

- [ ] Code pushed to [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE) on `main`
- [ ] `apps/api/.env` has Neon `DATABASE_URL` (see `apps/api/.env.neon.example`)
- [ ] `apps/api/.env` has Upstash `UPSTASH_REDIS_REST_*` (see `apps/api/.env.upstash.example`)
- [ ] Local verify: `npm run db:neon:setup` and `npm run redis:upstash:test` both pass
- [ ] Accounts: [Neon](https://neon.tech), [Upstash](https://upstash.com), [Fly](https://fly.io), [Vercel](https://vercel.com), GitHub

**Time estimate:** ~2–3 hours first time.

---

## Step 1 — Neon (database) ✓ likely done

1. [console.neon.tech](https://console.neon.tech) → create project.
2. **Connect** → copy connection string with `?sslmode=require`.
3. For **Fly.io**, prefer **Pooled connection** (hostname contains `-pooler`).

**Local `apps/api/.env`:**

```env
DATABASE_URL=postgresql://USER:PASS@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DB_POOL_MAX=10
```

**Migrate + seed (once):**

```bash
npm run db:neon:setup
```

Demo users created: `viewer@forge.local` / `ForgeDemo123!`, `admin@forge.local` / `ForgeAdmin123!`

---

## Step 2 — Upstash (Redis) ✓ likely done

1. [console.upstash.com](https://console.upstash.com) → create Redis database.
2. Copy **REST API** URL + token (or `rediss://` URL from **Redis Connect**).

**Local `apps/api/.env`:**

```env
UPSTASH_REDIS_REST_URL=https://YOUR-ENDPOINT.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Test:**

```bash
npm run redis:upstash:test
```

---

## Step 3 — Fly.io (API)

### 3.1 Install & login

```bash
brew install flyctl
fly auth login
cd /path/to/FORGE
```

### 3.2 Create app

```bash
fly apps create forge-studios-api
# If taken, change `app = '...'` in fly.toml and retry
```

### 3.3 Set secrets

Use your **real** Neon pooled URL and Upstash credentials. Generate new JWT secrets for production.

```bash
fly secrets set \
  DATABASE_URL='postgresql://USER:PASS@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require' \
  DB_POOL_MAX='10' \
  UPSTASH_REDIS_REST_URL='https://YOUR-ENDPOINT.upstash.io' \
  UPSTASH_REDIS_REST_TOKEN='your-token' \
  JWT_SECRET="$(openssl rand -base64 64)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 64)" \
  NODE_ENV='production'
```

> You will add `WEB_URL` and `ADMIN_URL` after Vercel deploy (Step 4).

### 3.4 Deploy API

```bash
fly deploy
```

**Check:**

```bash
curl -s https://forge-studios-api.fly.dev/api/v1/health
```

Swagger: `https://forge-studios-api.fly.dev/api/docs`

### 3.5 GitHub Actions (optional auto-deploy)

1. [fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens) → create token.
2. GitHub repo → **Settings → Secrets → Actions** → `FLY_API_TOKEN`.
3. Enable **Actions** on the repo.
4. Push to `main` or run workflow **Deploy API (Fly.io)**.

---

## Step 4 — Vercel (web + admin)

Create **two** projects from the same repo.

### 4.1 Web app

1. [vercel.com/new](https://vercel.com/new) → import `Forge-Studios-dev/FORGE`.
2. **Root Directory:** `apps/web`
3. Framework: **Next.js** (auto-detected).
4. **Environment variables** (Production):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://forge-studios-api.fly.dev/api/v1` |
| `API_INTERNAL_URL` | `https://forge-studios-api.fly.dev/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-WEB-PROJECT.vercel.app` (after first deploy) |
| `NEXT_PUBLIC_ADMIN_URL` | `https://YOUR-ADMIN-PROJECT.vercel.app` (after admin deploy) |

5. **Deploy**.

Copy the deployed URL (e.g. `https://forge-web-xxx.vercel.app`).

### 4.2 Admin app

1. New Vercel project → same repo.
2. **Root Directory:** `apps/admin`
3. **Environment variables:**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://forge-studios-api.fly.dev/api/v1` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://YOUR-ADMIN-PROJECT.vercel.app` |
| `NEXT_PUBLIC_WEB_URL` | `https://YOUR-WEB-PROJECT.vercel.app` |

4. **Deploy**.

### 4.3 Fix CORS on Fly (required)

Set exact Vercel URLs on the API:

```bash
fly secrets set \
  WEB_URL='https://YOUR-WEB-PROJECT.vercel.app' \
  ADMIN_URL='https://YOUR-ADMIN-PROJECT.vercel.app'
```

Redeploy is automatic when secrets change. Update Vercel env vars if you had placeholders, then **Redeploy** web + admin.

### 4.4 GitHub Actions for Vercel (optional)

| Secret | Where |
|--------|--------|
| `VERCEL_TOKEN` | Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | Team Settings → General |
| `VERCEL_PROJECT_ID_WEB` | Web project → Settings → General |
| `VERCEL_PROJECT_ID_ADMIN` | Admin project → Settings → General |

Workflow: **Deploy Web & Admin (Vercel)** on push to `main`.

---

## Step 5 — Seed production database (if not done)

If demo logins fail on production, seed Neon from your machine:

```bash
# Uses DATABASE_URL from apps/api/.env (must be Neon, not localhost)
npm run db:neon:setup
```

---

## Step 6 — Go-live verification

```bash
# API health
curl -s https://forge-studios-api.fly.dev/api/v1/health

# Optional: full smoke (API must be reachable)
NEXT_PUBLIC_API_URL=https://forge-studios-api.fly.dev/api/v1 bash scripts/smoke-api.sh
```

**Manual MVP checklist:**

| # | Test | URL |
|---|------|-----|
| 1 | Guest browse home / explore | Web |
| 2 | Login viewer | `viewer@forge.local` / `ForgeDemo123!` |
| 3 | Library, profile, search | Web |
| 4 | Admin login | `admin@forge.local` / `ForgeAdmin123!` on **admin** URL |
| 5 | Users list, impersonation | Admin |

Full matrix: [mvp-test-matrix.md](./mvp-test-matrix.md)

---

## Share with client

| App | URL |
|-----|-----|
| Web | `https://YOUR-WEB.vercel.app` |
| Admin | `https://YOUR-ADMIN.vercel.app` |
| API docs | `https://forge-studios-api.fly.dev/api/docs` |

Stakeholder summary: [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel build fails (workspace) | Root Directory = `apps/web` or `apps/admin`; `vercel.json` in each app runs `npm ci` from repo root |
| API 502 / crash on Fly | `fly logs` — check `DATABASE_URL`, Upstash vars |
| CORS / login blocked | `WEB_URL` + `ADMIN_URL` on Fly must **exactly** match Vercel URLs (no trailing slash) |
| 401 on all API calls | `NEXT_PUBLIC_API_URL` must end with `/api/v1` |
| Demo users missing | `npm run db:neon:setup` against Neon |
| Redis errors | `npm run redis:upstash:test` locally; match secrets on Fly |
| GitHub Action skipped | Add secrets; enable Actions |

---

## Alternatives (not recommended for first MVP)

| Path | When to use | Doc |
|------|-------------|-----|
| **Local + ngrok** | Quick call, no hosting setup | [DEPLOYMENT_DEMO.md](./DEPLOYMENT_DEMO.md) Path B |
| **Oracle Cloud free VM** | Full Docker Compose, one server | [DEPLOYMENT_DEMO.md](./DEPLOYMENT_DEMO.md) Path C |
| **EC2 + docker-compose.prod** | You already have AWS + CI SSH secrets | Root [README.md](../README.md) |

---

## Free tier limits (plan accordingly)

| Service | Limit | MVP impact |
|---------|-------|------------|
| Vercel | Hobby bandwidth/build minutes | Fine for demos |
| Fly.io | Small VM hours / credit | API may sleep when idle (cold start ~5s) |
| Neon | Storage + compute caps | Fine for demo data |
| Upstash | Commands/day | Fine for demo traffic |

---

## After MVP (paid upgrades)

1. **Custom domain** — Vercel Domains + `fly certs add api.yourdomain.com`
2. **Video upload** — AWS S3 + worker on Fly/Railway
3. **Live** — Mux account + webhook to Fly API
4. **Mobile** — Flutter build → TestFlight / Play Internal Testing

Production checklist: [FORGE_PROJECT_MASTER.md §25](./FORGE_PROJECT_MASTER.md)

---

## Quick reference — env files (never commit secrets)

| File | Purpose |
|------|---------|
| `apps/api/.env` | Local + Neon + Upstash (gitignored) |
| `apps/api/.env.neon.example` | Neon template |
| `apps/api/.env.upstash.example` | Upstash template |
| `apps/web/.env.local` | Local web |
| `apps/admin/.env.local` | Local admin |

---

## NPM scripts

```bash
npm run db:neon:setup      # Neon migrate + seed
npm run redis:upstash:test # Upstash connectivity
bash scripts/setup-local-demo.sh  # Local Docker demo only
```

---

*Last updated: 2026-05-19 — canonical go-live doc for Forge-Studios-dev/FORGE*
