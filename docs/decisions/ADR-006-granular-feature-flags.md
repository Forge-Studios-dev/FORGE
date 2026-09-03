# ADR-006: Granular skill feature flags

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

A single `FEATURES_SKILL_ECONOMY_LMS` once gated courses, mentorship, points, *and* full LMS (quizzes, cohorts, articles, podcasts).

## Research

- Production `fly.toml` currently enables courses, mentorship, points, **and** the LMS master switch. That is an *ops* choice, not a requirement that LMS UI must ship.
- Selective rollout (Skillshare-like courses without Kajabi) needs independent flags.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Monolithic LMS flag only | Cannot ship courses without quizzes/podcasts. |
| Build-time `NEXT_PUBLIC` skill flags | Clients already read `GET /platform/config`; env drift across web/mobile/admin is worse. |

## Decision

**Keep** granular env flags:

- `FEATURES_COURSES`
- `FEATURES_MENTORSHIP`
- `FEATURES_CHANNEL_POINTS`

`FEATURES_SKILL_ECONOMY_LMS=true` enables all three **plus** full LMS backend (quizzes, cohorts, programs, articles, podcasts, study groups). Clients consume `skillFeatures` from `/platform/config`.

Production may keep LMS=true for API completeness; **consumer UI for podcasts/wiki/gamification stays out of scope** until product asks (ADR-007).

## Code evidence

- `skill-platform.ts`, `SkillFeatureGuard` → 410 `SKILL_FEATURE_DISABLED`
- `CoursesModule.register()` et al. in `app.module.ts`

## Consequences

- Selective prod rollout without implying a Coursera clone.
