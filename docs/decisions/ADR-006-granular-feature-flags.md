# ADR-006: Granular skill feature flags

**Status:** Accepted (2026-09-02)

## Context

Monolithic `FEATURES_SKILL_ECONOMY_LMS` gated all skill modules including full LMS surface.

## Decision

Add granular env flags:
- `FEATURES_COURSES`
- `FEATURES_MENTORSHIP`
- `FEATURES_CHANNEL_POINTS`

`FEATURES_SKILL_ECONOMY_LMS=true` enables all three plus full LMS (quizzes, cohorts, articles, podcasts, study groups, programs).

Implementation: `apps/api/src/common/features/skill-platform.ts`, `SkillFeatureGuard`.

## Consequences

- Selective prod rollout without enabling full LMS
- Update `.env.example`, `FORGE_PROJECT_MASTER.md` §7
