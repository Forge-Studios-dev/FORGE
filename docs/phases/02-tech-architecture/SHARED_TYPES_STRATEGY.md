# Shared-types domain strategy (Phase 02)

## Canonical contract

[`packages/shared-types/src/domain.ts`](../../../packages/shared-types/src/domain.ts) is the **intended** public domain contract for Video, User, Category, Playlist, etc.

Export surface: `packages/shared-types/src/index.ts` re-exports domain.

## Current reality

| Client | Types today | Gap |
| --- | --- | --- |
| Web | Often `apps/web/src/types` (local re-exports / mirrors) | Drift risk vs domain.ts |
| Admin | Mix of shared-types + local | Medium |
| Mobile | Dart models in `lib/shared/models` | Manual parity |
| API | TypeORM entities + mappers | Source of wire shape |

## Strategy (no big-bang rewrite)

1. **New fields / endpoints** — add to `domain.ts` first; map in API mappers; adopt in web via `@forge/shared-types` before adding web-local duplicates.
2. **Web** — prefer importing from `@forge/shared-types` when touching a type; delete local duplicate when identical.
3. **Mobile** — keep Dart models; document field parity in model comments when changing API; optional codegen later (out of Phase 02).
4. **Do not** rename API `skillTags` in this phase — domain may alias as topics in UI only.

## Acceptance for later phases

- Web Video/User imports primarily from shared-types
- CI optional: type-export snapshot test (Phase 20)
