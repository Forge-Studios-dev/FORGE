# FORGE — Production upgrade checklist

**Audience:** DevOps / lead engineer moving from MVP free tier to stable public production.  
**Live stack (reference):**

| Resource | Name / URL |
|----------|------------|
| API (Fly) | `forge-studios-api` → `https://api.forgestudios.net/api/v1` |
| Worker (Fly) | `forge-studios-worker` |
| Web (Vercel) | `https://forgestudios.net` |
| Admin (Vercel) | `https://admin.forgestudios.net` |
| Region | Fly `bom` (Mumbai), AWS `ap-south-1`, Neon near Mumbai when possible |

**Related:** [PRODUCTION_INFRASTRUCTURE_GUIDE.md](./PRODUCTION_INFRASTRUCTURE_GUIDE.md) (strategy + step-by-step roadmap) · [MVP_GO_LIVE.md](./MVP_GO_LIVE.md) · [DOMAIN_FORGESTUDIOS.md](./DOMAIN_FORGESTUDIOS.md) · [AWS_MUX_SETUP.md](./AWS_MUX_SETUP.md) · [FORGE_PROJECT_MASTER.md §25](./FORGE_PROJECT_MASTER.md#25-production-readiness) · [REDIS.md](./REDIS.md)

---

## How to use this doc

Work **top to bottom**. Each phase has verify commands. Do not skip **Phase 1 (Redis)** if health shows `redis: down` or queues fail.

Estimated effort: **4–8 hours** first pass (excluding DNS propagation).

---

## Phase 0 — Baseline (before spending money)

- [ ] `fly auth whoami` succeeds
- [ ] `fly status -a forge-studios-api` — at least one healthy machine
- [ ] `fly status -a forge-studios-worker` — worker running (video uploads depend on it)
- [ ] Production smoke passes:

```bash
npm run smoke:api:prod
npm run check:production   # smoke + metrics + Grafana (if tokens configured)
```

- [ ] CORS exact match (no trailing slash):

```bash
fly secrets list -a forge-studios-api | grep -E 'WEB_URL|ADMIN_URL'
# WEB_URL=https://forgestudios.net
# ADMIN_URL=https://admin.forgestudios.net
```

- [ ] Vercel production env (both web + admin projects):

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_API_URL` | `https://api.forgestudios.net/api/v1` |
| `API_INTERNAL_URL` | `https://api.forgestudios.net/api/v1` (web only) |
| `NEXT_PUBLIC_APP_URL` | `https://forgestudios.net` (web) |
| `NEXT_PUBLIC_WEB_URL` | `https://forgestudios.net` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.forgestudios.net` (admin) |

- [ ] **Auth refresh cookie** (cross-subdomain web + API) — see [AUTH_SESSION.md](./AUTH_SESSION.md):

```bash
fly secrets set AUTH_REFRESH_COOKIE_DOMAIN='.forgestudios.net' --app forge-studios-api
```

Web and admin API clients must use `withCredentials: true` (already configured). After deploy, verify login → refresh → logout on one device does not sign out other browsers until “Sign out on all devices”.

---

## Phase 1 — Redis Cloud (highest priority)

**Provider:** [Redis Cloud](https://redis.io/cloud/) — Essentials **250MB+** for production.

**FORGE requirement:** Set **`REDIS_URL` only** (Redis protocol). Upstash REST vars (`UPSTASH_REDIS_REST_*`) are **not** used. Code: `apps/api/src/config/resolve-redis-url.ts`. Runbook: [REDIS.md](./REDIS.md).

| Step | Action |
|------|--------|
| 1 | Redis Cloud → your DB → **Connect** → copy CLI URL (`redis://` or `rediss://` — use **exactly** what the console shows) |
| 2 | Region: **AWS ap-south-1** (or closest to Fly `bom`) |
| 3 | Set on API; remove legacy Upstash secrets; sync worker |

```bash
fly secrets set \
  REDIS_URL='redis://default:YOUR_PASSWORD@YOUR-HOST.db.redis.io:13195' \
  --app forge-studios-api

fly secrets unset UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN --app forge-studios-api

npm run sync:fly:worker-secrets
```

| Plan | When | Rough cost |
|------|------|------------|
| Essentials 250MB | Production (current) | ~$10–30/mo |
| Essentials 1GB+ | Heavy BullMQ + cache | Scale up in console |

Local: `apps/api/.env` → `REDIS_URL=...` (see `apps/api/.env.redis-cloud.example`), then `npm run redis:test`.

### Verify Redis

```bash
curl -sS 'https://api.forgestudios.net/api/v1/health' | jq .
# Expect: redis: ok, videoQueue: ok (when worker up)

curl -sS 'https://api.forgestudios.net/api/v1/videos/feed?limit=1&sort=latest' | head -c 300
```

---

## Phase 2 — Neon Postgres

**Console:** [console.neon.tech](https://console.neon.tech)

### Recommended plan

| Stage | Neon plan | Why |
|-------|-----------|-----|
| Public beta | **Launch** or **Scale** (smallest paid) | PITR, higher compute, no hobby suspend |
| Growth | **Scale** with autoscaling compute | Handles connection spikes from Fly |

### Configuration

- [ ] Connection string: **Pooled** host (`-pooler` in hostname)
- [ ] `?sslmode=require` on `DATABASE_URL`
- [ ] Enable **point-in-time recovery** (Scale)
- [ ] Project region: **AWS ap-southeast-1** or **ap-south-1** (align with Fly `bom`)

### Fly secrets

```bash
fly secrets set \
  DATABASE_URL='postgresql://USER:PASS@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' \
  DB_POOL_MAX='10' \
  --app forge-studios-api
```

**Pool sizing:** `DB_POOL_MAX=10` per API machine. If you run **2 API machines**, use `8` each (stay under Neon connection limits; pooled endpoint helps).

### Migrations (production)

```bash
# apps/api/.env must point at Neon (not localhost)
npm run db:neon:setup    # migrate + seed (seed only when you intend demo users)
```

### Verify DB

```bash
curl -sS 'https://api.forgestudios.net/api/v1/health' | jq '.checks.database'
```

---

## Phase 3 — Fly.io compute (API + worker)

### 3.1 API — avoid cold starts in production

Edit `fly.toml` for production traffic:

```toml
[http_service]
  auto_stop_machines = false   # was 'stop' — prevents cold ~5s delays
  min_machines_running = 1
```

Then redeploy:

```bash
fly deploy -a forge-studios-api
```

### 3.2 VM sizing (current defaults are OK)

| App | `fly.toml` | Notes |
|-----|------------|-------|
| API | `2048mb`, 2 shared CPUs | Good for Nest + Socket.IO |
| Worker | `2048mb`, 2 shared CPUs | FFmpeg needs RAM; scale replicas before shrinking |

### 3.3 Scale worker when queue backs up

```bash
fly scale count 2 -a forge-studios-worker   # example: 2 worker machines
fly logs -a forge-studios-worker
```

Watch health: `checks.videoQueue` on API health endpoint.

### 3.4 Second API machine (realtime / traffic)

Only after Redis `REDIS_URL` is stable (Socket.IO Redis adapter):

```bash
fly scale count 2 -a forge-studios-api
```

Confirm logs: no `Socket.IO Redis adapter failed` on either machine.

---

## Phase 4 — Complete Fly secrets (API)

Set any missing secrets. **Never commit values to git.**

### Required (core)

| Secret | Example / notes |
|--------|-----------------|
| `DATABASE_URL` | Neon pooled URL |
| `DB_POOL_MAX` | `10` |
| `REDIS_URL` | `rediss://...` (Phase 1) |
| `JWT_SECRET` | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64` |
| `NODE_ENV` | `production` |
| `WEB_URL` | `https://forgestudios.net` |
| `ADMIN_URL` | `https://admin.forgestudios.net` |

### Video (VOD)

| Secret | Notes |
|--------|-------|
| `AWS_REGION` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM user `forge-api-media` |
| `AWS_SECRET_ACCESS_KEY` | |
| `S3_BUCKET_NAME` | e.g. `forge-media-prod` |
| `CLOUDFRONT_DOMAIN` | `https://dxxxx.cloudfront.net` — **https**, no trailing slash |

Details: [AWS_MUX_SETUP.md](./AWS_MUX_SETUP.md)

### Live (Mux)

| Secret | Notes |
|--------|-------|
| `MUX_TOKEN_ID` | |
| `MUX_TOKEN_SECRET` | |
| `MUX_WEBHOOK_SECRET` | Webhook URL: `https://api.forgestudios.net/api/v1/streams/webhooks/mux` |

### Observability (recommended)

| Secret | Notes |
|--------|-------|
| `SENTRY_DSN` | API project in Sentry |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` (adjust) |
| `METRICS_ENABLED` | `true` |
| `METRICS_SCRAPE_TOKEN` | Long random; Grafana scrape uses Bearer |

### Optional

| Secret | Notes |
|--------|-------|
| `SMTP_*`, `MAIL_FROM` | Password reset / verification email |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | When using OTLP collector |
| `MUX_*` | Omit if live not launched |

### One-shot set (template)

```bash
fly secrets set \
  DATABASE_URL='postgresql://...' \
  DB_POOL_MAX='10' \
  REDIS_URL='rediss://...' \
  JWT_SECRET='...' \
  JWT_REFRESH_SECRET='...' \
  WEB_URL='https://forgestudios.net' \
  ADMIN_URL='https://admin.forgestudios.net' \
  AWS_REGION='ap-south-1' \
  AWS_ACCESS_KEY_ID='AKIA...' \
  AWS_SECRET_ACCESS_KEY='...' \
  S3_BUCKET_NAME='forge-media-prod' \
  CLOUDFRONT_DOMAIN='https://dxxxx.cloudfront.net' \
  SENTRY_DSN='https://...@....ingest.sentry.io/...' \
  SENTRY_TRACES_SAMPLE_RATE='0.1' \
  METRICS_ENABLED='true' \
  METRICS_SCRAPE_TOKEN='...' \
  NODE_ENV='production' \
  --app forge-studios-api
```

Fly redeploys automatically after `secrets set`.

---

## Phase 5 — Worker secrets

Worker must match API for DB, Redis, AWS, JWT, CORS.

```bash
npm run sync:fly:worker-secrets
```

This sets at minimum: `WORKER_ONLY=true`, `DATABASE_URL`, `REDIS_URL`, `AWS_*`, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN`, `JWT_*`, `WEB_URL`, `ADMIN_URL`.

Manual deploy worker:

```bash
npm run deploy:fly:worker
# or: fly deploy -c fly.worker.toml -a forge-studios-worker
```

### Verify video pipeline

```bash
npm run verify:video-pipeline:prod
# Optional real S3 PUT:
# FORGE_PIPELINE_PUT=1 npm run verify:video-pipeline:prod
```

---

## Phase 6 — Vercel

| Item | Action |
|------|--------|
| Plan | **Pro** when you need team, more bandwidth, or commercial use |
| Domains | `forgestudios.net`, `admin.forgestudios.net` — [DOMAIN_FORGESTUDIOS.md](./DOMAIN_FORGESTUDIOS.md) |
| Env | Table in Phase 0 — redeploy after changes |
| Sentry (web) | `SENTRY_DSN` / Next.js Sentry SDK if configured in app |

---

## Phase 7 — AWS S3 + CloudFront

- [ ] Bucket **private** (block public access)
- [ ] CORS for `forgestudios.net`, `admin.forgestudios.net`, localhost — [AWS_MUX_SETUP.md §1.2](./AWS_MUX_SETUP.md)
- [ ] IAM least privilege (`s3:PutObject`, `GetObject`, `DeleteObject` on prefix)
- [ ] CloudFront origin = S3; `CLOUDFRONT_DOMAIN` on API + worker
- [ ] Optional: S3 **versioning** + lifecycle (delete raw uploads after transcode)

Re-apply CORS if needed:

```bash
./scripts/fix-s3-cors.sh
```

---

## Phase 8 — Security hardening

- [ ] Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MUX_WEBHOOK_SECRET` (invalidates sessions — plan window)
- [ ] Rotate Neon password / update `DATABASE_URL` on Fly
- [ ] Rate limits: `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX` — review under load
- [ ] **Cloudflare** (optional): proxy `api.forgestudios.net` + web — WAF, DDoS, bot rules
- [ ] GitHub branch protection: require `CI` on `main` — [CI_CD.md](./CI_CD.md)
- [ ] Never push directly to `main` (production deploy gate)

---

## Phase 9 — Observability & on-call

| Tool | Setup |
|------|--------|
| **Uptime** | External ping `GET https://api.forgestudios.net/api/v1/health` every 1–5 min |
| **Sentry** | Alerts on new issues / regression |
| **Grafana** | `npm run verify:grafana-metrics` — dashboard `forge-api` |
| **Logs** | `fly logs -a forge-studios-api` / worker |

Enable metrics on API (if not already):

```bash
fly secrets set METRICS_ENABLED=true METRICS_SCRAPE_TOKEN='...' --app forge-studios-api
```

Full guide: [OBSERVABILITY.md](./OBSERVABILITY.md)

---

## Phase 10 — Staging environment (recommended)

| Layer | Staging suggestion |
|-------|-------------------|
| Fly API | `forge-studios-api-staging` (copy `fly.toml`, change `app`) |
| Fly worker | `forge-studios-worker-staging` |
| Neon | **Branch** `staging` from production project |
| Vercel | Preview env or second project `staging.forgestudios.net` |
| Redis | Separate Redis Cloud DB (never share prod Redis) |

Workflow: PR → CI → deploy staging → smoke → merge `main` → single production release ([release.yml](../.github/workflows/release.yml)).

---

## Phase 11 — CI/CD secrets (GitHub)

```bash
npm run gh:secrets        # print required names
npm run gh:secrets:set    # interactive setup
```

| Secret | Used for |
|--------|----------|
| `FLY_API_TOKEN` | Deploy API + worker |
| `VERCEL_TOKEN` | Deploy web + admin |
| `VERCEL_ORG_ID` | |
| `VERCEL_PROJECT_ID_WEB` | |
| `VERCEL_PROJECT_ID_ADMIN` | |

Reference: [CI_CD.md](./CI_CD.md)

---

## Master verification script

After Phases 1–9:

```bash
npm run check:production
npm run verify:video-pipeline:prod
```

### Manual MVP matrix

[mvp-test-matrix.md](./mvp-test-matrix.md) — guest, viewer, creator upload, admin, impersonation.

---

## Cost planner (monthly, order of magnitude)

| Service | Early production | Notes |
|---------|------------------|-------|
| Fly API + worker | $30–80 | 2× 2GB machines, minimal scale |
| Neon Scale | $19–69+ | Depends on storage/compute |
| Redis Cloud | $10–50 | Essentials 250MB+ |
| Vercel | $0–20 | Pro if commercial |
| AWS S3 + CloudFront | $20–500+ | **Dominates** with video traffic |
| Mux | Usage-based | Live only |
| Sentry | $0–26 | Team tier later |

---

## Redis decision matrix (quick pick)

| Situation | Choose |
|-----------|--------|
| Production Redis | **Redis Cloud** + `REDIS_URL` |
| Need more RAM / connections | Scale Redis Cloud plan in `ap-south-1` |
| All-in on AWS later | ElastiCache (only when API also on AWS/VPC) |

---

## Rollback

| Change | Rollback |
|--------|----------|
| Bad Fly deploy | `fly releases -a forge-studios-api` → `fly deploy --image <previous>` |
| Bad secret | `fly secrets set` previous value; machines restart |
| Bad migration | Neon PITR restore to branch; fix migration; re-run |
| Redis cutover issue | Revert `REDIS_URL`; `sync:fly:worker-secrets` |

---

## Deferred (do not do until metrics say so)

See [phase4-platform-evaluation.md](./phase4-platform-evaluation.md):

- Meilisearch / Elasticsearch
- Kubernetes
- Kafka
- Vector DB / ML feed
- MediaConvert (until FFmpeg queue is the bottleneck)

---

*Last updated: 2026-05-29 — pairs with live `forgestudios.net` + `forge-studios-api` Fly apps.*
