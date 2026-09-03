# ADR-002: Creator approval gate

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

YouTube lets any account upload. FORGE requires admin approval (`CreatorStatus`) before upload/live.

## Research

- YouTube’s open upload maximizes supply; Trust & Safety is post-hoc (strikes, CSAI, human review).
- Skill/crafts marketplaces (Skillshare teachers, many Patreon-class verticals) use **application or quality gates** because the brand promise is “trusted expert,” not “anyone with a camera.”
- FORGE already has strikes, DMCA, reports, and (pluggable) content scan. The approval gate is an *additional* supply-side filter, not a substitute for CSAM scanning (ADR-009).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Open upload like YouTube | Undermines skill-first trust; increases CSAM/spam surface before a vendor scanner exists. |
| Automatic approval after N videos | Premature — no quality model; still need humans for crafts expertise. |
| Remove gate later at scale | Allowed only via explicit product reversal of this ADR. |

## Decision

**Keep** admin-gated creator approval before upload and go-live. Monetization eligibility remains a **separate** read-only YouTube-Partner-style threshold (no ads).

## Code evidence

- `User.creatorStatus`, `POST /users/me/request-creator`, admin `/creator-approvals`
- Web `/upload/become-creator`, `/waiting-approval`; mobile `requestCreator`

## Consequences

- Do not remove `CreatorApprovedGuard` without reversing this ADR.
- Onboarding copy must explain the wait; do not fake YouTube “upload now.”
