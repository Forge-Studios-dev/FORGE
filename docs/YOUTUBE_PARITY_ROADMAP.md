# FORGE YouTube-Parity Roadmap

**Audience:** Engineering, product, DevOps.
**Depends on:** [PLATFORM_AUDIT_2026-08-09.md](./PLATFORM_AUDIT_2026-08-09.md) §1 — this roadmap assumes the audit's recommendation (YouTube's core model as the authoritative frame; courses/mentorship/channel-points/rich-communities as explicitly-labeled, flag-gated extensions) is accepted. If product instead confirms "Creator Economy OS" as the permanent direction, re-scope this roadmap's MVP column accordingly — the phase-doc cross-references below still apply either way.
**Status:** Planning document. Does not itself change code, flags, or docs elsewhere; sequencing only.

---

## How to read this

Each row is a unit of work, mapped to:
- **Domain(s)** from the 8 platform-research docs.
- **Existing phase doc** under `docs/phases/NN-*/`, where one already exists for that surface, with a call-out on whether that phase doc is **ahead of**, **behind**, or **matches** the researched target state.
- **Tier**: MVP (blocks calling FORGE a coherent YouTube-parity product) / Post-MVP (materially improves parity or closes a real risk, not launch-blocking) / Future scale (only matters at meaningfully higher traffic/creator count).

Dependency ordering matters more than tier labels — several Post-MVP items are prerequisites for MVP items and are called out as such.

---

## 0. Prerequisite (blocks everything below)

| Item | Why it blocks the rest | Owner |
|---|---|---|
| Resolve the product-framing decision ([PLATFORM_AUDIT §1](./PLATFORM_AUDIT_2026-08-09.md#1-the-1-open-decision-what-is-forge-actually)) | Every domain's gap-prioritization below assumes an answer. Discovery can't finalize unified-search scope, monetization can't finalize eligibility gating, infra can't finalize capacity planning, security can't finalize privacy-policy scope, admin can't finalize IA — all six said so explicitly in their own docs. | Product + eng lead |
| Rewrite `FORGE_PROJECT_MASTER.md` §1 fully (this audit only added one callout sentence) | Downstream docs (`CLIENT_OVERVIEW.md`, `docs/README.md`'s framing of the V3.0 blueprint) key off this file | Docs owner, post-decision |

---

## 0.5 Open decisions, added 2026-08-13 (not guessed at — need an explicit owner)

The 2026-08-13 zero-trust re-audit ([PLATFORM_AUDIT_2026-08-09.md §6](./PLATFORM_AUDIT_2026-08-09.md#6-zero-trust-re-audit--fixes-2026-08-13)) found two items that are genuinely blocked on a decision this codebase can't make for itself — implementing either without sign-off risks doing expensive, hard-to-reverse work in the wrong direction:

| Item | Why it's blocked, not just unbuilt | Owner |
|---|---|---|
| ~~Shorts ranking uses freshness+views+likes (`shorts-rank.util.ts`), not completion/rewatch like YouTube's actual model~~ | **Resolved 2026-08-16.** This was a normal engineering tradeoff (precompute cadence/storage for an expensive aggregate), not a product/legal call — decided directly, following this codebase's own established pattern (`ScheduledPublishService`/`AnalyticsRetentionService`): `ShortsWatchPercentService` recomputes `Video.avgWatchPercent` hourly (BullMQ repeatable job) for Shorts published in the last 7 days only — `scoreShortForFeed`'s freshness term already zeroes past 168h, so older Shorts' completion rate has no ranking effect and recomputing them would be waste. `scoreShortForFeed` now weighs completion at up to 50 points (same scale as freshness), contributing 0 when not yet computed rather than penalizing new Shorts. Migration `2150000000000-shorts-avg-watch-percent`. 8 new/updated tests (`shorts-rank.util.spec.ts`, `shorts-watch-percent.service.spec.ts`), full content+workers suites (186 tests) green, typecheck clean. | — |
| Category taxonomy overhaul — `Category`/`Subcategory`/`SkillTag` is shaped and seeded for a skills/crafts marketplace (`Woodworking → Carving/Joinery`), not YouTube's flat genre model (Gaming, Music, Education...), yet every uploaded video is forced through it today | Re-seeding the primary classification for every existing video is a real data migration with user-facing impact (creators' videos would need re-categorizing), not a schema tweak. Doing it without product sign-off on the target taxonomy shape risks a second migration later. | Product + eng lead |
| CSAM / pre-publish content-safety scanning — `ContentScanService` defaults to `NoopContentScanProvider` (approves everything); no real vendor (Google CSAI Match, Thorn, PhotoDNA) is wired anywhere, and P0 reports (CSAM/terrorism) get triage-priority only, zero auto-action, by design (anti-abuse-of-reporting tradeoff) | This needs a vendor contract, credentials, and a legal/compliance sign-off on the chosen provider — not an engineering task. Treat as a **pre-launch blocker for any real-user video upload**, not a backlog item. | Legal/compliance + eng lead |

---

## MVP scope — "a coherent, honest YouTube-parity product"

Goal: close gaps that make FORGE's *shipped* video/channel/community core untrustworthy, insecure, or structurally incoherent — independent of which way the framing decision above goes, because these are true regardless of extension scope.

### MVP-1: Security & trust-boundary fixes (do first — these are bugs, not roadmap)

| Item | Domain | Phase doc | Status vs. researched target |
|---|---|---|---|
| Enforce `COMMUNITY-PERMISSION-MATRIX.md`'s 14-key permissions in the backend, not just display them in the UI | security, moderation | `docs/COMMUNITY-PERMISSION-MATRIX.md` (no phase doc) | **Mostly shipped** — matrix drives `assertCommunityPermission` / coach analytics & events (2026-08-12); coarse paths use role guards. See matrix doc “Enforcement status” |
| Bridge or consolidate the two non-communicating authz systems (platform `Permission`/`UserRole` vs. community role/permission-matrix) | security | none | **Explicit boundary:** platform JWT `Permission`/`UserRole`/`AdminTier` for product/admin APIs; community `CommunityRole` + `assertCommunityPermission` for community surfaces. Shared only via intentional bridges (`CommunityRoleGuard`). Full consolidation deferred (XL) |
| Merge or explicitly boundary the two disconnected moderation systems (platform `reports` table vs. community-moderation stack) | moderation | `docs/phases/07-admin/PHASE_07_ADMIN.md` | **Explicit boundary (Wave 25):** keep separate — platform T&S queue (`reports` + strikes/copyright) vs creator/community inbox (`community_reports` + Studio moderation hub). Full merge deferred (XL); do not invent a unified table without product IA |
| Fix stale code comment claiming no email-digest job exists (`notification-preferences.ts:54`) — it's live | engagement | `docs/phases/15-communication/PHASE_15_COMMUNICATION.md` | **Fixed** — `emailDigest` JSDoc cites the live `email-digest` BullMQ cron |

### MVP-2: Correct the record — phase docs that already understate shipped work

No code change required; these are pure doc-accuracy fixes that should land before any roadmap prioritization is trusted:

| Phase doc | Understates | Domain | Status |
|---|---|---|---|
| `docs/phases/11-search/PHASE_11_SEARCH.md` | Cache key, `type=playlist`, duration/date/sort/caption/kind/watched filters — all shipped, listed as deferred | discovery | **Corrected** — filters + playlist FTS shipped; Wave 32/35 suggest; **Wave 39** multi-track caption index + `?captions=<lang>`; remaining deferred is `pg_trgm` / non-English FTS configs |
| `docs/phases/12-recommendations/PHASE_12_RECS.md` | Diversity re-ranker, Shorts ranking, "not interested" feedback loop — all shipped (Shorts ranking flagged for re-verification), listed as deferred | discovery | **Corrected** — diversity / Shorts / not-interested / exploration / session signals shipped; **Wave 38** trending time windows (24h/7d) + `watched_at` fix; true geo-regional still deferred |
| `docs/phases/14-monetization/PHASE_14_MONETIZATION.md` vs. `PHASE_14_REPORT.md` | Same-phase self-contradiction on Super Thanks-for-VOD (shipped) | monetization | **Corrected** — phase doc notes Super Thanks VOD is shipped; remaining gap is unified payout ledger + ads |
| `docs/phases/15-communication/PHASE_15_COMMUNICATION.md` | Push preference matrix backend (category-mute, dispatch enforcement) is more complete than credited | engagement | **Corrected** — phase doc credits web + mobile push prefs + share tracking |
| `docs/phases/18-infrastructure/PHASE_18_INFRA.md`, `19-performance/PHASE_19_PERFORMANCE.md` | Both one-line "Documented/Verified" stubs; miss single-region risk, worker SPOF, dual-Redis architecture, load-test runbook that already exists | infra | **Corrected** — both docs cite SPOF/stampede/synthetic monitoring + ops runbooks |
| `docs/phases/07-admin/PHASE_07_ADMIN.md` | "Report queues, bulk actions" framed as UX polish; actually thin data model (no severity/strikes) | moderation | **Corrected** — shipped report/copyright/strikes/held-comments/audit; **Wave 39** ThemeProvider extract to design-system |
| `docs/phases/21-accessibility/PHASE_21_A11Y.md` | Was scoped to web only; mobile a11y now started (2026-08-11+) — see phase doc + `PHASE_21_REPORT.md` (~80% web; mobile Semantics on critical flows). Treat remaining mobile gaps as tracked depth, not “zero a11y” | security | **Corrected** — mobile a11y started; **W36–37** Studio + library/community/playlist IconButton tooltips; remaining: contrast audit + VoiceOver pass |

### MVP-3: Core YouTube-parity gaps (the actual product work)

**Delta-audit correction, 2026-08-16:** this table was written 2026-08-09 and, except row "Comment moderation gate," never updated as `PLATFORM_AUDIT_2026-08-09.md` itself accumulated fixes through 2026-08-13, or as PR #195 (merged 2026-08-14) shipped MFA's client surface. Nearly every row below was stale — read as **already shipped** unless marked otherwise; verified by re-reading the cited code, not just trusting the audit doc's own log.

| Item | Domain | Phase doc | Notes |
|---|---|---|---|
| Account-level strike/warning ladder + basic appeals flow | moderation | none exists | **Fixed 2026-08-12** — `AccountStrikesModule`, self-service appeal + admin resolution (see `PLATFORM_AUDIT_2026-08-09.md` §2.3) |
| Rate-limit / trust-weight report-creation endpoints | moderation | none | **Rate limit fixed 2026-08-09**; **trust-weighting shipped 2026-08-29** (`reporter-trust.util` + daily cap + non-P0 severity demotion in `ReportsService.create`); **Wave 22:** community reports share the same 24h daily cap (429) |
| Self-service account deletion + data export endpoint | security | `docs/phases/17-security/PHASE_17_SECURITY.md` | **Fixed 2026-08-11** — `DELETE /users/me` + `GET /users/me/export`; Google-OAuth-only uses emailed `confirmationToken`. **Wave 23:** export includes comments + community posts + web download. **Wave 25:** mobile Settings download via share sheet. **Wave 31:** export includes account strikes |
| Define owned-content lifecycle on account deletion (videos/streams/communities) | product-vision, security | none | **Fixed 2026-08-09/2026-08-12** — videos hidden + streams ended; ownership → OWNER/ADMIN. **Wave 19 (2026-08-29):** also MODERATOR, else privatize + `community.orphaned_on_owner_delete` |
| MFA/2FA, at minimum gated to creator/admin accounts | security | `docs/phases/17-security/PHASE_17_SECURITY.md` | **Fixed** — TOTP + web/mobile UI. **Admin API hard-gate** (`RolesGuard`). **Wave 26:** admin login MFA challenge + Admin Settings enroll/disable. **Wave 27:** Settings available to all admin tiers + MFA-off banner |
| Distinct monetization-eligibility gate (subscriber/watch-hour thresholds) separate from `creatorStatus` | monetization, product-vision | `docs/phases/14-monetization/PHASE_14_MONETIZATION.md` | **Fixed 2026-08-13** — `MonetizationEligibilityService` (read-only; nothing to gate yet since there's no live ad revenue). **Studio UI 2026-08-29 (Wave 33)** — Earnings surfaces eligibility snapshot (web + mobile) |
| Transcript/caption search | discovery | `docs/phases/11-search/PHASE_11_SEARCH.md` | **Fixed 2026-08-11** — caption text in `search_vector`. **Wave 39:** multi-track indexing + Mux reindex + `?captions=<lang>`. **Wave 40:** admin historical backfill. Non-English FTS configs still deferred |
| Fix scheduled-publish to actually fire a "published" event at the scheduled time, not just query-time visibility filtering | upload-media | `docs/phases/09-media-pipeline/PHASE_09_MEDIA.md` | **Fixed 2026-08-12** — `ScheduledPublishService` + 1-minute BullMQ repeatable job |
| Server-side `Share` tracking (entity + endpoint + analytics event) | engagement | none | **Fixed 2026-08-11** — `Share` entity + `POST /videos/:id/share`; **Wave 14:** wired on mobile watch + web Shorts/FeedCard. **Wave 25:** web live Share is URL-only (no video-scoped share row — intentional) |
| Comment moderation gate for video comments (spam/toxicity), matching what community posts already have | engagement, moderation | none | **Fixed 2026-08-13** — regex fast-path; **Wave 19:** Studio Held filter + Release; **Wave 21:** admin `/comments` queue; **Wave 22:** async LLM re-judge for regex-held (`video-comment-moderation` queue → auto-release false positives). |
| Cross-link `docs/SCALE_LIVE.md`'s proposed 100K-viewer design from `docs/LIVE.md`'s capabilities table so it isn't mistaken for current (~10K) capability | upload-media | `docs/LIVE.md` | **Already done** — `docs/LIVE.md` line 3 carries the cross-link |

**Genuinely still open** (verified 2026-08-16, unchanged by #195): admin UI for the copyright/strikes backend — **now shipped**, `apps/admin/src/app/copyright/page.tsx` (477 lines, wired in `AdminShell.tsx` nav), also part of PR #195; CSAM/pre-publish scanning (`NoopContentScanProvider` still the only default — **Wave 27:** `/health` surfaces `contentScan=noop|webhook|misconfigured`; real vendor still legal/ops-blocked); category taxonomy overhaul (still correctly listed in §0.5 above, unchanged).

**Correction, same pass:** this line previously listed "AWS static IAM keys (no OIDC)" as still open — that was stale. `create-s3-client.ts`'s `AWS_ROLE_ARN`-gated Fly-OIDC→STS path was already built 2026-08-13 (`docs/operations/AWS_CREDENTIAL_ROTATION.md`), defaulting safely to static keys when unset. Only the one-time AWS-side IAM setup remains, blocked on real AWS console/CLI access; ready-to-apply trust/permission policy JSON added at `docs/operations/aws-oidc/` (2026-08-16) so that step is copy-paste once someone with access picks it up. Shorts-ranking precompute, listed in §0.5 above as needing an "eng lead" cadence/storage call, is **also resolved** as of this pass — see §0.5's updated row.

**MVP dependency notes:**
- The permissions-enforcement fix (MVP-1) should land before building any *new* role-gated feature in MVP-3, or the new feature inherits the same display-only-enforcement bug pattern.
- Owned-content-lifecycle decision (MVP-3) blocks a correct self-service account-deletion implementation (also MVP-3) — decide the former first.
- Monetization-eligibility gate depends on the framing decision (§0): if courses/mentorship stay in scope, eligibility rules may need to consider engagement across both video and non-video surfaces.

---

## Post-MVP — materially improves parity, not launch-blocking

| Item | Domain | Phase doc | Notes |
|---|---|---|---|
| Extend `isSkillEconomyLmsEnabled`-style flag-gating to Communities 2.0, Channel Points, Mentorship, Brands | product-vision, monetization | none | **Resolved 2026-08-12** — LMS/mentorship/channel-points/brands already gated; Communities posts/polls/tiers kept as core YouTube Community-tab equivalent (see PLATFORM_AUDIT §1) |
| Copyright/DMCA notice-and-counter-notice pipeline + designated-agent contact in `docs/LEGAL.md` | moderation | none | **API shipped 2026-08-12**. **Wave 24:** web report → `/copyright/notice`. **Wave 26:** mobile video report copyright → same web form. **Wave 28:** footer Copyright link. **Wave 30:** mobile Channel strikes counter-notice UI (parity with web). Designated-agent USPTO filing still ops/legal |
| Automated pre-publish video content scan (malware/CSAM/policy), reusing the AI-judge pattern already built for community text | moderation, upload-media | none | Default remains `NoopContentScanProvider`; webhook provider hook exists. **Wave 27:** `/health` + admin Settings surface `contentScan` status. Real vendor still legal/ops-blocked |
| Admin/privileged-action durable audit log | moderation, security | none | **Shipped** — `AdminAuditLogService` + migration `214`; wired on privileged admin mutations. **Wave 29:** admin UI `/audit` |
| Distinct trust-and-safety "moderator" role between community moderator and full platform admin | moderation, security | `docs/QA.md` access tiers | **Shipped** — `AdminTier` (`full` vs `moderator`) + nav gating via `FULL_ADMIN_ONLY_HREFS`; Settings/MFA available to all admin tiers (Wave 27) |
| Session-based personalization signal + exploration budget in `forYou` ranking | discovery | `docs/phases/12-recommendations/PHASE_12_RECS.md` | **Shipped 2026-08-29** — W33–36 session/exploration. **Wave 38:** trending Now/Week windows. Geo-regional still deferred |
| Playlist search ranking (FTS + relevance, not `ILIKE` + date) | discovery | `docs/phases/11-search/PHASE_11_SEARCH.md` | **Shipped** — `searchPlaylistsRanked` with ILIKE fallback |
| Unified creator payout ledger (MRR + Super Thanks + future ad revenue in one view) | monetization | `docs/phases/16-analytics/PHASE_16_ANALYTICS.md` | **API shipped** (`CreatorEarningsService`). **Wave 32:** Studio `/studio/earnings` (web + mobile) + CSV export. Ads remain $0 placeholder |
| Verify/fix Stripe refund & dispute webhook handling of creator net earnings | monetization | `docs/phases/14-monetization/PHASE_14_MONETIZATION.md` | **Verified 2026-08-29** — `stripe-payment.provider.spec.ts` covers Super Chat / Super Thanks / ticket / subscription refund + dispute tagging; migration `212` `refunded_at` |
| Multi-language auto-captions (currently hardcoded `en` at Mux ingest) | upload-media | `docs/phases/09-media-pipeline/PHASE_09_MEDIA.md` | **Wave 31:** ingest language/name configurable via `MUX_AUTO_CAPTION_*`. **Wave 39:** multi-track FTS indexing + language CC filter. Per-creator multi-lang auto-generate still deferred |
| Highlight clip export job (schema/API ready, job itself doesn't exist) | upload-media | `docs/LIVE.md` deferred list | **Shipped 2026-08-29** — `StreamClipExportService` + worker. **Wave 40–41:** host UI surfaces playback + export errors (web + mobile) |
| Re-transcode/reprocess trigger for creators (currently delete + re-upload only) | upload-media | `docs/phases/09-media-pipeline/PHASE_09_MEDIA.md` | **Shipped** — `POST /videos/:id/retry-transcode` + Studio UI (web + mobile) for failed Mux VOD |
| Push preference matrix UI on web/mobile (backend already built) | engagement | `docs/phases/15-communication/PHASE_15_COMMUNICATION.md` | **Shipped** — web `NotificationPreferencesSettings` + mobile `_NotificationPreferencesSection`. Personalized bell uses 45d watch engagement |
| Cookie-consent banner + DSAR intake/tracking beyond a mailto address | security | `docs/LEGAL.md` | **Wave 25:** web cookie banner + analytics gated on Accept; DSAR export. **Wave 42:** Settings cookie prefs + DNT/GPC. **Wave 43:** mobile analytics opt-out. Formal EEA CMP / DSAR ticket tracking still legal-scoped |
| Cache-stampede protection (jittered TTL / single-flight) on hot Redis keys | infra | `docs/phases/19-performance/PHASE_19_PERFORMANCE.md` | **Shipped** — `cache-stampede.util` on video detail + search |
| Continuous synthetic/canary monitoring of critical journeys (watch/upload/search) | infra | `docs/phases/18-infrastructure/PHASE_18_INFRA.md` | **Shipped** — `.github/workflows/synthetic-monitoring.yml` (15-min public API smoke) |
| Live re-verify GitHub branch protection on `main` + Actions SHA-pinning + AWS key rotation | infra | `docs/operations/*` | Last checked 2026-07-26; needs a fresh live check, not re-confirmed by this audit |

---

## Future scale — only matters at materially higher traffic/creator count

| Item | Domain | Phase doc | Trigger condition |
|---|---|---|---|
| Multi-region deployment + region-failover runbook | infra | `docs/phases/18-infrastructure/PHASE_18_INFRA.md` | Business SLA/uptime commitment requiring it, or real multi-region traffic |
| Distributed tracing (OpenTelemetry) end-to-end across upload → transcode webhook → publish | infra | `docs/phases/19-performance/PHASE_19_PERFORMANCE.md` | Debugging pipeline incidents becomes a recurring pain point |
| `docs/SCALE_LIVE.md`'s 100K-viewer live design (Redis Streams chat, 20+ replica sticky routing) | upload-media, infra | `docs/SCALE_LIVE.md` (proposal only) | Concurrent-live-viewer target actually approaches current ~10K ceiling |
| Content-ID-style duplicate/rights-matching detection | moderation, upload-media | none | Only relevant if FORGE's content mix shifts toward music/entertainment rather than lesson/skill video |
| Ad revenue model (`AdsModule`, RPM/CPM, ad-break entities) | monetization | none | Real product decision on whether ads are ever in scope at all — may be permanently N/A |
| Per-channel delegated access (YouTube Manager/Editor/Viewer via Brand-Account-style ownership) | product-vision, security | none | Only if team/agency-run channels become a real customer segment |
| DB capacity-planning doc tying MAU/QPS target to Neon connection/CU usage; move `getCreatorBusinessAnalytics` off live multi-query SQL to a cached/materialized snapshot | infra, monetization | `docs/operations/LOAD_TEST_RUNBOOK.md` | A concrete near-term MAU target is set (informs the doc, doesn't yet exist) |
| Notification-fanout scale plan for very-large-subscriber channels (analogous to `docs/SCALE_MESSAGING.md`) | engagement, infra | `docs/SCALE_MESSAGING.md` (chat-only today) | A channel's subscriber count approaches a scale where fanout latency is observed |

---

## Cross-domain dependency graph (informal)

```
§0 framing decision
  ├─→ MVP-1 permission/authz fixes (independent of §0, do regardless)
  ├─→ MVP-2 doc corrections (independent of §0, do regardless)
  ├─→ MVP-3 monetization-eligibility gate (shape depends on §0)
  ├─→ Post-MVP flag-gating extension (directly implements §0's outcome)
  ├─→ Post-MVP admin IA rework (moderation) (needs §0 to stop hedging)
  ├─→ Future-scale privacy-policy scope (security) (needs §0 to know what data categories to cover)
  └─→ Future-scale infra capacity plan (needs §0 to know what load shape to plan for)

MVP-3 owned-content-lifecycle decision
  └─→ MVP-3 self-service account deletion (can't ship deletion without this)

MVP-1 permission enforcement fix
  └─→ any new role-gated feature (build after, not before)

Post-MVP S3 original-retention confirmation
  └─→ Post-MVP re-transcode/reprocess trigger (design depends on the answer)
```

---

## Maintenance note

When a roadmap item ships, update the relevant `docs/phases/NN-*/PHASE_NN_*.md` status (per `docs/README.md`'s existing maintenance table) rather than only checking it off here — this file is a sequencing plan, not the system of record for feature status. That remains `FORGE_PROJECT_MASTER.md` §16 and the master tracker.
