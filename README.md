# FORGE – Live Creator Platform

Skill-first platform for learning journeys, tutorial videos, live teaching, and creator audiences.

**Repository:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

---

## Start here

| I want to… | Read |
|------------|------|
| **Run locally** | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| **Deploy MVP (free)** | [docs/MVP_GO_LIVE.md](docs/MVP_GO_LIVE.md) |
| **Domain forgestudios.net** | [docs/DOMAIN_FORGESTUDIOS.md](docs/DOMAIN_FORGESTUDIOS.md) |
| **Test after deploy** | [docs/mvp-test-matrix.md](docs/mvp-test-matrix.md) |
| **Show a client** | [docs/CLIENT_OVERVIEW.md](docs/CLIENT_OVERVIEW.md) |
| **Full specification** | [docs/FORGE_PROJECT_MASTER.md](docs/FORGE_PROJECT_MASTER.md) |
| **CI/CD & secrets** | [docs/CI_CD.md](docs/CI_CD.md) |
| **All docs** | [docs/README.md](docs/README.md) |

```bash
git clone https://github.com/Forge-Studios-dev/FORGE.git && cd FORGE
npm install && bash scripts/setup-local-demo.sh
npm run dev:api   # + dev:web, dev:admin in other terminals
```

---

## Apps

| App | Stack | Port / host |
|-----|--------|-------------|
| **API** | NestJS, TypeORM, BullMQ, Socket.IO | `:3001` / Fly.io |
| **Web** | Next.js 14 | `:3000` / Vercel |
| **Admin** | Next.js 14 | `:3002` / Vercel |
| **Mobile** | Flutter | iOS / Android |

---

## Tech stack

PostgreSQL · Redis · AWS S3 · Mux · FFmpeg · Docker · GitHub Actions

Recommended cloud MVP: **Neon** (DB) + **Upstash** (Redis) + **Fly.io** (API) + **Vercel** (web/admin).

---

## Repository layout

```
FORGE/
├── apps/api/              # NestJS backend
├── apps/web/              # Next.js user app
├── apps/admin/            # Next.js admin
├── apps/mobile/           # Flutter
├── packages/
│   ├── shared-types/
│   └── design-system/
├── docs/                  # Documentation (see docs/README.md)
├── scripts/               # setup, deploy, CI — see scripts/README.md
├── .github/workflows/     # CI + Fly/Vercel deploy
├── fly.toml               # Fly.io API deploy
└── docker-compose.yml     # Local Postgres + Redis
```

---

## API quick reference

Base URL: `http://localhost:3001/api/v1` · Swagger: `/api/docs`

| Area | Examples |
|------|----------|
| Auth | `POST /auth/signup`, `/login`, `/refresh` |
| Videos | `GET /videos/feed`, `POST /videos/presigned-url` |
| Engagement | `POST /videos/:id/like`, `/comments`, `/follow/:userId` |
| Streams | `POST /streams/start`, `GET /streams/live` |
| Admin | `GET /admin/stats`, `PATCH /admin/users/:id` |

WebSocket: `ws://localhost:3001/events` — `video:ready`, `stream:started`, `comment:new`

More detail: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) · [docs/FORGE_PROJECT_MASTER.md](docs/FORGE_PROJECT_MASTER.md)

---

## NPM scripts

```bash
npm run dev:api | dev:web | dev:admin
npm run build:all
npm run ci
npm run smoke:api
npm run gh:secrets
npm run db:neon:setup
npm run redis:upstash:test
npm run deploy:production
```

---

## Development notes

- Schema changes only via migrations (`apps/api/src/database/migrations/`), applied on API startup
- Demo seed: `npm run db:neon:setup` or `npm run seed --workspace=apps/api`
- Prefer `npm run dev:api` over Docker `api` service during active development (image can be stale)

---

## License

Private — Forge Studios.
