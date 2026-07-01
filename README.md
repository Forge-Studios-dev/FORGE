# FORGE — Creator Economy OS

Skill-first creator platform: on-demand lessons, live teaching, communities, memberships, and monetization for creators. Spans web, mobile, and an operator admin.

**Repository:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

## Quick start

```bash
git clone https://github.com/Forge-Studios-dev/FORGE.git && cd FORGE
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
docker compose up postgres redis -d
bash scripts/setup-local-demo.sh
npm run dev:api   # :3001
npm run dev:web   # :3000
npm run dev:admin # :3002
```

| Service | URL |
|---------|-----|
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Web | http://localhost:3000 |
| Admin | http://localhost:3002 |

## Apps

| App | Stack | Port |
|-----|--------|------|
| API | NestJS 10, TypeORM, BullMQ, Socket.IO | 3001 |
| Web | Next.js 14 App Router | 3000 |
| Admin | Next.js 14 | 3002 |
| Mobile | Flutter, Riverpod, go_router | — |

## Stack

PostgreSQL 16 (Neon) · Redis 7 · AWS S3 · Mux (live + VOD) · FFmpeg · LiveKit · Stripe · Fly.io · Vercel

## Features

- **Video & Podcasts** — upload, Mux HLS, ABR playback, podcast series with iTunes RSS
- **Live streaming** — Mux RTMP, LiveKit browser go-live, co-hosts, VIP rooms, breakout sessions, stream chat + super chat
- **Communities** — rooms (text/voice/stage), posts, polls, wiki, challenges, events, gamification, channel points, mentorship matching
- **Memberships** — Stripe subscription tiers, entitlements, paid events, creator bundles
- **Recommendations** — personalized feed (watch history + follow graph + trending signal), similar videos, unified content library
- **Fraud detection** — billing velocity rules, chargeback detection, risk scoring, admin review queue
- **Creator tools** — studio analytics, subscriber analytics, AI moderation copilot
- **Admin** — user/content moderation, creator approvals, fraud alerts, platform analytics

## Layout

```
FORGE/
├── apps/api/              # NestJS API + migrations + workers
├── apps/web/              # Consumer Next.js
├── apps/admin/            # Operator Next.js
├── apps/mobile/           # Flutter
├── packages/
│   ├── shared-types/      # Contracts, flags, access helpers, socket events
│   └── design-system/     # Tokens + React primitives
├── docs/                  # Canonical documentation
├── scripts/               # Deploy, smoke, DB, secrets
├── infra/observability/   # Grafana/Prometheus config
├── fly.toml               # API Fly app
└── fly.worker.toml        # Worker Fly app
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/FORGE_PROJECT_MASTER.md](docs/FORGE_PROJECT_MASTER.md) | Modules, routes, workers, design system, feature status |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Local dev setup |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production deployment |
| [docs/CI_CD.md](docs/CI_CD.md) | GitHub Actions + secrets |
| [docs/LIVE.md](docs/LIVE.md) | Live streaming setup |
| [docs/MEMBERSHIPS.md](docs/MEMBERSHIPS.md) | Billing, tiers, Stripe Connect |
| [docs/AUTH.md](docs/AUTH.md) | Auth, sessions, OAuth |
| [docs/MEDIA.md](docs/MEDIA.md) | S3 + Mux pipeline |
| [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) | Metrics, Sentry, Grafana |
| [docs/API_SCHEMAS.md](docs/API_SCHEMAS.md) | Public API contracts |
| [docs/README.md](docs/README.md) | Full docs index |

## CI/CD

Push feature branch → PR → merge to `main` → CI + Fly (API) + Vercel (web/admin) deploy.

```bash
npm run ci:local    # local CI gate
npm run smoke:api   # integration smoke
```

---

Private — Forge Studios.
