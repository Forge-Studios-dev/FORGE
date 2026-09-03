# ADR-003: Skills/crafts category taxonomy

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version; YOUTUBE_PARITY_ROADMAP §0.5 “migrate to YouTube genres”

## Context

`Category` / `Subcategory` / `SkillTag` are seeded for crafts (e.g. Woodworking → Carving). Aug 2026 listed a YouTube-genre migration as open.

## Research

- YouTube genres (Gaming, Music, Education) optimize a horizontal entertainment graph.
- Skill discovery needs **browse-by-craft** (Skillshare/Domestika pattern): category → skill tag → creators and courses.
- A genre migration would destroy vertical SEO and Explore chips already wired to skill slugs.

## Alternatives considered

| Option | Why not |
|--------|---------|
| YouTube genre taxonomy | Wrong IA for skill-first; costly recategorization. |
| Dual taxonomies | Extra complexity; no user research justifying both. |

## Decision

**Keep** skills/crafts taxonomy as the only browse tree. YouTube-like *filters* (duration, captions, Shorts vs long-form) stay on search, not as top-level categories.

## Code evidence

- `apps/api/src/modules/categories/`
- Web `/explore`, `/explore/skills/[slug]`

## Consequences

- No mass re-categorization migration.
- Discovery UX emphasizes skill browse, not YouTube genre chips.
