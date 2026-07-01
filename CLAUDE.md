# FORGE — Claude Project Rules

FORGE is a skill-first creator platform: **NestJS API** (`apps/api`), **Next.js web/admin** (`apps/web`, `apps/admin`), **Flutter mobile** (`apps/mobile`), with BullMQ, Socket.IO, and a video/feed/analytics stack.

These rules live in `.claude/rules/` and mirror the Cursor rules in `.cursor/rules/*.mdc`. Claude loads them via the imports below. Rules in **Always Apply** govern every change; **Path-Scoped** rules apply when you touch the matching files.

## Always Apply (every change)

- @.claude/rules/forge-core.md
- @.claude/rules/forge-performance.md
- @.claude/rules/forge-production-stability.md
- @.claude/rules/forge-git-branching.md
- @.claude/rules/forge-deployment-testing.md

## Path-Scoped (apply when touching matching files)

- @.claude/rules/forge-backend.md — `apps/api/**`, `packages/shared-types/**`
- @.claude/rules/forge-frontend-ux.md — `apps/web/**`, `apps/admin/**`, `packages/design-system/**`
- @.claude/rules/forge-mobile.md — `apps/mobile/**`
- @.claude/rules/forge-testing.md — `**/*.spec.ts`, `**/*.test.ts`, `**/test/**`, `**/e2e/**`, `**/*_test.dart`
- @.claude/rules/forge-infra-docs.md — `docs/**`, `scripts/**`, `.github/**`, `docker-compose*.yml`, `Dockerfile*`
