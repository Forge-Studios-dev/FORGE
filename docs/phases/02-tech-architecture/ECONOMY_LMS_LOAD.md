# Economy / LMS module load strategy (Phase 02)

## Goal

YouTube-replica default: courses, podcasts, and creator programs are **not** part of the primary product. Memberships, Super Thanks, and live remain.

## Runtime gates

| Mechanism | Behavior |
| --- | --- |
| `FEATURES_SKILL_ECONOMY_LMS` | Default unset/false. When `true`, restores LMS. |
| `isSkillEconomyLmsEnabled()` | `apps/api/src/common/features/skill-economy-lms.ts` |
| `CoursesModule.register()` | Empty dynamic module when flag off; full controllers when on |
| `SkillEconomyLmsGuard` | HTTP 410 + `SKILL_ECONOMY_LMS_RETIRED` if a LMS route is still hit |
| Content library | Defaults to `video`/`short` (+ live filter) when flag off |

## Still loaded in AppModule (adjacent)

| Module | Why still imported | Client chrome |
| --- | --- | --- |
| `ChannelPointsModule` | Soft-retire via `register()` when LMS flag off (empty module) | Admin `/channel-points` → dashboard |
| `GamificationModule` | Soft-retire via `register()` when LMS flag off | Not primary SideNav |
| `CommunitiesModule` | Channel community / rooms | Secondary surfaces OK |

## Explicit non-decision (needs product/ops)

Deleting Nest LMS / channel-points / gamification **source trees** is **deferred** — boot-omit + 410/empty module is enough for YouTube mode. Prefer hidden UI until a dedicated decommission phase.

## Client soft-redirects

Mobile GoRouter redirects LMS studio/course deep links to feed/studio/videos (Phase 01 era). Keep redirects until deep links expire in the wild.
