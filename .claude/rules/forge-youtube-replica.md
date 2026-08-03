# FORGE — YouTube Replica

> Scope: **Always apply**. Mirrors `.cursor/rules/forge-youtube-replica.mdc`.

**Product goal:** build a **faithful YouTube replica** on the existing FORGE stack (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`). Prefer YouTube parity over inventing a custom video platform.

## Encouraged (never restrict)

These rules do **not** limit thinking, research, or judgment. Always allowed and preferred when useful:

- Analyze YouTube modules, workflows, UX, edge cases, and APIs before coding
- Compare our codebase to YouTube; audit gaps, divergences, and debt
- Design architecture, data models, and migration plans for parity
- Propose removals/refactors when existing FORGE behavior ≠ YouTube
- Discuss trade-offs, scalability, and maintainability openly

Do **not** skip analysis to “just ship something custom.” Do **not** treat this rule as a ban on exploration, planning, or deep review.

## When implementing

- Match YouTube behavior for flows, roles, and surfaces: user, creator (channel), admin, video, channel, subscriptions, comments, likes/dislikes, playlists, search, recommendations, notifications, analytics, monetization (where applicable), reports/moderation, settings & permissions.
- Align APIs, UI, and state machines with YouTube’s model where practical on our stack; document intentional gaps only when forced by tech or law.
- If an existing feature, workflow, or UI conflicts with YouTube parity → **remove or refactor** toward YouTube, don’t extend the divergence as “FORGE-unique” unless the user explicitly asks.
- Reuse and improve current modules; optimize structure/quality while moving toward parity — don’t rewrite the monorepo for novelty.

## Scope discipline

- Still follow `forge-core` (smallest safe change, match local conventions) and `forge-ship` (no unsolicited commits/deploys).
- Parity work can be large; analyze and plan freely, but implement in focused slices unless the user asks for a broad pass.
- Legal/branding: replicate **functionality and UX patterns**, not YouTube trademarks, assets, or proprietary internals.
