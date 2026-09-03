# Economy / LMS module load strategy (Phase 02)

> **Historical phase closeout** — not the active roadmap. Aligns with [ADR-001](../../decisions/ADR-001-skill-first-framing.md), [ADR-006](../../decisions/ADR-006-granular-feature-flags.md), [ADR-007](../../decisions/ADR-007-courses-mvp-scope.md). Product SSOT: [FORGE_PRODUCT_STRATEGY.md](../../FORGE_PRODUCT_STRATEGY.md).

## Goal

FORGE is **skill-first + YouTube mechanics**. Courses, mentorship, and channel points are **selective extensions** behind granular flags — not a YouTube-replica default that retires skill UI.

## Runtime gates

| Mechanism | Behavior |
| --- | --- |
| `FEATURES_COURSES` / `_MENTORSHIP` / `_CHANNEL_POINTS` | Granular enable (ADR-006). Also on when `FEATURES_SKILL_ECONOMY_LMS=true`. |
| `FEATURES_SKILL_ECONOMY_LMS` | Enables all three **plus** full LMS backend (quizzes, cohorts, articles, podcasts, study groups). |
| `isCoursesEnabled()` etc. | `apps/api/src/common/features/skill-platform.ts` |
| `CoursesModule.register()` / sibling modules | Empty dynamic module when flag off |
| `SkillFeatureGuard` | HTTP 410 when a gated route is hit while off |

## Client UI

Flag-gated Studio/consumer UI for courses, mentorship, and channel points was **restored** (re-audit 2026-09, P2–P5). Do not redirect away to “match YouTube.” Quizzes / podcasts / wiki / gamification **consumer UI** stay out of default scope (ADR-007).

## Still loaded in AppModule (adjacent)

| Module | Why | Client chrome |
| --- | --- | --- |
| `ChannelPointsModule` | Soft-retire via `register()` when points flag off | Studio/admin when flag on |
| `GamificationModule` | Soft-retire via `register()` when LMS extended off | API only by default (no primary nav) |
| `CommunitiesModule` | Posts/polls/tiers core; rooms/events always-on extension (ADR-004); Brands/Mentorship controllers gated | Per ADR-004 |

## Explicit non-decision

Deleting Nest LMS / channel-points / gamification **source trees** remains deferred — boot-omit + 410/empty module is enough. Prefer flags over decommission until product asks for permanent removal.
