# ADR-008: Recommendations approach

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

`RecommendationsService` is multi-signal SQL (follows, session, category affinity, 7-day trending, ~15% exploration). No embeddings. Sep 2 claimed “course-aware ranking in P4”; **code was not course-aware** (gap closed 2026-09-03).

## Research

- YouTube: candidate generation (two-tower / ANN / now generative retrieval) + heavy ranking (MMoE / LRMs). That stack needs billions of examples and specialized infra (Covington 2016 → PLUM/Gemini LRM 2025).
- At FORGE’s current corpus, SQL retrieval + diversification matches how every successful video MVP starts (subscriptions + related + trending).
- pgvector/two-tower before 100K MAU is cost and ops without data.

## Alternatives considered

| Option | Why not |
|--------|---------|
| pgvector / two-tower now | No labeled engagement at YouTube scale; Neon pgvector is the **right later slice**, not the first. |
| Meilisearch for recs | Search sidecar ≠ personalized ranking. |
| Course-only feed | Learners still need VOD/Shorts; courses are a boost signal, not the only surface. |

## Decision

**Keep SQL heuristics** as production recs. Add course-enrollment boosts (lesson videos) when courses exist. Invest in **pgvector semantic retrieval at 100K+ MAU** or when forYou quality metrics stall — see `AI-LLM-STRATEGY.md`. Meilisearch remains a **search** trigger (ADR-010), not a recs engine.

## Code evidence

- `apps/api/src/modules/content/recommendations.service.ts`
- Feed `forYou` → RecommendationsService

## Consequences

- Monitor watch-through and follow-rate on forYou.
- Index `watch_history(watched_at)` for trending CTEs (R3).
