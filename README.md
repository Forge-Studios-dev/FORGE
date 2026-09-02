# FORGE

Skill-first creator platform powered by YouTube-style video mechanics.

**Docs:** [FORGE_PRODUCT_STRATEGY.md](docs/FORGE_PRODUCT_STRATEGY.md) · [FORGE_PROJECT_MASTER.md](docs/FORGE_PROJECT_MASTER.md) · [Implementation roadmap](docs/FORGE_IMPLEMENTATION_ROADMAP.md)

## Apps

| App | Stack | Role |
| --- | --- | --- |
| `apps/api` | NestJS, BullMQ, Socket.IO | API, workers, realtime |
| `apps/web` | Next.js 14 | Viewer + creator Studio |
| `apps/admin` | Next.js 14 | Platform admin |
| `apps/mobile` | Flutter | Mobile client (outside npm workspaces) |

## Packages

| Package | Role |
| --- | --- |
| `@forge/shared-types` | Cross-app contracts (auth, domain DTOs, sockets) |
| `@forge/design-system` | Tokens + React primitives |

## Architecture docs

Phase execution lives under [`docs/phases/`](docs/phases/). Index:

1. [UI/UX](docs/phases/01-ui-ux/PHASE_01_UI_UX.md)
2. [Tech architecture](docs/phases/02-tech-architecture/PHASE_02_TECH_ARCHITECTURE.md)
3. [Database](docs/phases/03-database/PHASE_03_DATABASE.md)
4. [Navigation](docs/phases/04-navigation/PHASE_04_NAVIGATION.md)
5. [User platform](docs/phases/05-user-platform/PHASE_05_USER_PLATFORM.md)
6. [Creator](docs/phases/06-creator-platform/PHASE_06_CREATOR.md)
7. [Admin](docs/phases/07-admin/PHASE_07_ADMIN.md)
8. [Video](docs/phases/08-video-platform/PHASE_08_VIDEO.md)
9. [Media pipeline](docs/phases/09-media-pipeline/PHASE_09_MEDIA.md)
10. [Streaming](docs/phases/10-streaming/PHASE_10_STREAMING.md)
11. [Search](docs/phases/11-search/PHASE_11_SEARCH.md)
12. [Recommendations](docs/phases/12-recommendations/PHASE_12_RECS.md)
13. [Subscriptions](docs/phases/13-subscriptions/PHASE_13_SUBSCRIPTIONS.md)
14. [Monetization](docs/phases/14-monetization/PHASE_14_MONETIZATION.md)
15. [Communication](docs/phases/15-communication/PHASE_15_COMMUNICATION.md)
16. [Analytics](docs/phases/16-analytics/PHASE_16_ANALYTICS.md)
17. [Security](docs/phases/17-security/PHASE_17_SECURITY.md)
18. [Infrastructure](docs/phases/18-infrastructure/PHASE_18_INFRA.md)
19. [Performance](docs/phases/19-performance/PHASE_19_PERFORMANCE.md)
20. [QA](docs/phases/20-qa/PHASE_20_QA.md)
21. [Accessibility](docs/phases/21-accessibility/PHASE_21_A11Y.md)
22. [SEO](docs/phases/22-seo/PHASE_22_SEO.md)
23. [Documentation](docs/phases/23-documentation/PHASE_23_DOCS.md)
24. [Production readiness](docs/phases/24-production-readiness/PHASE_24_PRODUCTION.md)

Also: [module boundary map](docs/phases/02-tech-architecture/MODULE_BOUNDARY_MAP.md) · [production checklist](docs/operations/PRODUCTION_CHECKLIST.md) · [depth backlog](docs/phases/DEPTH_BACKLOG.md) · [load-test runbook](docs/operations/LOAD_TEST_RUNBOOK.md)


## Quick start

```bash
npm install
npm run dev:api    # API
npm run dev:web    # Web
npm run dev:admin  # Admin
```

Mobile (Flutter, outside npm workspaces):

```bash
cd apps/mobile && flutter pub get && flutter run
```

Ship gate: [production checklist](docs/operations/PRODUCTION_CHECKLIST.md) · open PR [#185](https://github.com/Forge-Studios-dev/FORGE/pull/185) (`feature/youtube-replica-wave-1`).

See each app’s `.env.example`. Set `SKIP_ENV_VALIDATION=true` only for tooling that must boot without full env.

### Skill extensions (local dev)

Enable in `apps/api/.env` (restart API after changes):

```env
FEATURES_COURSES=true
FEATURES_MENTORSHIP=true
FEATURES_CHANNEL_POINTS=true
FEATURES_SKILL_ECONOMY_LMS=true   # programs, cohorts, paid bundles
```

Smoke against a running API:

```bash
npm run smoke:skill-features
```

Product scope: [FORGE_PRODUCT_STRATEGY.md](docs/FORGE_PRODUCT_STRATEGY.md) · rollout: [FORGE_IMPLEMENTATION_ROADMAP.md](docs/FORGE_IMPLEMENTATION_ROADMAP.md).
