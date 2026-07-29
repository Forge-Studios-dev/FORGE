# FORGE Web

Next.js frontend for the FORGE skill-first creator platform.

## Getting started

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`.

## Theme

FORGE ships **dark-only** by default. This is an intentional design decision — the brand identity, contrast ratios, and glass-panel effects are all tuned for a dark surface palette using Material 3 design tokens (`surface`, `on-surface`, `primary`, etc.). There is no light mode toggle at this time.

If a light theme is added in the future, token mappings in `packages/design-system` and `tailwind.config.ts` should be updated together.
