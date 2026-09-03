# ADR-005: No ad revenue model

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

No AdSense, preroll, or RPM pipeline exists in the repo. `MONETIZATION.md` already said no ads.

## Research

- YouTube’s core take-rate is ads + YPP. That requires an ad network, advertiser-friendly ratings, and huge scale.
- Skill-first creators monetize like **Patreon + Skillshare + Twitch bits**: memberships, tips, courses, paid events.
- Standing up ads now would compete with creator-owned Stripe revenue and add COPPA/Kids and brand-safety programs FORGE is not staffed for.

## Alternatives considered

| Option | Why not |
|--------|---------|
| YouTube-style ads | Infra + legal + inventory; contradicts creator-owned model. |
| Hybrid later | Only revisit if product explicitly reverses this ADR at much larger scale. |

## Decision

**Permanently N/A** unless this ADR is reversed. Monetization is Stripe Connect: memberships, Super Thanks, Super Chat, paid events, course/program sales.

Eligibility UI may **mirror YPP thresholds** as a read-only trust signal. It does not unlock ads.

## Code evidence

- `BillingModule`, `StripeConnectService`; grep-clean for ad-serving code.

## Consequences

- Do not plan ad-serving in SCALE_* docs.
- Earnings dashboards show creator-owned streams only.
