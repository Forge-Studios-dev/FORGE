# ADR-005: No ad revenue model

**Status:** Accepted (2026-09-02)

## Context

`MONETIZATION.md` documents no ad network; `adRevenueCents` hardcoded 0.

## Decision

**Permanently N/A** for skill-first FORGE. Monetization via creator-owned Stripe Connect (memberships, tips, future course sales).

## Consequences

- Monetization eligibility endpoint remains read-only (no ads to unlock)
- Future scale docs should not plan for ad-serving infra
