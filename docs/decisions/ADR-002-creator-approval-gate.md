# ADR-002: Creator approval gate

**Status:** Accepted (2026-09-02)

## Context

YouTube allows upload from account creation. FORGE requires admin approval before upload/live.

## Decision

**Keep** admin-gated creator approval as an intentional trust gate for the skill/crafts vertical. Monetization eligibility remains a separate read-only gate (YouTube Partner Program thresholds).

## Consequences

- Document in product strategy and onboarding flows
- Do not remove `CreatorApprovedGuard` without explicit product reversal
