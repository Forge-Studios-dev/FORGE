---
description: Skill-first creator platform — YouTube mechanics, vertical positioning, selective skill modules
alwaysApply: true
---

# FORGE — Product

**Product goal:** build a **skill-first creator platform** powered by **YouTube-style mechanics** on the FORGE stack (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`).

**SSOT:** [docs/FORGE_PRODUCT_STRATEGY.md](../../docs/FORGE_PRODUCT_STRATEGY.md)

## Layers

1. **YouTube mechanics (core):** channels, VOD, Shorts, live, subscriptions, playlists, comments, search/feeds/recs, Studio, Community posts/polls, Stripe monetization, moderation.
2. **Skill-first vertical:** skills/crafts taxonomy, trusted-creator approval gate, creator KPIs tuned for teaching.
3. **Selective extensions:** courses (`FEATURES_COURSES`), mentorship (`FEATURES_MENTORSHIP`), channel points (`FEATURES_CHANNEL_POINTS`). Full LMS (quizzes, cohorts, articles, podcasts) only with `FEATURES_SKILL_ECONOMY_LMS=true`.

## When implementing

- Match **YouTube behavior** for video/discovery/engagement surfaces unless [docs/decisions/](../../docs/decisions/) document an intentional gap.
- Match **skill-first positioning** for taxonomy, course framing, and creator trust flows.
- **Do not** build full LMS (SCORM, accreditation, assignment grading) without explicit scope change.
- Re-enable skill module UI per [FORGE_IMPLEMENTATION_ROADMAP.md](../../docs/FORGE_IMPLEMENTATION_ROADMAP.md) — backend may exist while UI is absent.

## Encouraged

- Analyze YouTube + Skillshare/Patreon/Twitch patterns before coding skill features
- Compare codebase to product strategy; audit gaps openly
- Document intentional divergences in `docs/decisions/`

## Scope discipline

- Follow `forge-core`, `forge-ship`
- Legal/branding: replicate functionality/UX patterns, not YouTube trademarks
