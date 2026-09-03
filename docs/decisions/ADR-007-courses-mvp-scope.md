# ADR-007: Courses MVP scope

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

Courses backend includes quizzes, assignments, certificates, cohorts, and programs. Frontend restored 2026-09 behind flags.

## Research

- Skillshare: short video lessons, enroll, progress — **not** SCORM, proctored exams, or accreditation.
- Coursera/Kajabi-class LMS is a different company. FORGE already excluded it in product strategy.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Full LMS in default UI | Scope explosion; empty/partial UX (podcasts, wiki have no client). |
| Courses as YouTube playlists only | Loses enroll/progress/catalog — the skill-vertical differentiator. |

## Decision

**MVP (`FEATURES_COURSES`):** video-linked lessons, catalog, enroll, lesson progress, Studio builder.

**Behind `FEATURES_SKILL_ECONOMY_LMS` only:** quizzes, assignments, certificates, cohorts, creator programs, articles, podcasts, study groups.

Do **not** build SCORM, accreditation, or assignment-grading pipelines without a new ADR.

## Code evidence

- `CoursesModule`, web `/studio/courses`, `/courses/[id]`, mobile courses feature

## Consequences

- Podcast/gamification/wiki APIs without UI are **intentional**, not R2 blockers.
