# FORGE — Frontend

> Scope: **Apply when touching** `apps/web/**`, `apps/admin/**`, `packages/design-system/**`. Mirrors `.cursor/rules/forge-frontend-ux.mdc`.

## Identity

- Creator-first, skill-learning product — not a generic video-site clone.
- Use `@forge/design-system` tokens/components. Match patterns in `apps/web/src/components` before adding primitives.

## Architecture

- Presentational components stay thin; business logic in hooks/services (`apps/web/src/lib` or existing equivalents).
- Error boundaries / `error` + `not-found` where the App Router already expects them.
- Lazy routes / code-split when adding large surfaces.

## Quality

- Responsive; accessible (labels, focus, contrast, keyboard).
- SEO on public/marketing pages only when touching those routes.
- Prefer existing data-fetching patterns (SWR/React Query/etc. already in repo).
- Watch/studio: fast startup, clear upload progress, minimal layout shift — follow existing surfaces.
