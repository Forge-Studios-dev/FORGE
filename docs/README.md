# FORGE — Documentation

Documentation for the FORGE skill-first creator platform. Use this index to find the right document for your audience.

---

## Go live (MVP) — start here

| Document | Purpose | Read time |
|----------|---------|-----------|
| **[MVP_GO_LIVE.md](./MVP_GO_LIVE.md)** | **Deploy MVP for free** — Vercel, Fly.io, Neon, Upstash, CI/CD, verification | ~20 min |
| [mvp-test-matrix.md](./mvp-test-matrix.md) | Role × flow testing after deploy | ~15 min |
| [DEPLOYMENT_DEMO.md](./DEPLOYMENT_DEMO.md) | Local demo, ngrok, Oracle/VPS only (not cloud MVP) | ~10 min |

**Recommended order:** `MVP_GO_LIVE.md` → deploy → `mvp-test-matrix.md` → share [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) with client.

---

## For clients and stakeholders

| Document | Purpose | Read time |
|----------|---------|-----------|
| **[CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md)** | Executive summary: product vision, what is built, delivery status, roadmap | ~10 min |
| **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** | Full product and technical specification (single source of truth) | ~45 min |

**Recommended sharing order:** Send `CLIENT_OVERVIEW.md` first, then `FORGE_PROJECT_MASTER.md` for depth. Attach or link design blueprints from `docs/design/blueprints/` when discussing UI.

---

## For engineering and operations

| Document | Purpose |
|----------|---------|
| [../README.md](../README.md) | Clone, install, run locally, API examples |
| [MVP_GO_LIVE.md](./MVP_GO_LIVE.md) | Production deploy (free tier) |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) §25 | Production readiness checklist |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) §24 | Implementation status (feature matrix) |
| [phase4-platform-evaluation.md](./phase4-platform-evaluation.md) | When to adopt search warehouse, vector DB, etc. |
| [Recommended_Things.md](./Recommended_Things.md) | External tools catalog (in use vs deferred) |

**Env templates:** `apps/api/.env.neon.example`, `apps/api/.env.upstash.example`

**Scripts:** `npm run db:neon:setup` · `npm run redis:upstash:test` · `bash scripts/setup-local-demo.sh`

---

## For design and UX

| Document | Purpose |
|----------|---------|
| [ui-ux-ai-design-prompt.md](./ui-ux-ai-design-prompt.md) | Full UI/UX spec for Google Stitch |
| [ui-ux-design-prompt-any-ai.md](./ui-ux-design-prompt-any-ai.md) | Same spec, tool-agnostic (v0, Figma AI, Claude, etc.) |
| [design/blueprints/](./design/blueprints/) | HTML + PNG screen blueprints (web, mobile, admin) |
| [design/blueprints/screens.json](./design/blueprints/screens.json) | Machine-readable screen manifest |

**Design system code:** `packages/design-system/` (web/admin) · `apps/mobile/lib/core/theme/forge_tokens.dart` (mobile)

---

## Redirects (do not duplicate content)

| File | Points to |
|------|-----------|
| [DEPLOYMENT_VERCEL_FLY.md](./DEPLOYMENT_VERCEL_FLY.md) | [MVP_GO_LIVE.md](./MVP_GO_LIVE.md) |
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) |
| [project-goals-and-scope.md](./project-goals-and-scope.md) | [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) |
| [mvp-audit.md](./mvp-audit.md) | Master §24 |
| [production-readiness-checklist.md](./production-readiness-checklist.md) | Master §25 |
| [FORGE_ENHANCEMENT.MD](./FORGE_ENHANCEMENT.MD) | Master §26–31 |
| [FORGE_MVP_Enhancement_Prompt.md](./FORGE_MVP_Enhancement_Prompt.md) | Master (enhancement sections) |

---

## Repository map (quick reference)

```
FORGE/
├── apps/api/          NestJS API + BullMQ workers (port 3001)
├── apps/web/          Next.js learner/creator app (port 3000)
├── apps/admin/        Next.js operator panel (port 3002)
├── apps/mobile/       Flutter app (iOS / Android)
├── packages/
│   ├── shared-types/  API contracts shared by web/admin
│   └── design-system/ Shared UI tokens and React components
├── fly.toml           Fly.io API deploy config
├── .github/workflows/ CI + deploy-fly + deploy-vercel
└── docs/              ← You are here
```

---

## Maintenance

| When you change… | Update… |
|------------------|---------|
| Deploy / go-live steps | `MVP_GO_LIVE.md` only |
| Local demo / ngrok / VPS | `DEPLOYMENT_DEMO.md` |
| Product vision, scope, feature status | `FORGE_PROJECT_MASTER.md` + `CLIENT_OVERVIEW.md` |
| UI screens or routes | `ui-ux-ai-design-prompt.md` + blueprints |
| Local setup commands | Root `README.md` |

*Last reviewed: 2026-05-19*
