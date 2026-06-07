# Deploy & production

**First deploy:** steps below · **Upgrade paid tiers:** Phase checklist at end · **Architecture:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)

| URL | Host |
|-----|------|
| Web | Vercel → `forgestudios.net` |
| Admin | Vercel → `admin.forgestudios.net` |
| API | Fly `forge-studios-api` → `api.forgestudios.net` |
| Worker | Fly `forge-studios-worker` (`WORKER_ONLY=true`) |

---

## Stack (MVP)

Vercel (web/admin) · Fly (API + worker) · Neon (Postgres pooled URL) · Redis Cloud (`REDIS_URL` only)

**Works without AWS/Mux:** auth, feed, search, admin, engagement.  
**Needs AWS + worker + Mux:** upload, live. See [MEDIA.md](./MEDIA.md).

---

## 1. Neon

1. [console.neon.tech](https://console.neon.tech) → pooled connection string with `sslmode=require`
2. `apps/api/.env`: `DATABASE_URL=...`
3. `npm run db:neon:setup`

---

## 2. Redis

1. [Redis Cloud](https://redis.io/cloud/) → copy URL exactly (`redis://` or `rediss://`)
2. `REDIS_URL=...` in `apps/api/.env`
3. `npm run redis:test`

**Fly:**

```bash
fly secrets set REDIS_URL='redis://...' --app forge-studios-api
fly secrets unset UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN --app forge-studios-api
npm run sync:fly:worker-secrets
```

**Not supported:** Upstash REST-only vars.

---

## 3. Fly API

```bash
fly auth login
bash scripts/fly-setup.sh   # or: fly deploy after secrets
```

**Secrets (minimum):**

```bash
fly secrets set \
  DATABASE_URL='postgresql://...-pooler.../neondb?sslmode=require' \
  REDIS_URL='redis://...' \
  JWT_SECRET="$(openssl rand -base64 64)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 64)" \
  NODE_ENV=production \
  --app forge-studios-api
```

After Vercel URLs exist:

```bash
fly secrets set \
  WEB_URL='https://forgestudios.net' \
  ADMIN_URL='https://admin.forgestudios.net' \
  AUTH_REFRESH_COOKIE_DOMAIN='.forgestudios.net' \
  --app forge-studios-api
```

**Verify:** `curl -s https://api.forgestudios.net/api/v1/health`

**Do not** set `ENABLE_VIDEO_WORKER` on API. Deploy worker separately:

```bash
npm run deploy:fly:worker
npm run sync:fly:worker-secrets
```

---

## 4. Vercel (web + admin)

Two projects: root `apps/web` and `apps/admin`. Enable “Include source files outside Root Directory”.

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.forgestudios.net/api/v1` |
| `API_INTERNAL_URL` | same (web only) |
| `NEXT_PUBLIC_APP_URL` | `https://forgestudios.net` |

```bash
npm run deploy:vercel
```

---

## 5. Custom domain (Squarespace DNS)

| Host | Points to |
|------|-----------|
| `@` / `www` | Vercel (web) |
| `admin` | Vercel (admin) |
| `api` | Fly (`fly certs add api.forgestudios.net`) |

Details: Vercel **Settings → Domains** + `fly certs show api.forgestudios.net`.

---

## 6. Verify

```bash
npm run smoke:api:prod
npm run check:production
```

QA by role: [QA.md](./QA.md)

---

## Remote demo without cloud (optional)

Run locally, expose with [ngrok](https://ngrok.com): `ngrok http 3000` / `3001` / `3002`, set `NEXT_PUBLIC_API_URL`, `WEB_URL`, `ADMIN_URL` to tunnel URLs, restart apps.

---

## Production upgrade phases

| Phase | Action |
|-------|--------|
| 0 | Baseline smoke + CORS URLs match Vercel (no trailing slash) |
| 1 | Redis Cloud paid tier; sync worker secrets |
| 2 | Fly API always-on; strong JWT + `MUX_WEBHOOK_SECRET` |
| 3 | S3 + Mux + worker — [MEDIA.md](./MEDIA.md) |
| 4 | `METRICS_ENABLED`, Sentry — [OBSERVABILITY.md](./OBSERVABILITY.md) |
| 5 | Google/SMTP/FCM — [AUTH.md](./AUTH.md) · [FIREBASE.md](./FIREBASE.md) |

**Rotate leaked secrets:** Fly/Vercel dashboards + Mux/AWS consoles; never commit `.env`.

**Rollback:** `fly releases rollback` · Vercel promote previous deployment.

**Automatic rollback (Release workflow):** If post-deploy smoke or metrics verification fails, GitHub Actions runs `flyctl releases rollback` on the API (and worker if its deploy job fails). This reverts the **app image only** — not database migrations. Failed `release_command` migrations block deploy before traffic shifts; if smoke fails after a successful migration, assess whether schema rollback is needed separately (`npm run migration:revert` — see [DISASTER_RECOVERY.md](./operations/DISASTER_RECOVERY.md)).

---

## CI/CD

Push feature branch → PR → merge `main` once (triggers CI then release). Never push directly to `main`. Details: [CI_CD.md](./CI_CD.md).
