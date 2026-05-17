# FORGE — Documentation

Documentation for the FORGE skill-first creator platform. Use this index to find the right document for your audience.

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
| [../README.md](../README.md) | Clone, install, run locally, API examples, deployment |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) §25 | Production readiness checklist |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) §24 | Implementation status (feature matrix) |
| [phase4-platform-evaluation.md](./phase4-platform-evaluation.md) | When to adopt search, analytics warehouse, vector DB, etc. |
| [Recommended_Things.md](./Recommended_Things.md) | External tools catalog (in use vs deferred) |

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

## Redirects (legacy filenames)

These files only point to the consolidated master document:

- `PROJECT_OVERVIEW.md` → [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)
- `project-goals-and-scope.md` → [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)
- `mvp-audit.md` → §24 in master
- `production-readiness-checklist.md` → §25 in master
- `FORGE_ENHANCEMENT.MD` / `FORGE_MVP_Enhancement_Prompt.md` → relevant sections in master

**Do not maintain duplicate content in redirect files.** Update [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) only.

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
└── docs/              ← You are here
```

---

## Maintenance

| When you change… | Update… |
|------------------|---------|
| Product vision, scope, feature status | `FORGE_PROJECT_MASTER.md` + `CLIENT_OVERVIEW.md` status table |
| Go-live requirements | `FORGE_PROJECT_MASTER.md` §25 |
| UI screens or routes | `ui-ux-ai-design-prompt.md` + blueprints under `design/blueprints/` |
| Setup or deploy steps | Root `README.md` |

*Last reviewed: 2026-05-16*
