# Discovery, Search & Recommendations — Platform Research

**Slug:** `discovery-search-recommendations`
**Status:** Historical research (Aug 2026). **Not SSOT.** Recs/search decisions: [ADR-008](../decisions/ADR-008-recommendations-approach.md), [ADR-010](../decisions/ADR-010-search-fts.md), audit 2026-09-03.
**Domain covers:** search infrastructure and ranking, categorization/taxonomy, recommendation systems (home feed, up-next/related, personalized/trending), the watch/viewing experience, and the home/feed experience.

---

## 1. Overview & Scope

This domain is the connective tissue of the product: it decides what a viewer sees on Home, what surfaces when they search, what plays next after a video ends, and how content is organized (categories/tags) so those systems have something to rank. Concretely, in FORGE:

- **Search** — `apps/api/src/modules/search` (Postgres FTS + ILIKE fallback), consumed by `apps/web/src/app/search`, `apps/mobile/lib/features/explore`.
- **Taxonomy** — `apps/api/src/modules/categories` (`Category` → `Subcategory` → `SkillTag`, many-to-many `SkillTag ↔ Video`), consumed by upload, feed filtering, search boosting, and the web `/explore` surfaces.
- **Recommendations / Feed** — `apps/api/src/modules/feed` (`FeedService`: latest/popular/forYou/following sorts, related/up-next, not-interested, mute) and `apps/api/src/modules/content/recommendations.service.ts` (SQL-based personalized feed + trending, used as the forYou engine for the unfiltered home case).
- **Watch/viewing experience** — video detail + player surfaces in `apps/web/src/app/watch`, `apps/mobile` watch screens, and the `RelatedVideos` up-next rail.
- **Home/feed experience** — `apps/web/src/app/page.tsx`, `HomeFeedTabs`, mobile home screen, `/explore`, `/trending`.

This document treats "video" as the atomic discoverable unit per YouTube parity (per `forge-youtube-replica.md`), and flags every place FORGE's actual data model (courses, cohorts, skill tags) diverges from that unit.

---

## 2. YouTube Reference Model

### 2.1 Search

- **Relevance, engagement, quality** are the three declared pillars. Relevance = title/description/tags/transcript match to query. Engagement = watch time and CTR *for that query specifically* (a video's general popularity is not the same as its performance against a given search term). Quality/authoritativeness = channel-level trust signals, weighted more heavily for YMYL-adjacent categories (news, health, finance) than for entertainment/music, where freshness and raw popularity matter more.
- Search is **personalized**: the same query returns different results per-viewer based on watch/search history and locale.
- **Autocomplete/suggest** blends query-log frequency, trending queries, and personal history; typo-tolerant (edit-distance / phonetic matching), not just prefix match.
- Results blend **video, channel, playlist, and (occasionally) Short shelves** in one ranked response, not separate silos per content type.
- Metadata indexed: title, description, tags, captions/transcript text, category. Transcript search is a meaningful differentiator (finds moments *inside* a video, not just metadata).

### 2.2 Recommendations (Home / Up-Next / Trending)

Two-stage architecture (Covington et al., "Deep Neural Networks for YouTube Recommendations", and current-generation descendants):

1. **Candidate generation** — narrows the full catalog (billions of videos) to a few hundred candidates per user via learned embeddings of user watch history and video co-occurrence (collaborative filtering at scale), plus explicit signals (subscriptions, search history, demographics, session context).
2. **Ranking** — a heavier model scores the few hundred candidates using hundreds of features (categorical embeddings + normalized continuous features) and predicts **expected watch time** (not just click probability, to disincentivize clickbait). Top signals: prior interaction with the same channel/topic, session recency (what was just watched in this sitting), and impression discounting (don't over-serve a video the user already saw and skipped).
3. **Re-ranking / policy layer** — diversity (don't show 5 videos from the same channel back to back), freshness boosts for new uploads, exploration budget (some slots reserved for untested content so the system can learn), and safety/demonetization/misinfo suppression.

- **Up-next / related** uses the same ranking stack scoped to "what follows this specific watch session," weighted toward session continuity (same topic/channel) over raw popularity.
- **Trending** is a distinct, mostly non-personalized, velocity-based surface (view/engagement velocity over a rolling window), regionalized.
- **Explicit feedback loops**: "Not interested" and "Don't recommend this channel" feed directly back into candidate generation as negative signals, not just filters on top.
- **Shorts** get a materially different ranking pass (single-column, low-friction swipe, weighted toward completion rate and re-watch rather than watch-time-in-minutes, since videos are ≤60s).
- **Scale/failure considerations**: recommendation and search results are cached per (user-cohort or exact-user) with short TTLs; ranking degrades gracefully to popularity/trending when personalization signals are sparse (new users / logged-out — the "cold start" problem); everything is engineered for p99 latency budgets in the tens of milliseconds because it sits on the critical path of every page load.

### 2.3 Categorization / Taxonomy

YouTube's public-facing taxonomy is a flat, shallow set of ~15 verticals (Music, Gaming, News, Sports, Education, etc.) used mostly for browse/trending segmentation and ad targeting — it is **not** the primary discovery mechanism. The real discovery unit is the tag/topic graph derived from metadata + Knowledge Graph entities, plus channel-level topical identity learned from history, not hand-picked hierarchical categories. Creators pick one shallow category at upload but the system does the heavy semantic lifting itself.

---

## 3. Secondary-Platform Notes

- **TikTok (For You feed)** — near-total weighting on the recommendation feed over search/subscriptions as the primary surface; extremely fast interest-convergence (measurable shift in served content within ~200 videos), driven almost entirely by implicit signals (watch-through %, rewatch, dwell) rather than explicit follow/like graphs. Worth considering for FORGE's Shorts surface specifically: a single always-on ranked feed, not a paginated list, with signal capture on skip-speed as a first-class negative signal. Trade-off: TikTok-style over-indexing on implicit signals can create echo chambers/rabbit holes faster than YouTube's more graph-anchored (subscriptions/channel identity) model — worth deciding deliberately rather than adopting silently.
- **Twitch (categories + directory)** — its category/game directory is genuinely load-bearing for discovery (unlike YouTube's cosmetic categories) because live content can't be indexed by transcript/watch-time history the same way; browse-by-category with live viewer-count sort is the primary discovery path for live. Relevant to FORGE because it already has `live-broadcast` and `streaming` modules — if live discovery is in scope, it likely needs a *different* ranking path (viewer-count velocity, not personalized watch-time prediction) rather than being forced through the VOD `forYou` pipeline.
- **Vimeo** — de-emphasizes algorithmic discovery entirely in favor of curated staff picks/channels; not a strong pattern to borrow for a YouTube-parity product, but confirms that "search + explicit browse" without a recommendation engine is a legitimate (if lower-growth) fallback mode worth having for cold-start/new-account users.

---

## 4. Current FORGE State (grounded in code + existing docs)

### Existing docs reviewed

| Doc | Claim | Verification |
| --- | --- | --- |
| `docs/phases/11-search/PHASE_11_SEARCH.md` | "Complete for filter parity slice"; ships `type=all\|video\|channel`, cache `search:v2` | **Outdated.** Code (`search.service.ts`) is at cache key `search:v8`, supports `type=all\|video\|channel\|playlist`, and full filter set: `duration`, `uploaded`, `sort`, `captions`, `kind`, `watched`. Playlist search and most filters listed as "Deferred" in this doc are actually shipped. |
| `docs/phases/11-search/PHASE_11_REPORT.md` | "~85% complete… embedding search deferred" | Consistent with code — no vector/embedding search found; FTS (`plainto_tsquery`) + ILIKE fallback only. |
| `docs/phases/12-recommendations/PHASE_12_RECS.md` | "Deferred: Freshness/diversity re-ranker, Shorts-specific ranking, explicit Not-interested loop" | **Outdated/incorrect.** `diversifyByCreator` exists and is applied to forYou/related/personalized results (`feed-diversity.util.ts`, tested in `feed-diversity.util.spec.ts`, `for-you-ranking.spec.ts`). `markNotInterested` / `muteChannelRecommendations` are implemented (`not-interested.util.ts`, backed by Redis). A `shorts-rank.util.ts` exists with its own `ShortRankSignals`/tests, suggesting Shorts-specific ranking is at least partially built, contrary to the doc. |
| `docs/phases/12-recommendations/PHASE_12_REPORT.md` | "~60% complete; ML-depth deferred" | Roughly accurate — ranking is hand-tuned SQL scoring (follow/affinity/category weights + popularity), not a learned model. No embeddings, no candidate-generation/ranking two-stage split. |
| `docs/phases/04-navigation/PHASE_04_NAVIGATION.md`, `PHASE_04_REPORT.md` | AppShell modes, `/explore/skills/*` redirects to search, mobile bottom IA (Home/Shorts/Create/Subs/You) | Consistent with what's described; not independently re-verified beyond routing structure since this is a navigation, not ranking, doc — no code contradiction found. |

**Conclusion:** both search and recommendations docs are stale relative to `main` — they undercount what's shipped (search filters, diversity re-ranking, not-interested) and should be refreshed regardless of the deeper product-framing issue below.

### Code inventory (verified via codegraph)

- **Search** (`apps/api/src/modules/search/search.service.ts`): Postgres FTS (`searchVector @@ plainto_tsquery`) with ILIKE fallback on FTS failure; per-query-shape Redis cache (`search:v8:<hash>`, skipped when a personal `watched` filter is set); excludes muted/blocked creators; ranks `type=video` by `ts_rank_cd` with `sort=relevance|date|views`; independent `type=channel` ranking by `ts_rank_cd` + follower count; `type=playlist` via title/description `ILIKE` (no FTS, no ranking beyond `updatedAt`). Suggestions endpoint (`/search/suggestions`) exists but is prefix-based, not typo-tolerant.
- **Taxonomy** (`apps/api/src/modules/categories`): 3-level hierarchy `Category → Subcategory → SkillTag`, plus `SkillTag ↔ Video` many-to-many. `CategoriesService.suggestSkillTags` does deterministic token-overlap scoring against title/description for the upload picker (no ML/LLM call — explicitly documented as such in the code comment). Category browsing surfaces at `/explore/[category]` and `/explore/skills/[slug]` (web), `explore_screen.dart` (mobile).
- **Feed / recommendations** (`apps/api/src/modules/feed/feed.service.ts`, `apps/api/src/modules/content/recommendations.service.ts`):
  - Sorts: `latest`, `popular` (`view_count*0.6 + like_count*0.3 + recency*0.1`), `forYou`, plus a separate `following` feed.
  - Unfiltered home `forYou` (no category/tag) delegates to `RecommendationsService.getPersonalizedFeed`, a raw-SQL query joining followed creators, watch-history categories, and a `recent_views >= 3` trending floor, falling back to `getTrending` when short on rows.
  - Category/tag-filtered `forYou` uses an inline weighted SQL score instead: `follow (2.0) + creator-affinity (1.0) + category-affinity (1.5) + popularity`, computed from the last 200 watch-history rows.
  - `diversifyByCreator(data, 2)` caps consecutive-same-creator results in forYou, related, and personalized feeds.
  - Negative feedback: `markNotInterested` (per-video, Redis-backed) and `muteChannelRecommendations`/`muteChannelFromVideo` (per-creator mute) both exclude from feed and search.
  - `getRelatedVideos` (watch "up next") reuses `POPULAR_SCORE_SQL`-style scoring plus creator diversification; `RelatedVideos.tsx` falls back to a skill-tag text search if the related endpoint returns nothing.
  - Cursor-based pagination throughout (`encodeCursor`/`parseCursor`, tuple comparison for stable ordering) — no offset pagination on hot list endpoints, good.
  - Cache invalidation via a Redis "generation" counter (`feed:cache:generation`) bumped on writes rather than deleting individual keys — reasonable pattern for fan-out invalidation.
  - No embeddings, no ML model, no two-stage candidate-generation/ranking split, no session-based (this-sitting) signal — all personalization is watch-history aggregate + explicit follow graph.
- **Route ordering hazard** (self-documented in code): `FeedController`'s own comment in `feed.controller.ts` states that `feed`, `public`, and `by-skills` routes must live on `VideosController` instead of `FeedController` because of Express 5 route-registration order — a real footgun for future contributors adding routes to this domain.

### Product-framing conflict, grounded in code

`docs/FORGE_PROJECT_MASTER.md` (line 12) frames FORGE as "a skill-first creator platform: on-demand lessons, live teaching, categories/skill tags, communities, and mock memberships," and lists (lines 107–117, 280–283, 489–508) a full **`CoursesModule`** (catalog, cohorts, lessons, enrollment, progress, quizzes, assignments, grading, certificates) and **`ChannelPointsModule`** (Twitch-style points) and **Mentorship** (`MentorshipService`, skill-overlap matching) as first-class root modules — separate entirely from `apps/api/src/modules/content` (videos).

Grounding this against the discovery surfaces specifically:
- `CoursesController` exposes its own `GET courses/discover` and `GET courses/discover/featured`, **completely separate from** `/search` and `/videos/feed/*`. A course is not searchable through the unified search endpoint, not eligible for the `forYou` feed, and not part of the related/up-next rail.
- The taxonomy (`Category`/`Subcategory`/`SkillTag`) is named and shaped for a "skills" framing (skill tags, skill-overlap mentorship matching) rather than YouTube's topic/category model, even though it's reused as FORGE's video category system.
- The web IA has a fragmented result: `/explore`, `/explore/skills/*`, `/discover/communities`, `/trending`, and (implicitly) a courses discovery surface that isn't wired into any of the above.

This is a direct, unresolved instance of the tension called out in `forge-youtube-replica.md`: the mandate says "if existing FORGE behavior conflicts with YouTube parity → remove or refactor toward YouTube, don't extend the divergence as FORGE-unique," but Courses/Cohorts/Certificates/Mentorship/Channel-Points are a *structural* divergence (a second, parallel discoverable-content type and its own discovery surface) that the discovery domain has not reconciled with the single-content-type ("everything is a video, optionally organized into playlists") model YouTube actually uses. **This document does not resolve it** — see `conflictsWithOtherDocsOrRules` in the structured output and Open Questions §7 below — but recommendations in §6 are written to work either way (they degrade cleanly if Courses stay a separate module, and compose cleanly if Courses are eventually reshaped into playlists-of-videos).

---

## 5. Gap Analysis

| Gap | Severity | Current State | Target State (YouTube parity) | Recommendation |
| --- | --- | --- | --- | --- |
| Phase 11/12 docs are stale (undercount shipped features) | Medium | Docs say search filters/diversity/not-interested are "deferred"; code has shipped them | Docs accurately reflect `main` | Refresh `PHASE_11_SEARCH.md`/`PHASE_12_RECS.md` status tables against current code before next planning pass |
| No transcript/caption search | High | FTS indexes title/description/tag/category only (`v.searchVector`); caption tracks exist (`caption_tracks`, `caption_url`) but aren't in the search index | Search finds moments *inside* videos via transcript text | Extend `searchVector` (or a companion FTS column) to include caption text; requires re-indexing on caption upload/edit |
| No embedding / semantic search | Medium | Pure lexical FTS + ILIKE fallback; explicitly deferred in Phase 11 report | Query understanding beyond exact/stemmed term match (synonyms, misspellings, concept match) | Track as a distinct roadmap item; do not block on it — lexical search + good filters covers most YouTube-parity ground first |
| Playlist search has no ranking | Medium | `searchPlaylists` uses `ILIKE` + `ORDER BY updatedAt DESC` only — no relevance scoring, no FTS | Playlists ranked by relevance like videos/channels | Add an FTS column to `Playlist` or at minimum rank by relevance-then-recency instead of `updatedAt` alone |
| No two-stage candidate-generation/ranking split | Low-Medium (architecture debt, not a user-facing bug yet) | Single SQL query with hand-weighted linear score computed against last-200-watched-history rows | Candidate set narrowed by embeddings/co-occurrence, then a richer ranking pass | Not urgent at current scale; flag as the first thing to revisit if the catalog/user base grows enough that the raw-SQL join becomes a bottleneck (see Scalability below) |
| No session-based ("this sitting") signal | Medium | Personalization is aggregate watch-history (last 200 rows) — no notion of "what did the user watch in the last 10 minutes" | Up-next and forYou weight recent-session context heavily | Add a short-TTL Redis session-signal (recently watched video IDs/categories in this session) and fold into the `forYou`/related scoring alongside the existing affinity terms |
| Trending is not regionalized / has no dedicated velocity window | Low | `RecommendationsService.getTrending` — need to confirm exact windowing (not fully inspected) but no locale/region parameter found anywhere in the search/feed/recommendations code reviewed | Trending computed per-region over a rolling window | Confirm current trending window logic; add region/locale dimension if/when i18n is prioritized elsewhere in the platform |
| No explicit exploration budget | Low | forYou always ranks by the deterministic weighted score — no reserved slots for untested/new content | Some inventory served outside pure personalization so the system can learn and new creators aren't permanently invisible | Add a small (e.g. 1-in-10) exploration slot in forYou that samples from recent-but-unscored videos, independent of the affinity score |
| Shorts ranking maturity unclear vs. doc claim | Low (needs verification) | `shorts-rank.util.ts` + `ShortRankSignals` + tests exist, contradicting Phase 12 doc's "Deferred: Shorts-specific ranking" | Shorts ranked by completion/rewatch rather than watch-minutes | Re-verify current `shorts-rank.util.ts` logic against this doc's claim and correct whichever is wrong before relying on either |
| Fragmented discovery surfaces (video vs. course) | **High** | `courses/discover*` is a separate, unranked endpoint disconnected from `/search`, `/videos/feed/*`, and `/videos/:id/related` | Single discoverable unit (video, or video+playlist) surfaced everywhere uniformly | Product decision required — see conflicts/open questions. Do not silently merge or silently ignore |
| Taxonomy naming/shape is skill-economy-flavored | Medium | `SkillTag` entity, `explore/skills/*` routes. **Correction, 2026-08-13 re-audit:** Mentorship's skill-overlap matching does *not* reuse these tables — `Mentorship.skills` is an independent free-text `string[]` (`mentorship.entity.ts`), matched by case-insensitive substring in `mentorship.service.ts`, with zero FK/reference to `SkillTag`/`Category`/`Subcategory`. The coupling this row originally claimed doesn't exist. | YouTube's category/topic model is flat and cosmetic, not a skills hierarchy | Depends on the same product decision; if resolved toward YouTube parity, plan a rename/reshape of `SkillTag`→ generic `Tag`/topic. No mentorship-side migration needed — it was never coupled, which *lowers* the cost of this rename versus what was previously assumed |
| No "Don't recommend this channel"-style negative signal surfaced in search | Low | `muteChannelRecommendations` excludes muted creators from feed **and** search (confirmed: `excludedCreatorIds` used in both `SearchService` and `FeedService`) — actually already consistent | No gap — noting as a positive finding, not a defect |
| Cache correctness risk: forYou is never cached, but category/tag-filtered feed is cached, and cache key doesn't vary by not-interested/mute list | Medium | `feed:v4:g${gen}:...` cache key omits per-user muted/not-interested state; only bypassed for uncategorized `forYou`. A logged-in user hitting `latest`/`popular` with categoryId set could theoretically get a cached response computed before their mute took effect... but exclusion filters only apply `if (options.userId)`, and caching is skipped `if (!options.userId ...)` for the general path — for `sort!=forYou` the cache write only happens when `!options.userId`, so this is actually safe as built. | — | Verified safe; no action needed, but worth a code comment since the interaction is non-obvious (future contributors should not casually add authenticated caching here) |
| Playlist / video-type search filter gaps | Low | `type=channel`/`type=playlist` ignore duration/uploaded/captions/kind/watched filters entirely (by design per code comment) rather than degrading gracefully | Filters that don't apply to a content type are simply inert, not silently dropping that content type | Acceptable as-is; document the behavior explicitly so it isn't "fixed" into a regression later |

---

## 6. Recommended Flows, Data Model & API Additions

These are written to be actionable without waiting on the Courses/YouTube-parity product decision — each is scoped to the existing `Video`/taxonomy model and composes cleanly whichever way that decision goes.

### 6.1 Transcript search

**Data model**: add a generated/maintained `transcript_search_vector tsvector` column (or fold into existing `Video.searchVector` via a Postgres trigger/generated column that concatenates title + description + tag names + caption plain-text). Caption plain text should be derived once from `caption_tracks`/`caption_url` at caption-save time (BullMQ job, not inline on the request path — captions can be large).

**Flow**:
1. On caption create/update (`SetCaptionUrlDto` / caption presign complete), enqueue a `index-video-transcript` job.
2. Job fetches the caption file, strips timing/markup, updates `transcript_search_vector`.
3. `SearchService.searchFts` adds `OR v.transcript_search_vector @@ plainto_tsquery('english', :fts)` to the video WHERE clause, and should down-weight transcript hits vs. title hits in `ts_rank_cd` (e.g., via `setweight` on each vector component — title=A, tags/category=B, description=C, transcript=D).

**Edge cases**: multi-language captions (index only the primary/default track, or one `tsvector` per language with an appropriate `regconfig`); very large transcripts (cap indexed length); caption deleted → clear the vector.

### 6.2 Session-aware "up next" / forYou boost

**Data model**: Redis-only, no schema change. Key `session:watch:{userId or anonId}` → capped list (last ~10) of `{videoId, categoryId, creatorId, watchedAt}`, short TTL (e.g., 30–60 min sliding).

**Flow**:
1. On `record-watch`/`record-view` (existing endpoints), also push into the session list (fire-and-forget, non-blocking).
2. `getRelatedVideos` and the category/tag-filtered `forYou` scoring add a `session_boost` term (e.g., `+1.0` for same category as anything in the session list, `+0.5` for same creator) alongside the existing follow/affinity/category-history terms.
3. Works for logged-out viewers too if an anonymous session ID is already available elsewhere in the codebase — confirm the codebase's existing anon-ID pattern before adding a new one.

### 6.3 Exploration slots in forYou

**Flow**: in `getFeed`'s forYou branch, reserve 1 of every ~10 returned slots for a video that: is discoverable, is <7 days old, has fewer than N impressions-in-feed (needs a lightweight impression counter — Redis `INCR` on `feed:impressions:{videoId}` with a rolling window), and passes the existing exclusion filters (not-interested, muted, blocked). Fall back to normal ranking if no such candidate exists. This directly targets the "new creators are invisible" cold-start failure mode common to any pure watch-history-affinity ranker.

### 6.4 Playlist search relevance

**Data model**: add `searchVector` to `Playlist` (title + description), FTS-indexed like `Video`/`User`.
**Flow**: mirror `searchFts`'s video/channel branches for playlists — `ts_rank_cd` ordering instead of `updatedAt DESC`; still respect `excludedCreatorIds`.

### 6.5 Negative-feedback quality signal (beyond hard exclusion)

Currently `markNotInterested`/mute are **hard excludes**. Recommend also recording a lightweight signal usable for *soft* down-ranking of similar-but-not-identical content: on not-interested, decrement the category-affinity weight for that video's category by a small amount for that user (bounded, decayable) rather than only ever excluding the exact video/creator. This closes the gap between "remove this one video" and "stop suggesting this whole topic," which is the actual YouTube behavior distinction between the two existing UI actions.

### 6.6 Unified discoverability (the conflict-dependent piece)

Do not implement without a product decision (§7), but the shape to build toward, if resolved as "courses become playlists + videos" per YouTube parity:

- Every enrollable "course" becomes a `Playlist` (system-owned or creator-owned) whose items are `Video`s; "lessons" map 1:1 to videos.
- `courses/discover*` is retired; discovery flows entirely through `/search?type=playlist|video` and `/videos/feed/*`.
- Cohort/certificate/quiz/assignment features (which have no YouTube equivalent) either move to a clearly-labeled "Learning" extension layered on top of playlists (progress tracked per playlist-item watch, not a parallel content type) or are explicitly scoped out of the YouTube-parity core and documented as an intentional, isolated extension per the "document intentional gaps only when forced" clause in `forge-youtube-replica.md`.

This is the single highest-leverage structural decision in this domain — every ranking/search improvement above is worth roughly 2x more once there's one discoverable content type instead of two disconnected ones.

---

## 7. Assumptions & Open Questions

**Assumptions made in this document:**
- "Faithful YouTube replica" (per `forge-youtube-replica.md`) is the standing mandate unless a human overrides it; this doc treats deviations as gaps to flag, not to silently fix.
- Current scale (dev/early-stage, per the raw-SQL personalization approach and lack of a dedicated recs infrastructure) means an ML/embedding-based candidate generator is *not* yet justified — flagged as low/medium severity, not urgent.
- The `shorts-rank.util.ts` existence claim is based on codegraph's file/symbol listing, not a full read of its logic — flagged explicitly as needing re-verification, not asserted as fact.
- Trending's exact time-window/regionalization logic in `RecommendationsService.getTrending` was not fully read line-by-line (only its signature/surrounding context) — the gap row for regionalization should be re-checked against the full method body before scoping work.

**Open questions requiring a product/human decision:**
1. **Courses vs. YouTube parity**: does the Courses/Cohorts/Quizzes/Certificates/Mentorship/Channel-Points cluster stay as FORGE-unique product surface (in explicit, documented tension with `forge-youtube-replica.md`), get reshaped onto YouTube's model (channels/videos/playlists/memberships/live/communities tab), or get removed? This blocks §6.6 and materially changes the taxonomy's target shape (§4, "Taxonomy naming/shape" gap).
2. Is a semantic/embedding search on the near-term roadmap, or should lexical FTS + the transcript-search addition (§6.1) be considered "done enough" for search in this domain for the foreseeable future?
3. Is there an existing anonymous-session identifier already used elsewhere in the codebase (for logged-out analytics, A/B, etc.) that §6.2's session-aware boost should reuse, rather than introducing a new one?
4. Should live-broadcast discovery (Twitch-style viewer-count/category directory, §3) be pulled into this domain's scope, or does it belong to a separate "Live" domain's documentation? The `live-broadcast`/`streaming` modules exist but were not deeply audited here since they weren't in this domain's listed doc set.
5. What is the actual current trending time-window and is it regionalized at all today? Needs a direct read of `RecommendationsService.getTrending`'s full body (only partially shown by codegraph in this pass).

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
