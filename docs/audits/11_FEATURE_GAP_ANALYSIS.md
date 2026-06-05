# Phase 11 — Feature Gap Analysis

**Audit date:** 2026-06-04  
**Baseline:** [FORGE_PROJECT_MASTER.md §16](../FORGE_PROJECT_MASTER.md) feature status matrix  
**Comparators:** YouTube, Twitch, Skillshare, Coursera, Patreon, Vimeo OTT (capability level, not UI clone)

---

## FORGE MVP strengths (present)

| Capability | API | Web | Mobile | Admin |
|------------|:---:|:---:|:------:|:-----:|
| Auth (JWT, OAuth) | ✅ | ✅ | ✅ | ✅ |
| Feed + FTS search | ✅ | ✅ | ✅ | — |
| VOD (Mux) | ✅ | ✅ | ⚠️ | ✅ |
| Live + stream chat | ✅ | ⚠️ | ⚠️ | — |
| Mock memberships | ✅ | ✅ | — | ✅ |
| Creator studio | ✅ | ✅ | — | ✅ |
| Communities (tier-gated) | ✅ | ✅ | — | — |
| Reports intake | ✅ | — | ✅ | — |
| Admin moderation | ✅ | — | — | ✅ |

---

## Gaps by priority (cost/scale-weighted)

### P0 — Blocks scale or revenue at next milestone

| Gap | vs competitors | FORGE today | Why P0 (cost/scale lens) |
|-----|----------------|-------------|--------------------------|
| Real payments (Stripe) | Patreon, Skillshare | Scaffold only (`BillingModule`) | Revenue; Mux delivery without monetization = pure COGS |
| Signed / entitled playback at scale | Vimeo OTT, Patreon | Entitlements hide URL; no DRM | Piracy risk increases CDN/Mux bill without recovery |
| Mobile VOD/live parity | YouTube app | ⚠️ partial | Mobile MAU shifts Mux costs without full control |

### P1 — Important for 100K MAU

| Gap | vs competitors | FORGE today |
|-----|----------------|-------------|
| Creator analytics depth | YouTube Studio | Partial ingest; studio UI partial |
| Automated moderation | YouTube, Twitch | Manual admin reports |
| Recommendation beyond heuristic | YouTube, TikTok | `forYou` score in SQL — no ML |
| Push notifications production-ready | All | FCM ⚠️ |
| VOD chapters / timestamps | YouTube | Not observed |
| Super Chat / live monetization | Twitch | Not present |
| Course structure (modules, progress) | Coursera, Skillshare | Playlist-only |

### P2 — Differentiation / retention

| Gap | vs competitors | FORGE today |
|-----|----------------|-------------|
| Offline download | YouTube Premium | No |
| Multi-language captions | YouTube | Not documented |
| Branding / custom creator domains | Kajabi | Single platform domain |
| Affiliate / referral | Patreon | No |
| Advanced community (forums, roles) | Discord | Channels + messages only |
| A/B thumbnails | YouTube | No |

### Future

| Gap | Notes |
|-----|-------|
| Vector / semantic search | Postgres FTS sufficient until catalog &gt;100K videos |
| Live co-streaming | Twitch |
| AI content moderation | Enterprise platforms |
| Multi-region active-active | 10M MAU tier |

---

## Monetization gap (detailed)

| Feature | Phase | Doc |
|---------|-------|-----|
| Mock tiers + admin grant | Phase 1 ✅ | `MEMBERSHIPS.md` |
| Stripe checkout + webhooks | Phase 2 ❌ | `BillingModule` scaffold |
| Mux signed URLs for paid VOD | Phase 2 ❌ | Mentioned in MEMBERSHIPS Phase 2 |

**Risk:** Scaling mock subscriptions to real users without payment rails increases support load without revenue offset.

---

## Streaming gap (detailed)

| Feature | YouTube/Twitch | FORGE |
|---------|----------------|-------|
| Live discovery feed | ✅ | ⚠️ web partial |
| DVR / replay | ✅ | Mux-dependent |
| Stream health dashboard | ✅ | Studio partial |
| Raids / hosts | Twitch | ❌ |
| Low-latency mode tuning | Twitch | Mux defaults |

---

## Admin / trust & safety

| Feature | Status |
|---------|--------|
| Report queue | ✅ admin |
| Auto-flag content | ❌ |
| Copyright / DMCA workflow | ❌ |
| Age restriction / geo block | ❌ |

---

## Findings

### F-1101: Stripe Phase 2 is P0 for sustainable unit economics

| Field | Value |
|-------|-------|
| **Severity** | P0 (business) |
| **Evidence** | `MEMBERSHIPS.md` Phase 2; no `BillingModule` HTTP |
| **Recommendation** | Implement Stripe before scaling marketing spend |
| **Expected impact** | Revenue offsets Mux/infra COGS |

### F-1102: Mobile playback gap increases cost without engagement — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Evidence** | Mobile watch lacked `accessDenied` handling |
| **Resolution** | `VideoModel.accessDenied` + watch screen parity with web/live; see [CLIENT_OVERVIEW.md](../CLIENT_OVERVIEW.md) |
| **Expected impact** | Better retention per Mux dollar |
