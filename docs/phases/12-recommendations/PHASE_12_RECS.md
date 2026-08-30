# Phase 12 — Recommendation Engine

**Status:** Complete for discovery voice + existing forYou/related stack. Corrected 2026-08-09 — diversity re-ranking, Shorts ranking, and "not interested" were listed below as Deferred but are shipped; see `docs/PLATFORM_AUDIT_2026-08-09.md §2.5`.

## Goal

Keep the existing affinity/`forYou` feed and related rails; remove skill-economy framing from home discovery surfaces.

## Already in platform

- `sort=forYou` personalized feed (affinity)
- Following / Subscriptions tab
- `GET /videos/:id/related` content-based up-next
- Freshness/diversity re-ranker (`feed-diversity.util.ts` — `diversifyByCreator` + `applyExplorationBudget`, used in feed/recommendations/shorts)
- Shorts-specific ranking (`shorts-rank.util.ts` — freshness + engagement, soft creator diversity)
- "Not interested" feedback loop (`not-interested.util.ts`, applied in feed/recommendations/shorts queries)
- First-page forYou exploration budget (~15% off-affinity weave) — Wave 33
- Session category boost (2h `watched_at` window prepended to affinity list) — Wave 34
- Session creator dwell (`session-watch.util` Redis list from ≥15s watches; `session_affinity` score) — Wave 36
- Trending time windows (`window=now|week` on `GET /videos/trending`; `watched_at` velocity) — Wave 38

## Shipped this pass

- Guest CTA and creator apply copy → video platform voice
- Feed empty / page-cap copy: lessons → videos
- Mobile related fallback title: Video

## Deferred

- Geo-regional trending (no reliable viewer country/region signal on User yet)

See [PHASE_12_REPORT.md](./PHASE_12_REPORT.md).
