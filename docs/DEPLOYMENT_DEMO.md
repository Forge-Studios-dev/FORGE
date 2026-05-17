# FORGE — Client demo deployment guide

Use this when you need to **show the product to a client** (local screen share, remote URL, or a small VPS).

## What you are deploying

| Piece | Port (local) | Required for demo? |
|-------|----------------|-------------------|
| **API** (NestJS) | 3001 | Yes |
| **Web** (Next.js) | 3000 | Yes |
| **Admin** (Next.js) | 3002 | Yes (moderation, impersonation) |
| **Postgres + Redis** | 5432, 6379 | Yes |
| **Worker** (FFmpeg/BullMQ) | — | Only if you demo **video upload → processing** |
| **Mobile** (Flutter) | — | Optional (simulator or APK) |
| **AWS S3 + CloudFront** | — | Only for real uploads / CDN playback |
| **Mux** | — | Only for **live streaming** demo |

Most UI flows (auth, feed, explore, admin, roles) work **without** AWS/Mux. Upload and go-live need those credentials.

---

## Path A — Local demo (fastest, ~15 minutes)

Best for: **in-person or screen share** on your laptop.

### 1. Prerequisites

- Docker Desktop (running)
- Node.js 20+ and npm 10+
- (Optional) Flutter 3.19+ for mobile

### 2. Automated setup

```bash
cd /path/to/FORGE
bash scripts/setup-local-demo.sh
```

This creates `apps/api/.env`, `apps/web/.env.local`, `apps/admin/.env.local`, starts Postgres/Redis, installs deps, and seeds demo users.

### 3. Run apps (recommended: native API, not stale Docker API image)

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web

# Terminal 3
npm run dev:admin
```

> **Important:** Prefer `npm run dev:api` over the Docker `api` service for demos. The compose API image can lag behind your latest code (see `docs/mvp-test-matrix.md`).

### 4. Verify

```bash
bash scripts/smoke-api.sh
```

Open:

- Web: http://localhost:3000  
- Admin: http://localhost:3002  
- API docs: http://localhost:3001/api/docs  

### 5. Demo accounts

| Email | Password | Use |
|-------|----------|-----|
| `viewer@forge.local` | `ForgeDemo123!` | Web / mobile (viewer) |
| `admin@forge.local` | `ForgeAdmin123!` | Admin panel only |

Reset roles if needed: `bash scripts/reset-demo-users.sh`

### 6. Mobile (optional)

```bash
cd apps/mobile
flutter pub get
# Point API at your machine IP if using a physical device:
flutter run --dart-define=API_BASE_URL=http://YOUR_LAN_IP:3001/api/v1
```

---

## Path B — Remote demo without a server (ngrok / Cloudflare Tunnel)

Best for: **client joins from their office** while you run locally.

1. Complete **Path A** (API + web + admin running).
2. Expose ports (example with [ngrok](https://ngrok.com)):

```bash
ngrok http 3000   # web → share this URL
ngrok http 3002   # admin (second tunnel or paid plan)
ngrok http 3001   # API
```

3. Update env and restart frontends:

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-NGROK-URL/api/v1
NEXT_PUBLIC_APP_URL=https://YOUR-WEB-NGROK-URL
```

**`apps/admin/.env.local`**

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-NGROK-URL/api/v1
```

**`apps/api/.env`**

```env
WEB_URL=https://YOUR-WEB-NGROK-URL
ADMIN_URL=https://YOUR-ADMIN-NGROK-URL
```

4. Restart `dev:web`, `dev:admin`, and `dev:api` so CORS and cookies match the public URLs.

---

## Path C — Single VPS (production-like, client URL)

Best for: **stable HTTPS link** for several days (e.g. `demo.yourcompany.com`).

### 1. Server

- **Ubuntu 22.04+** or Amazon Linux 2023
- **4 GB RAM** minimum (8 GB if worker transcodes video)
- Open ports **80, 443** (and **22** for SSH)

### 2. Install on the server

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# log out and back in
```

Clone the repo to e.g. `/opt/forge`.

### 3. Environment files

```bash
cd /opt/forge
cp compose.prod.env.example .env
# Edit .env — strong DB_PASSWORD and REDIS_PASSWORD

cp apps/api/.env.production.example apps/api/.env.production
cp apps/web/.env.production.example apps/web/.env.production
cp apps/admin/.env.production.example apps/admin/.env.production
```

Set in **`apps/api/.env.production`**:

- `JWT_SECRET` / `JWT_REFRESH_SECRET` — `openssl rand -base64 64` (twice)
- `DATABASE_URL` / `REDIS_URL` — must match root `.env` passwords and Docker service hostnames (`postgres`, `redis`)
- `WEB_URL` / `ADMIN_URL` — your real public URLs
- AWS + Mux — only if demoing upload/live

Set in **web/admin production env**:

- `NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1` (or `https://api.your-domain.com/api/v1`)

### 4. DNS

Point records to the server IP:

- `demo.yourcompany.com` → web + API (via nginx)
- `admin.demo.yourcompany.com` → admin panel

Update `infra/nginx/nginx.conf` `server_name` values to match your domains.

### 5. TLS certificates

```bash
sudo apt install -y certbot
# Stop anything on :80, obtain certs, then copy into infra/nginx/ssl/
sudo certbot certonly --standalone -d demo.yourcompany.com -d admin.demo.yourcompany.com
sudo mkdir -p infra/nginx/ssl
sudo cp /etc/letsencrypt/live/demo.yourcompany.com/fullchain.pem infra/nginx/ssl/
sudo cp /etc/letsencrypt/live/demo.yourcompany.com/privkey.pem infra/nginx/ssl/
```

### 6. Build and start

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Seed once (from host, with API env pointing at DB):

```bash
docker compose -f docker-compose.prod.yml exec api node -e "require('./dist/database/seeds/run-seed')" 
# Or run seed from a one-off container with DATABASE_URL set — see README seed command.
```

On first deploy, run seed from your machine against the server DB if exec is awkward:

```bash
DATABASE_URL=postgresql://forge:PASSWORD@SERVER_IP:5432/forge_db npm run seed --workspace=apps/api
```

(open Postgres port only temporarily or use SSH tunnel)

### 7. CI deploy (optional)

Push to `main` triggers GitHub Actions (`.github/workflows/api.yml`, `web.yml`) if these secrets exist:

- `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
- Images pull from GHCR; server runs `docker compose -f docker-compose.prod.yml up -d`

---

## Pre-demo checklist

- [ ] Postgres healthy: `docker compose ps`
- [ ] `bash scripts/smoke-api.sh` passes
- [ ] Log in as `viewer@forge.local` on web — feed, explore, watch
- [ ] Log in as `admin@forge.local` on **:3002** — dashboard, users, reports
- [ ] Decide: skip upload/live **or** configure AWS S3 + Mux and test one upload
- [ ] Browser: incognito window for clean guest → viewer flow
- [ ] Prepare 2–3 talking points from `docs/CLIENT_OVERVIEW.md`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API 401 / CORS | `WEB_URL` / `ADMIN_URL` in API `.env` must match browser origin |
| Hydration error on web | Hard refresh; ensure `NEXT_PUBLIC_API_URL` is consistent |
| Admin login fails | Use `admin@forge.local` on **port 3002**, not web |
| Stale API behavior | `docker compose stop api` → use `npm run dev:api` |
| Upload fails | Expected without AWS keys; show UI flow or pre-seed a ready video |
| Redis connection in prod | `REDIS_URL` must include password: `redis://:PASSWORD@redis:6379` |

---

## Suggested demo script (15 min)

1. **Guest** — home, explore, watch (no login).
2. **Viewer** — sign in, like/comment, library, “Become a creator”.
3. **Admin** — pending creators, reports, impersonate viewer in new tab.
4. **(Optional)** Approved creator — Studio, upload (if S3 configured).

Full test matrix: `docs/mvp-test-matrix.md`.
