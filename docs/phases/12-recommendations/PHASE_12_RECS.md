# Phase 12 — Recommendation Engine

**Status:** Complete for discovery voice + existing forYou/related stack. Corrected 2026-08-09 — diversity re-ranking, Shorts ranking, and "not interested" were listed below as Deferred but are shipped; see `docs/PLATFORM_AUDIT_2026-08-09.md §2.5`.

## Goal

Keep the existing affinity/`forYou` feed and related rails; remove skill-economy framing from home discovery surfaces.

## Already in platform

- `sort=forYou` personalized feed (affinity)
- Following / Subscriptions tab
- `GET /videos/:id/related` content-based up-next
- Freshness/diversity re-ranker (`feed-diversity.util.ts` — `diversifyByCreator`, used in feed/recommendations/shorts)
- Shorts-specific ranking (`shorts-rank.util.ts` — freshness + engagement, soft creator diversity)
- "Not interested" feedback loop (`not-interested.util.ts`, applied in feed/recommendations/shorts queries)

## Shipped this pass

- Guest CTA and creator apply copy → video platform voice
- Feed empty / page-cap copy: lessons → videos
- Mobile related fallback title: Video

## Deferred

- Session-based ("this sitting") personalization signal
- Exploration budget in `forYou` ranking (cold-start for new creators, not just viewers)
- Regionalization/time-window tuning for `RecommendationsService.getTrending` (only partially verified — see audit assumptions)

See [PHASE_12_REPORT.md](./PHASE_12_REPORT.md).
