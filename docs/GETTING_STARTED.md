# Getting started (local)

**Repo:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

## Quick start

```bash
git clone https://github.com/Forge-Studios-dev/FORGE.git && cd FORGE
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

docker compose up postgres redis -d
docker compose up worker -d
bash scripts/setup-local-demo.sh
```

**Run** (three terminals):

```bash
npm run dev:api      # :3001
npm run dev:web      # :3000
npm run dev:admin    # :3002
```

| Service | URL |
|---------|-----|
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Web | http://localhost:3000 |
| Admin | http://localhost:3002 |

## Demo logins

| Email | Password |
|-------|----------|
| `viewer@forge.local` | `ForgeDemo123!` |
| `admin@forge.local` | `ForgeAdmin123!` |

`bash scripts/reset-demo-users.sh` · `npm run smoke:api` · [QA.md](./QA.md)

## Env

See `apps/api/.env.example` (authoritative). Neon/Redis templates: `.env.neon.example`, `.env.redis-cloud.example`.

**VOD:** default `VIDEO_TRANSCODE_PROVIDER=mux` (needs Mux creds) or `ffmpeg` without Mux.  
**Flags:** `FEATURE_FLAGS=multipart_upload` for large files.

## Mobile

```bash
cd apps/mobile && flutter pub get && flutter run
flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3001/api/v1
```

FCM: [FIREBASE.md](./FIREBASE.md)

## Commands

```bash
npm run ci | build:all | smoke:api | db:neon:setup | redis:test
```

## Without AWS/Mux

Auth, feed, search, admin, engagement work. Upload/live need S3 + Mux — [MEDIA.md](./MEDIA.md).

## Next

| Goal | Doc |
|------|-----|
| API schemas | [API_SCHEMAS.md](./API_SCHEMAS.md) |
| Auth | [AUTH.md](./AUTH.md) |
| Deploy | [DEPLOY.md](./DEPLOY.md) |
| All docs | [README.md](./README.md) |
