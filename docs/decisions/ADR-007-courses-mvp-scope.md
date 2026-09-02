# ADR-007: Courses MVP scope

**Status:** Accepted (2026-09-02)

## Context

Full courses backend includes quizzes, assignments, certificates, cohorts, creator programs. Web/mobile skill UI restored 2026-09 (flag-gated).

## Decision

**MVP (FEATURES_COURSES):** video-linked lessons, publish catalog, enroll, lesson progress, creator Studio builder. Skillshare-inspired lesson length (2–8 min lessons, 20–60 min total).

**Behind FEATURES_SKILL_ECONOMY_LMS only:** quizzes, assignments, certificates, cohorts, creator programs.

## Consequences

- P2 implementation scopes UI to MVP endpoints
- `CreatorProgramsController` stays on full LMS flag
