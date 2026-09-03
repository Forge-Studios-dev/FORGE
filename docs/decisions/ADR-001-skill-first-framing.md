# ADR-001: Skill-first product framing

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version; Aug 2026 “YouTube-replica core + retired skill layer”

## Context

Docs, agent rules, and the Aug 2026 platform audit disagreed on whether FORGE is a YouTube clone, a Creator Economy OS, or a skill-first vertical. The Sep 2 ADR chose skill-first; this pass re-proved it against code and competitors.

## Research

- **YouTube** is the right *mechanics* reference (channels, VOD, Shorts, live, subs, Studio, Community posts/polls, Partner-style eligibility) but is entertainment-first with open upload and an ad network.
- **Skillshare** is the right *courses* reference (short video-lesson collections, not Coursera LMS).
- **Patreon / Twitch** inform memberships, Super Chat, and channel points — not the home surface.
- Building a generic YouTube replica without a vertical is a commodity; the existing `Category` / `SkillTag` seed, creator approval gate, and flag-gated courses/mentorship/points already encode a skill vertical in code.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Pure YouTube replica | Conflicts with shipped taxonomy, approval gate, communities rooms/events, and stakeholder direction. Agent rule `forge-youtube-replica` must not delete those. |
| Full LMS / Skill Economy OS | SCORM, accreditation, grading are non-goals; backend LMS tables exist but stay behind `FEATURES_SKILL_ECONOMY_LMS`. |
| Skillshare-only (no UGC video) | Throws away Mux/live/Shorts stack already in production. |

## Decision

**Keep:** FORGE is a **skill-first creator platform powered by YouTube-style mechanics**. YouTube patterns govern video, discovery, and engagement. Skill taxonomy, trusted-creator approval, teaching-weighted KPIs, and selective extensions (courses, mentorship, channel points) define the product.

## Code evidence

- Flags: `apps/api/src/common/features/skill-platform.ts`
- Clients: `GET /platform/config` → `skillFeatures`
- Taxonomy: `apps/api/src/modules/categories/entities/`

## Consequences

- Product SSOT is `FORGE_PRODUCT_STRATEGY.md`. Agent rules: `forge-product` wins framing; `forge-youtube-replica` is mechanics-only.
- Do not sunset skill modules to “match YouTube.”
