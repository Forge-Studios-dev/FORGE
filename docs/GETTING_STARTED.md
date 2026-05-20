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

# Option A — Docker Postgres + Redis (default in .env.example)
docker compose up postgres redis -d
bash scripts/setup-local-demo.sh

# Option B — Cloud DB (you already use Neon + Upstash)
# Edit apps/api/.env: DATABASE_URL + UPSTASH_REDIS_REST_*
npm run db:neon:setup
npm run redis:upstash:test
```

**Run apps** (three terminals):

```bash
npm run dev:api      # http://localhost:3001
npm run dev:web      # http://localhost:3000
npm run dev:admin    # http://localhost:3002
```

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

---

## Environment templates

| File | Purpose |
|------|---------|
| `apps/api/.env.example` | Local API defaults |
| `apps/api/.env.neon.example` | Neon Postgres |
| `apps/api/.env.upstash.example` | Upstash Redis |
| `apps/web/.env.example` | Web app |
| `apps/admin/.env.example` | Admin panel |

**Never commit** `apps/api/.env` or `*.env.local` (gitignored).

---

## Mobile (optional)

```bash
cd apps/mobile
flutter pub get
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
npm run db:neon:setup          # Neon migrate + seed
npm run redis:upstash:test     # Upstash ping
bash scripts/setup-local-demo.sh
```

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
| **All documentation** | [README.md](./README.md) |
