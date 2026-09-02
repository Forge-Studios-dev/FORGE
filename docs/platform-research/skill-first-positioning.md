# Platform Research — Skill-First Positioning

**Slug:** `skill-first-positioning`  
**Audience:** Product, engineering, stakeholders.  
**Status:** Authoritative product positioning (re-audit 2026-09-02). Supersedes Aug 2026 “YouTube-replica + retired skill layer” framing.

---

## 1. What FORGE is

**FORGE is a skill-first creator platform powered by YouTube-style mechanics.**

| Layer | Description |
|-------|-------------|
| **Mechanics** | YouTube-parity video platform: channels, VOD, Shorts, live, subscriptions, playlists, comments, search/feeds/recs, Studio, Community tab (posts/polls), Stripe monetization |
| **Positioning** | Vertical focus on skills/crafts creators and learners — taxonomy, trust, discovery, and creator tools tuned for teaching, not entertainment-first |
| **Extensions** | Courses (video-lesson collections), mentorship, channel points — **selectively re-enabled**, not a full LMS |
| **Excluded** | Coursera/Kajabi-class LMS: SCORM, formal accreditation, assignment grading pipelines, Netflix-style library UX |

---

## 2. Competitive landscape (re-audit 2026-09)

### YouTube — mechanics reference

- **Upload/live:** Self-serve from account creation; no creator approval gate.
- **Monetization:** Partner Program tiers (500 subs early access; 1,000 subs + watch hours/Shorts views for ads). FORGE mirrors eligibility thresholds read-only; **no ad network**.
- **Community:** Text/image posts + polls on Community tab; no Discord-style rooms.
- **Discovery:** Algorithmic Home + Subscriptions feed + search; genre taxonomy (Gaming, Music, Education).

**FORGE adopts:** mechanics, Studio IA patterns, engagement loops, monetization eligibility shape.  
**FORGE diverges:** skills/crafts taxonomy, admin-gated creator approval, Communities rooms/events as extension, no ads.

### Skillshare — vertical reference (not full copy)

- **Class model:** 20–60 min total, 2–8 min lessons, hands-on project required.
- **Discovery:** Category/skill browse + search within subscription library.
- **Creator pay:** ~20% of subscription revenue pool by paid minutes watched; eligibility thresholds (50 followers, 400+ min/month).
- **Not FORGE:** Platform-wide subscription pool; FORGE uses per-creator Stripe Connect + memberships.

**FORGE adopts:** Skill taxonomy, lesson-length guidance, project-oriented course framing.  
**FORGE excludes:** Skillshare royalty pool model (use creator-owned monetization instead).

### Patreon — monetization reference

- Tiered memberships, creator-owned audience, Stripe-style payouts.
- **FORGE already ships:** Stripe Connect destination charges, tier entitlements, Super Thanks/Super Chat.

### Twitch — engagement reference

- Channel points for live engagement; reward redemptions.
- **FORGE:** Re-enable `ChannelPointsModule` behind `FEATURES_CHANNEL_POINTS`; tie to live + community engagement.

### Discord / Circle — community reference

- Real-time rooms + events beyond YouTube Community tab.
- **FORGE:** Keep Communities 2.0 rooms/events as **labeled extension** for skill communities (cohorts, office hours).

### Kajabi / Coursera — explicit non-goals

| Capability | Kajabi/Coursera | FORGE |
|------------|-----------------|-------|
| SCORM/xAPI | Yes | No |
| Formal certificates/accreditation | Yes | Optional lightweight certs only; not accreditation |
| Assignment grading | Core | Deferred / not MVP |
| Drip campaigns / email automation | Core | Use notifications + scheduled publish |
| Unified LMS gradebook | Core | No |

---

## 3. Skill module scope (MVP vs full backend)

Backend modules exist but UI was removed Aug 2026. Re-enable scope:

| Module | MVP scope | Keep gated (full LMS) |
|--------|-----------|------------------------|
| **Courses** | Video-linked lessons, publish catalog, enroll, progress; creator Studio builder | Quizzes, assignments, certificates, cohorts, creator programs |
| **Mentorship** | Community-scoped mentor profiles, match requests, basic session booking | Admin marketplace, cross-community matching |
| **Channel points** | Earn on live/chat; creator-defined rewards; redemption | Cross-platform marketplace |
| **Articles, podcasts, study groups, Q&A** | Off | Behind `FEATURES_SKILL_ECONOMY_LMS` only |

---

## 4. Intentional divergences from YouTube

Documented product choices (not bugs):

1. **Admin-gated creator approval** — trust gate for skill/crafts vertical; upload/live blocked until approved.
2. **Skills/crafts taxonomy** — `Category`/`Subcategory`/`SkillTag` seeded for crafts (e.g. Woodworking → Carving); not YouTube genres.
3. **Communities rooms/events** — extension for cohort learning; YouTube has no equivalent.
4. **No ad revenue** — monetization via memberships, tips, courses (future), not RPM/CPM.
5. **Courses not in unified `/search`** until P4 discovery work ships.

---

## 5. Technical stack validation (2026-09)

| Decision | Verdict | Notes |
|----------|---------|-------|
| Mux + S3 VOD | **Keep** | Production path on Fly; FFmpeg dev fallback |
| Postgres FTS search | **Keep** until 500K videos | Meilisearch at F-1302 trigger |
| SQL heuristic recs | **Keep** for MVP | pgvector slice per AI strategy at 100K+ MAU |
| BullMQ on Fly worker | **Keep** | Document SPOF; scale worker replicas before API |
| Neon Postgres | **Keep** | Connection budget per `NEON_COST.md` |
| JWT + MFA + cookies | **Keep** | Production-ready |

---

## 6. Assumptions

- Skill-first positioning supersedes Aug 2026 “retire skill layer” decision.
- Full LMS modules (articles, podcasts, study groups) stay off unless explicitly rescoped.
- CSAM/pre-publish scanning remains a **pre-launch blocker** for open public upload at scale.

---

*Re-audit 2026-09-02. Cross-ref: [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md).*
