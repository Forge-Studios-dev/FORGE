# FORGE – Live Creator Platform

Skill-first platform for learning journeys, tutorial videos, live teaching, and creator audiences.

**Repository:** [github.com/Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

## Documentation (13 files)

All docs live in [`docs/`](docs/README.md):

| Doc | Purpose |
|-----|---------|
| [GETTING_STARTED](docs/GETTING_STARTED.md) | Local dev |
| [FORGE_PROJECT_MASTER](docs/FORGE_PROJECT_MASTER.md) | Architecture & status |
| [CLIENT_OVERVIEW](docs/CLIENT_OVERVIEW.md) | Stakeholder summary |
| [API_SCHEMAS](docs/API_SCHEMAS.md) | Public API contracts |
| [DEPLOY](docs/DEPLOY.md) | Production deploy |
| [CI_CD](docs/CI_CD.md) | GitHub Actions |
| [AUTH](docs/AUTH.md) | Sessions & OAuth |
| [MEDIA](docs/MEDIA.md) | S3 & Mux |
| [FIREBASE](docs/FIREBASE.md) | FCM push |
| [OBSERVABILITY](docs/OBSERVABILITY.md) | Metrics & Sentry |
| [MEMBERSHIPS](docs/MEMBERSHIPS.md) | Mock tiers |
| [QA](docs/QA.md) | Test matrix |

```bash
git clone https://github.com/Forge-Studios-dev/FORGE.git && cd FORGE
npm install && bash scripts/setup-local-demo.sh
npm run dev:api   # + dev:web, dev:admin
```

## Apps

| App | Stack | Port |
|-----|--------|------|
| API | NestJS, BullMQ, Socket.IO | 3001 |
| Web | Next.js 14 | 3000 |
| Admin | Next.js 14 | 3002 |
| Mobile | Flutter | — |

## Stack

PostgreSQL · Redis · AWS S3 · Mux · FFmpeg · Fly.io · Vercel

## Layout

```
apps/api/  apps/web/  apps/admin/  apps/mobile/
packages/  docs/  scripts/  .github/workflows/
```

## API

`http://localhost:3001/api/v1` · Swagger `/api/docs`

## Scripts

`npm run dev:api` · `npm run ci` · `npm run smoke:api` · `npm run deploy:production`

---

Private — Forge Studios.
