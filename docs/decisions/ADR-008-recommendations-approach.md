# ADR-008: Recommendations approach

**Status:** Accepted (2026-09-02)

## Context

`RecommendationsService` uses SQL heuristics (category affinity, trending, session signals). No ML/embeddings.

## Decision

**Keep SQL heuristics** for MVP scale. Invest in pgvector semantic search slice at **100K+ MAU** per `AI-LLM-STRATEGY.md`. Course-aware ranking added in P4 when courses UI ships.

## Consequences

- No immediate ML infra
- Monitor feed quality metrics; revisit at MAU trigger
