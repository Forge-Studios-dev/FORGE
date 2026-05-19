# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

---

## Start here

| Document | Who | What |
|----------|-----|------|
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Developers | Clone, env, run locally, demo logins |
| **[MVP_GO_LIVE.md](./MVP_GO_LIVE.md)** | DevOps | Deploy free MVP (Vercel + Fly + Neon + Upstash) |
| **[mvp-test-matrix.md](./mvp-test-matrix.md)** | QA / dev | Test every role after deploy |
| **[CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md)** | Clients | Executive summary to share |
| **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** | All | Full product + technical spec |

**Typical path:** `GETTING_STARTED` → `MVP_GO_LIVE` → `mvp-test-matrix` → send `CLIENT_OVERVIEW` to client.

---

## By topic

| Topic | Document |
|-------|----------|
| Local ngrok / VPS only | [DEPLOYMENT_DEMO.md](./DEPLOYMENT_DEMO.md) |
| Remediation & deferred work | [mvp-audit.md](./mvp-audit.md) |
| Scale / vendor decisions | [phase4-platform-evaluation.md](./phase4-platform-evaluation.md) |
| Tools catalog | [Recommended_Things.md](./Recommended_Things.md) |
| UI/UX for design tools | [ui-ux-design-prompt-any-ai.md](./ui-ux-design-prompt-any-ai.md) |
| Root setup & API cheat sheet | [../README.md](../README.md) |

---

## Env templates

| File | Service |
|------|---------|
| `apps/api/.env.example` | Local API |
| `apps/api/.env.neon.example` | Neon Postgres |
| `apps/api/.env.upstash.example` | Upstash Redis |
| `apps/web/.env.example` | Web |
| `apps/admin/.env.example` | Admin |

---

## Scripts

```bash
bash scripts/setup-local-demo.sh   # Docker Postgres/Redis + seed
npm run db:neon:setup              # Neon migrate + seed
npm run redis:upstash:test         # Upstash ping
npm run smoke:api                  # API health + auth smoke
npm run verify:roles               # Role permission matrix
```

Optional (require `docs/design/blueprints/` if you add design assets): `npm run verify:blueprints`, `npm run manifest`, `npm run parity`

---

## Repository map

```
apps/api/       NestJS + BullMQ (:3001)
apps/web/       Next.js (:3000)
apps/admin/     Next.js (:3002)
apps/mobile/    Flutter
packages/       shared-types, design-system
docs/           ← you are here
scripts/        automation
fly.toml        Fly.io deploy
.github/        CI + deploy workflows
```

---

## When you change…

| Change | Update |
|--------|--------|
| Local setup | `GETTING_STARTED.md` |
| Cloud deploy | `MVP_GO_LIVE.md` |
| Product / features | `FORGE_PROJECT_MASTER.md` + `CLIENT_OVERVIEW.md` §4 |
| UI screens | `ui-ux-design-prompt-any-ai.md` |

*Last reviewed: 2026-05-19*
