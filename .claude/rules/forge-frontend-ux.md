# FORGE — Frontend

> Scope: **Apply when touching** `apps/web/**`, `apps/admin/**`, `packages/design-system/**`. Mirrors `.cursor/rules/forge-frontend-ux.mdc`.

## Identity

- Skill-first creator platform with **YouTube-style** watch/Studio chrome. Prefer YouTube mechanics on video surfaces; keep skill taxonomy, courses, and approval-gate UX where those ADRs apply (`forge-product` wins framing).
- Use `@forge/design-system` tokens/components. Match patterns in `apps/web/src/components` before adding primitives.
- Dual-theme tokens exist (`.dark` default, `.light` opt-in via `ThemeProvider`); do not hardcode colors.

## Architecture

- Presentational components stay thin; business logic in hooks/services (`apps/web/src/lib` or existing equivalents).
- Prefer domain types from `@forge/shared-types` (web `src/types` re-exports).
- HTTP clients must use validated `env` (`apps/web/src/env.ts`), not raw `process.env` for API URLs.
- Error boundaries / `error` + `not-found` where the App Router already expects them.
- Lazy routes / code-split when adding large surfaces.

## Quality

- Responsive; accessible (labels, focus, contrast, keyboard).
- SEO on public/marketing pages only when touching those routes.
- Prefer existing data-fetching patterns (SWR/React Query/etc. already in repo).
- Watch/studio: fast startup, clear upload progress, minimal layout shift — follow existing surfaces.
