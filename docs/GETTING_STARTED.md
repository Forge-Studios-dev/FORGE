# Getting started (local development)

**Repo:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

---

## Quick start (~10 minutes)

```bash
git clone https://github.com/Forge-Studios-dev/FORGE.git
cd FORGE
npm install

# Env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

# Option A — Docker Postgres + Redis + worker (recommended)
docker compose up postgres redis -d
docker compose up worker -d   # FFmpeg / BullMQ (WORKER_ONLY)
bash scripts/setup-local-demo.sh

# Option B — Cloud DB (Neon + Redis Cloud)
# Edit apps/api/.env: DATABASE_URL + REDIS_URL
npm run db:neon:setup
npm run redis:test
```

**Run apps** (three terminals):

```bash
npm run dev:api      # http://localhost:3001 (HTTP only — no FFmpeg)
npm run dev:web      # http://localhost:3000
npm run dev:admin    # http://localhost:3002
```

For **video transcoding** locally, either run `docker compose up worker -d` or set `ENABLE_VIDEO_WORKER=true` in `apps/api/.env` (not for production API).

| Service | URL |
|---------|-----|
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Web | http://localhost:3000 |
| Admin | http://localhost:3002 |

---

## Demo logins

| Email | Password | Use |
|-------|----------|-----|
| `viewer@forge.local` | `ForgeDemo123!` | Web / mobile |
| `admin@forge.local` | `ForgeAdmin123!` | Admin only (`:3002`) |

Reset roles: `bash scripts/reset-demo-users.sh`  
API smoke test: `npm run smoke:api`  
Memberships / live / community smoke: `npm run smoke:memberships` (see [MEMBERSHIPS.md](./MEMBERSHIPS.md))  
Web E2E: `cd apps/web && npm run test:e2e`  
Auth architecture (sessions, cookies, middleware): [AUTH_SESSION.md](./AUTH_SESSION.md)  
Firebase (FCM, App Check, OAuth — optional): [firebase/README.md](./firebase/README.md)

---

## Environment templates

| File | Purpose |
|------|---------|
| `apps/api/.env.example` | Local API defaults |
| `apps/api/.env.neon.example` | Neon Postgres |
| `apps/api/.env.redis-cloud.example` | Redis Cloud |
| `apps/web/.env.example` | Web app |
| `apps/admin/.env.example` | Admin panel |

**Never commit** `apps/api/.env` or `*.env.local` (gitignored).

---

## Mobile (optional)

```bash
cd apps/mobile
flutter pub get
# Optional: FCM push after `flutterfire configure` (see docs/firebase/CLI_SETUP.md)
flutter run
# Physical device: point API at your LAN IP
flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3001/api/v1
```

---

## Useful commands

```bash
npm run dev:api | dev:web | dev:admin
npm run build:all
npm run ci                     # Same checks as GitHub CI
npm run lint
npm run test
npm run deploy:fly             # Fly API (production)
npm run deploy:fly:worker        # Fly worker (video transcode)
npm run db:neon:setup          # Neon migrate + seed
npm run redis:test             # Redis ping
bash scripts/setup-local-demo.sh
```

**Feature flags** (optional): `FEATURE_FLAGS` in `apps/api/.env`, `NEXT_PUBLIC_FEATURE_FLAGS` in web — see `GET /api/v1/platform/config`.  
Large uploads (≥50MB): enable `multipart_upload` in API flags. See [VIDEO_UPLOAD.md](./VIDEO_UPLOAD.md).

Pre-deploy checklist: `npm run verify:production`

---

## What works without AWS / Mux

Auth, feed, explore, search, admin, roles, comments, follows — full MVP UI.  
Upload transcoding and live streaming need AWS S3 and Mux credentials in `apps/api/.env`.

---

## Next steps

| Goal | Doc |
|------|-----|
| **Deploy MVP online** | [MVP_GO_LIVE.md](./MVP_GO_LIVE.md) |
| **GitHub Actions / secrets** | [CI_CD.md](./CI_CD.md) |
| **Test by role** | [mvp-test-matrix.md](./mvp-test-matrix.md) |
| **Share with client** | [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) |
| **Observability** | [OBSERVABILITY.md](./OBSERVABILITY.md) |
| **Audit / hardening log** | [PLATFORM_AUDIT_REMEDIATION.md](./PLATFORM_AUDIT_REMEDIATION.md) |
| **All documentation** | [README.md](./README.md) |
