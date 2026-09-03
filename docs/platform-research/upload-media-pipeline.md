# Platform Research — Upload, Media Processing & Delivery

> **Historical research.** Operational SSOT: [MEDIA.md](../MEDIA.md), [CONTENT_SCANNING.md](../CONTENT_SCANNING.md), [LIVE.md](../LIVE.md). CSAM vendor still required (ADR-009). Not a spec of record.

## 1. Overview & scope

This domain covers the full lifecycle of a piece of video content on FORGE:

1. **Upload** — presigned single-PUT and multipart/resumable upload from web/mobile to S3, proxy-upload fallback.
2. **Validation** — content-type/size checks, ownership-scoped S3 key pattern, (missing) malware/CSAM scanning.
3. **Transcoding** — Mux-hosted VOD pipeline (default) and a self-hosted FFmpeg worker path.
4. **Thumbnail generation** — custom upload, Mux auto-thumbnail, FFmpeg single-frame screenshot fallback.
5. **Metadata processing** — duration, resolved video type (video vs Short), captions, category/skill tags, FTS text.
6. **Storage** — S3 originals + processed renditions/HLS segments; Mux-hosted originals+renditions for the Mux path.
7. **Multiple resolutions/formats** — HLS ladder (Mux: adaptive up to 1080p "smart" tier; FFmpeg: 4 fixed renditions 240p–1080p, H.264/AAC only).
8. **CDN/media delivery** — Mux global CDN (`stream.mux.com`) for the Mux path; S3 direct or optional CloudFront for the FFmpeg path.
9. **Publishing workflows** — draft vs published, scheduled publish (`scheduledPublishAt`), visibility tiers (public/private/unlisted/followers/subscribers/tier/paid-event).
10. **Live streaming pipeline** — Mux RTMP ingest, LiveKit browser go-live → RTMP egress to Mux, DVR, reconnect/finalize logic, live chat/Q&A, paid events.

Out of scope here (covered by other domain docs): recommendation ranking, comments/engagement, community chat internals beyond the after-live room hook, billing/entitlements internals beyond what gates visibility.

## 2. YouTube reference model

### 2.1 Upload
- Resumable, chunked upload protocol (Google's resumable upload spec): client reserves a session, then PUTs the file in chunks that can be retried/resumed independently of chunk size, surviving flaky networks and app backgrounding.
- Server confirms receipt immediately ("upload complete, processing") and returns control to the client — heavy work happens fully asynchronously.
- Studio shows Upload → Processing (SD available quickly) → HD processing progress, so creators can start filling in metadata, and the video can be *watched at low quality by the uploader before full processing finishes*.

### 2.2 Validation
- Content-ID fingerprint match against the reference database runs early (audio+video fingerprinting) — flags copyright matches before/at publish.
- Automated policy/spam/CSAM scanning (hash-matching against known-bad-content databases, plus ML classifiers) runs on ingest, independent of and prior to human review.
- Duration/format sniffing determines Shorts eligibility (≤3 minutes as of the current Shorts spec — note the exact cutoff has moved over time) vs long-form, and rejects unsupported containers.

### 2.3 Transcoding
- Massive transcode farm produces a resolution/codec matrix: typically up to 20 representations per video across resolution × codec (H.264 always; VP9 default for most; AV1 for popular/high-res uploads, kept alongside a VP9 fallback for devices that can't decode AV1).
- Encoding priority is popularity/tier-weighted — big channels get denser bitrate ladders and AV1 sooner; long-tail uploads get fewer renditions initially and may be backfilled later.
- Two-pass philosophy: a fast/low-quality rendition publishes first so the video is watchable within minutes, followed by progressively higher-quality renditions.
- Delivery is via MPEG-DASH/HLS adaptive bitrate — the player selects a representation per network condition and can switch mid-playback.

### 2.4 Thumbnails
- Auto-thumbnail generation samples frames (~1 fps) during processing, scores each for quality/aesthetics/face-detection with an ML model, and offers the creator several auto-picked candidates plus the option to upload a custom image or use a video frame at an exact timestamp.
- Multiple thumbnail sizes/aspect ratios are rendered (list view, watch page, Shorts, notification, mobile) from the same source.

### 2.5 Publishing / visibility
- States: Public, Unlisted, Private, Scheduled (publish at a future timestamp, video is Private until then), Members-only (channel memberships), Made-for-kids flag (affects features/ads), Age-restricted.
- Scheduled publish is a first-class Studio feature — creators can set exact time, get a shareable pre-publish link, and the system flips visibility automatically at the scheduled time with no manual action required.
- A "Premiere" mode exists: video is fully processed but held, then plays as a synchronized live-like event with chat, before falling back to on-demand.

### 2.6 Live
- RTMP/SRT ingest → transcoded live ladder → low-latency HLS/DASH delivery, edge-cached at a global CDN.
- DVR (seek back into the live buffer), auto-generated live chat replay synced to VOD after the stream ends, and automatic archiving of the stream as a VOD.
- Super Chat/Super Thanks monetization, membership-gated chat modes, and moderation (words filter, slow mode, subscriber-only mode) are native chat features.
- Stream health dashboard for creators (bitrate, dropped frames, latency).

### 2.7 Failure/edge cases YouTube handles explicitly
- Upload resumes across network loss/app restarts (chunk-level checkpointing).
- Corrupt/unsupported container detected before transcode queue admission (fails fast, not after a full transcode attempt).
- Duplicate/re-upload detection (Content ID + perceptual hash) to prevent reposts of removed/claimed content.
- Processing failure → creator notified with actionable error, video stays in Studio in a failed state, re-upload without losing metadata.
- Live disconnect → grace period, auto-end after timeout, viewers see a reconnecting state, not a broken player.

### 2.8 Scalability considerations
- Upload and transcode are fully decoupled via a message queue (event-driven) so upload traffic spikes never block the transcode farm and vice versa.
- Transcode farm scales horizontally per-rendition (each rendition is an independent job), enabling partial-availability publish (SD ready while 4K still encoding).
- CDN edge caching + regional origin shielding absorb the vast majority of playback traffic; origin (transcode/storage) sees a small fraction of total egress.

## 3. Secondary-platform notes

- **Vimeo**: uploads and re-encodes to a single high-quality adaptive ladder but gives creators an explicit "re-transcode" trigger and much more granular per-video codec/bitrate control in paid tiers — a UX pattern worth borrowing for a "reprocess" action when creators aren't happy with auto-generated quality. Vimeo also supports true resumable **TUS protocol** uploads as an open standard, rather than a bespoke S3-multipart scheme — worth considering if FORGE ever needs non-S3 storage backends.
- **Twitch**: live-first platform — VOD is a byproduct of live (auto-saved broadcast) rather than a separate upload flow, and clips are server-side, lightweight re-cuts of the live buffer with no re-encode needed for short clips. FORGE's "highlight clip markers... Mux export TBD" (per `docs/LIVE.md`) is exactly this gap; Twitch's clip pipeline (near-instant, no transcode, just a byte-range copy of the existing rendition) is a good target rather than an ffmpeg export job.
- **TikTok**: mobile-first upload emphasizes client-side pre-processing (in-app trim/crop/filters before upload) and near-real-time single-pass transcode tuned for short vertical video, prioritizing time-to-first-playable over ladder density. Relevant to FORGE Shorts: today Shorts reuse the same 4-rendition HLS ladder as long-form video with no vertical-specific fast path.

## 4. Current FORGE state (grounded in code + existing docs)

Sources checked: `docs/MEDIA.md`, `docs/LIVE.md`, `docs/SCALE_LIVE.md`, `docs/phases/08-video-platform/*`, `docs/phases/09-media-pipeline/*`, `docs/phases/10-streaming/*`; code in `apps/api/src/modules/content/*` (`videos.controller.ts`, `videos.service.ts`, `video-multipart.service.ts`, `mux-vod.service.ts`, `video-publish.util.ts`, `entities/video.entity.ts`, DTOs), `apps/api/src/modules/workers/video-processor/video-processor.worker.ts`, `apps/api/src/modules/workers/mux-vod-ingest/mux-vod-ingest.worker.ts`, `apps/api/src/modules/streaming/*`, `apps/mobile/lib/features/upload/*`, `apps/web/src/lib/upload-*.ts`, `apps/web/src/app/upload/*`.

- **Upload**: `POST /videos/presigned-url` (single PUT) or S3 multipart when `FEATURE_FLAGS=multipart_upload` and size ≥ 50MB, with a dedicated `video-multipart.service.ts`, per-part checkpointing (`GET/POST /videos/:id/multipart/{progress,parts,checkpoint,complete}`), and a resumable client on both web (`upload-storage-multipart.ts`) and mobile (`MultipartVideoUpload`, batch=10 parts, concurrency=3, resumes from server checkpoint). Proxy-upload fallback (`PUT /videos/:id/upload`) exists but is off in prod unless `ALLOW_PROXY_UPLOAD=true`. Cap: 500MB (MVP, `presigned-url.dto.ts`), content type restricted to `video/mp4` / `video/quicktime`. `s3Key` is validated server-side against a strict owned-path regex (`OWNED_VIDEO_S3_KEY_PATTERN`) before any processing job is queued — good SSRF/path-traversal guard.
- **Transcoding**: two parallel providers selected by `VIDEO_TRANSCODE_PROVIDER`:
  - **Mux** (default): `MuxVodService.ingestFromS3` creates a Mux asset from a signed S3 GET URL, requests `generated_subtitles` (English auto-captions), `max_resolution_tier: '1080p'`, `encoding_tier: 'smart'`. Completion is webhook-driven (`video.asset.ready`, `video.asset.errored`, `video.asset.track.ready`) with idempotency (`WebhookIdempotencyService`) and re-entrancy guards (`if status READY && same playbackId → return true`).
  - **FFmpeg** (`VideoProcessorWorker`, BullMQ `VIDEO_PROCESSING_QUEUE`, concurrency 1 per worker instance): fixed 4-rung HLS ladder (240p/480p/720p/1080p, H.264+AAC only, no VP9/AV1), single-frame thumbnail at 5% mark, uploads segments to S3 with `walkDir`, writes a hand-built master playlist. No DLQ replay tooling beyond a dead-letter queue enqueue on final failure. `concurrency: 1` means one FFmpeg worker instance processes one video at a time — a real serial bottleneck under multi-upload load, mitigated only by scaling worker replica count (each replica still does 1 at a time).
- **Thumbnails**: resolution order is custom `thumbnailUrl` → Mux `image.mux.com` (live: from playback ID) → creator avatar fallback (`mux-playback.util.ts`); FFmpeg path takes a single screenshot at 5% of duration if no custom thumbnail was pre-uploaded. No ML-scored auto-thumbnail candidates, no multiple aspect ratios rendered — a single 1280×720 image is used everywhere.
- **Metadata**: `resolveVideoTypeOnReady` reclassifies video vs Short server-side once real duration is known (`SHORT_DURATION_THRESHOLD_SECONDS = 60`), including a hard failure path when a video claimed as `SHORT` turns out too long. Captions: single-language (English) Mux auto-caption plus a `captionTracks` jsonb array structured for multi-language but the ingest call only ever requests `en`; per Phase 09 docs, multi-language selection UI and manual caption upload are explicitly deferred (though `getCaptionPresigned`/`setCaption` endpoints exist for owner-set caption URLs — so manual caption *URL* setting exists at the API even if Studio UI for it may not).
- **Storage**: private S3 bucket (`forge-media-prod`, `ap-south-1`), IAM scoped to Put/Get/Head/Delete, CORS via `fix-s3-cors.sh`. Optional CloudFront only wired for the FFmpeg path (`buildPublicMediaUrl`); Mux path always serves from Mux's own CDN domain, so CloudFront is a partial solution, not global.
- **Publishing**: `Video.publishStatus` (`draft`/`published`), `visibility` enum (public/private/unlisted/followers/subscribers/tier/paid_event — already broader than plain YouTube membership tiers, reflecting FORGE's tier/community model), `scheduledPublishAt` fully wired end-to-end: set at upload-complete or via `PATCH` update, both the FFmpeg worker and the Mux webhook handler compute `publishedAt` respecting a future `scheduledPublishAt`, and `shouldIndexVideo`/`isVideoDiscoverable` (`video-publish.util.ts`) gate search/feed/recommendation visibility on status=READY + publishStatus=PUBLISHED + visibility=PUBLIC + moderationStatus=NONE + scheduledPublishAt not in the future. `studio-library-query.util.ts` has an explicit "Scheduled" filter (`scheduledPublishAt > now`) mirroring YouTube Studio's Scheduled tab. There is **no worker/cron that flips anything at the scheduled time** — the row already carries a future `publishedAt`/`scheduledPublishAt` and the gating functions simply exclude it from discovery until that timestamp passes, i.e. publish-at-time is achieved by query-time filtering, not by a state-transition job. This works for discovery/feed but any push notification, RSS, or webhook fan-out "video just went live" event tied to the scheduled moment would need a dedicated scheduler — none exists today (confirmed: no cron/BullMQ repeatable job found matching video publish).
- **Live**: Mux RTMP ingest is authoritative; LiveKit-based browser go-live re-encodes to RTMP egress into the same Mux pipeline. Extensive production hardening already exists per `docs/LIVE.md`: host disconnect/reconnect grace (`MUX_IDLE_GRACE_SEC`, default 60s) with Redis `SET NX` lock against double-finalization, DVR flag, Q&A mode reusing chat infra, after-live discussion room auto-provisioning, paid-event ticketing via Stripe, super chat. `docs/SCALE_LIVE.md` is explicitly marked **"PROPOSED — not yet implemented"** for the 100K-viewer design (current stack: Socket.IO + Redis pub/sub, viewer count via Redis INCR, no Redis Streams/consumer-group chat yet). Highlight clip export to Mux is schema-ready but "TBD" per `docs/LIVE.md`'s own deferred list.
- **Not found in code** (gap, not just doc lag): no malware/CSAM hash-matching, no Content-ID-style fingerprint/duplicate-detection, no re-transcode/reprocess trigger for a creator dissatisfied with auto-quality, no scheduled-publish notification/fan-out job, no per-rendition partial availability (FFmpeg path blocks READY until *all 4* renditions finish, unlike YouTube's progressive-quality publish), no multi-aspect-ratio/ML-scored thumbnails.

## 5. The product-framing tension (flagged per `forge-youtube-replica.md`, not resolved here)

`docs/FORGE_PROJECT_MASTER.md` §1 frames FORGE as *"a skill-first creator platform: on-demand lessons, live teaching, categories/skill tags, communities, and mock memberships"* and lists a `CoursesModule` (cohorts, quizzes, assignments, certificates) and `MentorshipService` inside `CommunitiesModule` as real, shipped surfaces. `forge-youtube-replica.md` mandates *"Prefer YouTube parity over inventing a custom video platform... if existing FORGE behavior conflicts with YouTube parity, remove or refactor toward YouTube."*

This domain (upload/media/live) sits mostly on the YouTube-parity side already — `Video`, `VideoStatus`, `VideoVisibility`, HLS/Mux, live streams, scheduled publish are all modeled on YouTube's actual video/channel/live primitives, not on "lessons" or "cohorts." But the tension surfaces at the edges of this domain in a few concrete places worth flagging rather than silently resolving:
- `VideoType.PODCAST` and podcast-episode fields (`podcastSeriesId`, `episodeNumber`, `season`, `showNotes`) on the `Video` entity are a content type YouTube does support (Podcasts tab) but FORGE's naming/fields look more RSS-podcast-shaped than YouTube's actual podcast-on-video model — worth checking against YouTube's real podcast surface rather than inventing a parallel schema.
- Live "Scheduling" and "paid events" in `docs/MEDIA.md`/`docs/LIVE.md` are described in terms that mix YouTube Live's model (scheduled premieres, memberships) with a ticketed-event model closer to a webinar/cohort platform than to YouTube. Whether "paid events" should map onto YouTube's actual monetization primitives (Super Chat, channel memberships, ticketed live events which YouTube does also support in some markets) or is intentionally FORGE-specific is a product call this doc surfaces but does not make.
- The after-live "discussion room" auto-provisioning explicitly reuses `CommunityRoom` — a communities-platform primitive, not a YouTube primitive (YouTube's nearest equivalent is the Community tab / live chat replay, not a persistent chat room). This is a concrete instance of the "communities" framing leaking into what should arguably be YouTube's Community-tab-and-comments model.

Whether courses/cohorts/mentorship belong in a YouTube-parity product at all, and whether "paid events"/after-live rooms should be refactored onto YouTube's channel-membership + Community-tab model instead, is exactly the kind of call `forge-youtube-replica.md` says not to silently resolve — surfaced here for product/eng to decide, not decided by this document.

## 6. Gap analysis

| Gap | Severity | Current state | Target state | Recommendation |
|---|---|---|---|---|
| No malware/CSAM/policy scanning on upload | High | Only content-type + size + owned-path validated; no hash-matching or ML content scan before an asset is publicly playable | Scan queued before/parallel to transcode; block publish on match | Add a pre-transcode scan step (e.g. hash against a known-bad list, or a third-party moderation API) gating `PublishStatus.PUBLISHED`; log/hold via existing `ModerationStatus.HELD` path rather than a new status |
| No duplicate/fingerprint detection | Medium | Re-uploads of removed/blocked content are not detected | Perceptual/audio fingerprint check against prior blocked assets | Out of scope for MVP; note as a Phase N item, not urgent given current content moderation maturity elsewhere in the repo |
| FFmpeg path: `concurrency: 1`, serial per-worker, no progressive publish | High (self-hosted path only) | One video processed at a time per worker replica; video only reaches READY after *all* 4 renditions finish | Publish lowest rendition first (progressive availability), raise per-worker concurrency or shard by video, matching Mux path's async webhook model | Since Mux is already the default and production path, treat FFmpeg path as a documented lower-tier "self-hosted fallback" rather than investing in parity — but document the limitation explicitly in `docs/MEDIA.md` so on-call doesn't assume it behaves like Mux under load |
| No re-transcode/reprocess trigger | Medium | If Mux/ffmpeg produces a bad thumbnail/quality, creator's only recourse is delete+reupload | Studio action to re-run transcode from the stored original | Add `POST /videos/:id/reprocess` (owner + admin), re-enqueue the same ingest job using the existing `s3Key`/`muxAssetId` cleanup (`deleteAsset` already exists) |
| No scheduled-publish fan-out job | Medium | `scheduledPublishAt` only gates discovery via query-time filtering; no notification/webhook/RSS event fires exactly at the scheduled moment | A BullMQ delayed job scheduled at `scheduledPublishAt` that emits `video.published` for subscriber notifications | Add a delayed BullMQ job (pattern already used for `stream-reminder`) enqueued at schedule-time; keep the existing query-time gating as the safety net if the job is missed/delayed |
| Single, non-ML thumbnail; one aspect ratio | Low–Medium | 1 frame at 5% (ffmpeg) or Mux default frame; no creator choice of multiple auto-candidates | Offer 3 auto-candidates + timestamp picker (already partly enabled: `getThumbnailPresigned`/`setThumbnail` exist for custom upload) | Extend FFmpeg path to grab 3 timestamps (e.g. 15/50/85%) and let Studio show them as picker candidates; no ML scoring needed for parity at FORGE's scale |
| Only English auto-captions requested | Low | `generated_subtitles: [{ language_code: 'en' }]` hardcoded in `mux-vod.service.ts` | Multi-language auto-caption request set at ingest, or on-demand per-language generation | Already flagged as deferred in `docs/phases/09-media-pipeline/PHASE_09_MEDIA.md`; low urgency unless FORGE targets non-English creator base |
| No CDN in front of Mux-agnostic asset metadata / thumbnails when using S3+CloudFront path only for FFmpeg | Low | Mux path gets global CDN "for free"; FFmpeg path's CDN (CloudFront) is optional/documented as opt-in | Make CloudFront mandatory (not "optional") for any production FFmpeg deployment | Update `docs/MEDIA.md` to state CloudFront is required, not optional, when `VIDEO_TRANSCODE_PROVIDER=ffmpeg` in prod |
| `docs/SCALE_LIVE.md` proposals for 100K viewers are unimplemented but read like current architecture at a skim | Low (doc clarity) | File does have a clear "PROPOSED — not yet implemented" banner already | Keep the banner; cross-link from `docs/LIVE.md`'s capabilities table so readers don't infer 100K support from the "Live platform" section | Add an explicit "Max validated concurrent viewers today: ~10K (per `docs/LIVE.md` status line)" note near the SCALE_LIVE banner |
| Highlight clip export to Mux "TBD" | Medium | Schema + API exist; no actual clip export job | Twitch-style clip: byte-range/segment copy of existing HLS rendition, no re-encode | Implement as a lightweight ffmpeg/Mux clip job scoped to the marker's 30s window against the *already-transcoded* rendition, not the original — avoids a full re-transcode per clip |
| Podcast fields possibly diverge from YouTube's actual podcast model | Low–Medium (framing) | `podcastSeriesId`/`episodeNumber`/`season`/`showNotes` on `Video` | Align with YouTube's real podcast-on-video surface (a video/playlist-based show, not an RSS-episode schema) or explicitly document as intentional | Product decision — see §5; do not silently rename/remove |
| Courses/cohorts/mentorship framing vs YouTube-parity mandate | Info (surfaced, not a "gap" to fix here) | `FORGE_PROJECT_MASTER.md` describes a skill-platform product; `forge-youtube-replica.md` mandates YouTube parity | Executive summary and YouTube-parity mandate should be reconciled at the product level | See §5 — flagged in `conflictsWithOtherDocsOrRules`, not resolved by this document |
| No documented rate limit / abuse control specifically on presigned-URL issuance beyond `Throttle` decorators already present | Low | `@Throttle({ limit: 30, ttl: 60_000 })` on presign/complete endpoints — actually already present | N/A — verified as already adequate | No action; noted only because it's easy to assume this is missing without checking the controller |

## 7. Recommended flows / data model / API additions

### 7.1 Reprocess (re-transcode) flow
```
POST /videos/:id/reprocess   (owner or admin; CreatorApprovedGuard + Permission.UPLOAD_VIDEO)
  → 409 if video.status is UPLOADING/PROCESSING (already in flight)
  → if transcodeProvider === MUX:
      MuxVodService.deleteAsset(video.muxAssetId)   // already exists
      clear muxAssetId/muxPlaybackId/hlsUrl/thumbnailUrl/captionUrl/captionTracks
      re-enqueue MUX_VOD_INGEST_QUEUE job { videoId, s3Key, userId }
  → if transcodeProvider === FFMPEG:
      re-enqueue VIDEO_PROCESSING_QUEUE job { videoId, s3Key, userId }
  → set status = PROCESSING, failureReason = null
  → emit video.updated
```
Guard: only allow when the *original* `s3Key` still exists in S3 (HeadObject check) — originals are not deleted after successful transcode today, but confirm retention policy before relying on this.

### 7.2 Scheduled-publish notification job
```
On completeUpload / update, when scheduledPublishAt is set:
  BullMQ delayed job on a new `video-scheduled-publish` queue,
  delay = scheduledPublishAt.getTime() - Date.now(), jobId = `video-publish-${videoId}`
  (idempotent — re-scheduling replaces the existing delayed job by jobId)

Worker (VideoScheduledPublishWorker):
  reload video; if status===READY && publishStatus===PUBLISHED && scheduledPublishAt<=now:
    emit 'video.published' (subscriber notification fan-out — reuse existing
    subscriber notification pipeline pattern from `premium-content-notify`)
  else: no-op (video not ready yet, or was unpublished/deleted — safe to drop)
```
This keeps the existing query-time `shouldIndexVideo`/`isVideoDiscoverable` gating as the source of truth for *visibility*, and adds only the *event* fan-out at the right moment — no behavior change to what's already shipped and tested.

### 7.3 Thumbnail candidate picker (FFmpeg path)
- `generateThumbnail` → `generateThumbnailCandidates(inputPath, outputDir, [15, 50, 85])`, storing `thumbnail-1.jpg`, `thumbnail-2.jpg`, `thumbnail-3.jpg` under the existing `videos/{id}/` prefix.
- New nullable `Video.thumbnailCandidates: string[] | null` jsonb column (additive migration).
- Studio thumbnail picker UI (already has `setThumbnail`) extended to show these three plus "upload custom" — no new upload flow needed, reuses `getThumbnailPresigned`/`setThumbnail`.

### 7.4 Highlight clip export (Twitch-style, no re-encode)
```
POST /streams/:id/clips/:markerId/export
  → look up marker { startMs, endMs } (schema already exists)
  → source: the archived VOD's already-transcoded HLS rendition (post-stream-end archival,
    not the live buffer) — segment-level copy of the .ts segments spanning [startMs,endMs]
    into a new short-form asset, stitched into a fresh short master.m3u8
  → for the Mux path specifically, prefer Mux's native clip/asset-from-input-range API
    if available on the current Mux plan, over hand-rolled segment copy
  → resulting asset gets its own Video row (videoType=SHORT) linked via sourceStreamId
    (column already exists) — reuse existing Short publish path end-to-end
```

### 7.5 Data model additions (additive only, no breaking changes)
- `videos.thumbnail_candidates jsonb null`
- `videos.last_reprocessed_at timestamptz null` (observability — when was reprocess last triggered, by whom)
- `videos.reprocess_count int default 0` (abuse guard — cap reprocess attempts, e.g. 3/day, via existing `Throttle` pattern or a counter check in the service)
- New BullMQ queue: `video-scheduled-publish` (delayed jobs, jobId-keyed for idempotent reschedule)
- New BullMQ queue (or extend `stream-snapshot-retention`-style worker): `stream-clip-export`

### 7.6 API surface additions summary
| Method | Path | Notes |
|---|---|---|
| `POST` | `/videos/:id/reprocess` | Owner/admin; re-run transcode from stored original |
| `GET` | `/videos/:id/thumbnail/candidates` | Auto-generated candidates for picker |
| `POST` | `/streams/:id/clips/:markerId/export` | Closes the "Mux export TBD" gap from `docs/LIVE.md` |

## 8. Explicit assumptions

- Original uploaded files (`videos/{userId}/{videoId}/original.*`) are retained in S3 after successful transcode (not verified by lifecycle-policy inspection here) — the reprocess flow in §7.1 depends on this; if a lifecycle rule deletes originals post-transcode, reprocess must instead re-request from Mux's own retained master (Mux keeps the ingested master by default) rather than S3.
- `VIDEO_TRANSCODE_PROVIDER=mux` is the only path exercised in production per `docs/MEDIA.md` ("Without Mux in production: live blocked; use ffmpeg for VOD only") — the FFmpeg-path gaps in §6 are scoped as "self-hosted fallback" issues, not production blockers, unless the user's infra runs ffmpeg-only.
- The 500MB upload cap and mp4/mov-only content-type restriction are treated as intentional MVP scoping, not a gap — flagged only where relevant (thumbnail/caption flows), not relitigated.
- `docs/SCALE_LIVE.md`'s own "PROPOSED — not yet implemented" banner is accurate and current as of this research pass; no code for Redis Streams chat or 20-replica sticky-session routing was found in `apps/api/src/modules/stream-chat` beyond what's already described as shipped in `docs/LIVE.md`.

## 9. Open questions

1. Is the courses/cohorts/mentorship product surface intended to stay alongside YouTube-parity video/live, or should it be phased out/refactored per `forge-youtube-replica.md`'s "remove or refactor toward YouTube" instruction? This affects whether podcast/course-linked video metadata fields on `Video` are permanent schema or technical debt.
2. Should "paid events" and after-live community rooms be reframed onto YouTube's actual membership/Community-tab model, or are they an intentional, product-approved FORGE divergence?
3. What is the actual S3 lifecycle policy for original uploads — are they deleted after successful transcode (affecting the proposed reprocess flow), and if so, after how long?
4. Is there a target concurrent-live-viewer number the business actually needs in the next 6–12 months? `docs/SCALE_LIVE.md`'s 100K design is speculative; knowing the real target would determine whether Redis Streams chat is near-term work or permanently deferred.
5. Does the platform need Content-ID-style duplicate/copyright detection for launch, or is manual reports-based moderation (already present per other FORGE modules) sufficient for current scale and legal exposure?
6. Should multi-language auto-captions be prioritized now, or does the current creator base skew English-only enough to defer further?

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
