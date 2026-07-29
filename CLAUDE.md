# FORGE — Claude Project Rules

FORGE is a skill-first creator platform: **NestJS API** (`apps/api`), **Next.js web/admin** (`apps/web`, `apps/admin`), **Flutter mobile** (`apps/mobile`), with BullMQ, Socket.IO, and a video/feed/analytics stack.

These rules live in `.claude/rules/` and mirror `.cursor/rules/*.mdc`. Keep both in sync when editing.

## Always Apply

- @.claude/rules/forge-core.md
- @.claude/rules/forge-ship.md

## Path-Scoped

- @.claude/rules/forge-backend.md — `apps/api/**`, `packages/shared-types/**`
- @.claude/rules/forge-frontend-ux.md — `apps/web/**`, `apps/admin/**`, `packages/design-system/**`
- @.claude/rules/forge-mobile.md — `apps/mobile/**`
- @.claude/rules/forge-testing.md — `**/*.spec.ts`, `**/*.test.ts`, `**/test/**`, `**/e2e/**`, `**/*_test.dart`
- @.claude/rules/forge-infra-docs.md — `docs/**`, `scripts/**`, `.github/**`, `docker-compose*.yml`, `Dockerfile*`
