# Deploy FORGE with Vercel + Fly.io + Neon + Upstash

Target repo: [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

| Service | Hosts | Free tier |
|---------|--------|-----------|
| **Web** (`apps/web`) | Vercel | Hobby |
| **Admin** (`apps/admin`) | Vercel | Hobby |
| **API** (`apps/api`) | Fly.io | Limited free allowance |
| **Postgres** | [Neon](https://neon.tech) | Free |
| **Redis** | [Upstash](https://upstash.com) | Free |

GitHub Actions workflows (on push to `main`):

- `.github/workflows/deploy-vercel.yml` — web + admin
- `.github/workflows/deploy-fly.yml` — API

---

## Architecture

```
Browser → Vercel (web :3000, admin :3002)
              ↓ NEXT_PUBLIC_API_URL
         Fly.io (API :3001)
              ↓
    Neon (Postgres) + Upstash (Redis)
```

---

## Step 1 — Neon (database)

1. Create project at [neon.tech](https://neon.tech).
2. Copy **pooled** connection string, e.g.  
   `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. Save as `DATABASE_URL` for Fly (Step 4).

Migrations run automatically on API startup (`migrationsRun: true`).

**Seed demo users once** (from your laptop with tunnel or after API is up):

```bash
DATABASE_URL='postgresql://...' npm run seed --workspace=apps/api
```

---

## Step 2 — Upstash (Redis)

1. Create database at [upstash.com](https://upstash.com) (region near Fly: Mumbai `bom` if possible).
2. Copy **Redis URL**, e.g. `rediss://default:xxx@xxx.upstash.io:6379`
3. Save as `REDIS_URL` for Fly.

---

## Step 3 — Fly.io (API)

### 3a. Install CLI & create app

```bash
# macOS
brew install flyctl
fly auth login

cd /path/to/FORGE
fly apps create forge-studios-api
# If name is taken, edit app name in fly.toml and retry
```

### 3b. Set secrets

```bash
fly secrets set \
  DATABASE_URL='postgresql://...' \
  REDIS_URL='rediss://...' \
  JWT_SECRET="$(openssl rand -base64 64)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 64)" \
  WEB_URL='https://YOUR-WEB.vercel.app' \
  ADMIN_URL='https://YOUR-ADMIN.vercel.app' \
  NODE_ENV=production
```

Optional (upload/live demos only):

```bash
fly secrets set \
  AWS_ACCESS_KEY_ID='...' \
  AWS_SECRET_ACCESS_KEY='...' \
  S3_BUCKET_NAME='...' \
  AWS_REGION='ap-south-1' \
  MUX_TOKEN_ID='...' \
  MUX_TOKEN_SECRET='...'
```

### 3c. First deploy (manual)

```bash
fly deploy
```

API URL: `https://forge-studios-api.fly.dev`  
Health: `https://forge-studios-api.fly.dev/api/v1/health`

### 3d. GitHub Actions (CI deploy)

1. Create token: [fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens)
2. Repo → **Settings → Secrets → Actions** → add `FLY_API_TOKEN`
3. Push to `main` or run workflow **Deploy API (Fly.io)** manually.

---

## Step 4 — Vercel (web + admin)

Create **two** projects from the same GitHub repo.

### 4a. Web project

1. [vercel.com/new](https://vercel.com/new) → Import `Forge-Studios-dev/FORGE`
2. **Root Directory:** `apps/web`
3. Framework: Next.js (auto)
4. **Environment variables** (Production):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://forge-studios-api.fly.dev/api/v1` |
| `API_INTERNAL_URL` | same as above |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-WEB.vercel.app` (set after first deploy) |
| `NEXT_PUBLIC_ADMIN_URL` | `https://YOUR-ADMIN.vercel.app` |

5. Deploy once from the dashboard (validates build).

### 4b. Admin project

1. New project → same repo
2. **Root Directory:** `apps/admin`
3. **Environment variables:**

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://forge-studios-api.fly.dev/api/v1` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://YOUR-ADMIN.vercel.app` |
| `NEXT_PUBLIC_WEB_URL` | `https://YOUR-WEB.vercel.app` |

### 4c. Link projects for GitHub Actions

```bash
npm i -g vercel@39
vercel login
vercel link --cwd apps/web    # note Project ID
vercel link --cwd apps/admin
```

Get **Org ID** from Vercel → Team Settings → General.

Create token: Vercel → Account Settings → Tokens.

### 4d. GitHub secrets (Vercel deploy workflow)

| Secret | Where to find |
|--------|----------------|
| `VERCEL_TOKEN` | Vercel account tokens |
| `VERCEL_ORG_ID` | Team / account settings |
| `VERCEL_PROJECT_ID_WEB` | Web project → Settings → General |
| `VERCEL_PROJECT_ID_ADMIN` | Admin project → Settings → General |

Enable Actions on the repo, then push to `main` or run **Deploy Web & Admin (Vercel)**.

---

## Step 5 — Wire CORS & URLs

After you know final Vercel URLs, update Fly:

```bash
fly secrets set \
  WEB_URL='https://forge-web-xxx.vercel.app' \
  ADMIN_URL='https://forge-admin-xxx.vercel.app'
```

Update Vercel env vars if URLs changed. Redeploy web + admin.

---

## Step 6 — Verify

```bash
curl -s https://forge-studios-api.fly.dev/api/v1/health | head
```

1. Open web URL → guest browse
2. Login `viewer@forge.local` / `ForgeDemo123!` (after seed)
3. Open admin URL → `admin@forge.local` / `ForgeAdmin123!`

---

## Demo accounts

| Email | Password | App |
|-------|----------|-----|
| `viewer@forge.local` | `ForgeDemo123!` | Web |
| `admin@forge.local` | `ForgeAdmin123!` | Admin |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Vercel build: workspace not found | Root Directory must be `apps/web` or `apps/admin`; `vercel.json` installs from repo root |
| API 502 on Fly | `fly logs`; check `DATABASE_URL` and `REDIS_URL` |
| CORS errors | `WEB_URL` / `ADMIN_URL` on Fly must match browser origins exactly |
| Login works locally, not prod | Re-run seed against Neon `DATABASE_URL` |
| Workflows skip | Add all secrets; enable Actions on repo |

---

## Optional: custom domain

- **Vercel:** Project → Domains → add `app.yourdomain.com` / `admin.yourdomain.com`
- **Fly:** `fly certs add api.yourdomain.com` then update DNS CNAME
- Update all `NEXT_PUBLIC_*` and Fly `WEB_URL` / `ADMIN_URL`

---

## Cost note

Free tiers are fine for **client demos**. Video upload (FFmpeg worker) and live (Mux) need paid resources or stay disabled for the demo.
