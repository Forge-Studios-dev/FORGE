# Stitch UI blueprints (reference)

Static HTML exports from **Google Stitch** (or similar) for layout reference during implementation.

## Web access

When feature flag `blueprints_public` is enabled:

- URL: `/blueprints` on the web app
- Flags: `FEATURE_FLAGS` + `NEXT_PUBLIC_FEATURE_FLAGS=blueprints_public`

## Add exports here

Place HTML mockups in this folder, grouped by surface:

```
docs/design/blueprints/
├── web/          # Consumer app screens
├── admin/        # Operator panel
└── mobile/       # Mobile reference (optional)
```

Production UI lives in `apps/web`, `apps/admin`, `apps/mobile`. Tokens: `packages/design-system`.

**Spec:** [FORGE_PROJECT_MASTER.md §8](../../FORGE_PROJECT_MASTER.md#8-design-system--blueprints)
