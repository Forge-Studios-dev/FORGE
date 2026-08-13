# Upload Content-Safety Scanning

**Status:** Pluggable scaffolding, shipped 2026-08-12. No real scanner vendor is integrated.

---

## 1. What this is (and isn't)

FORGE had no automated content-safety scanning on upload — a video could go from "processing" straight to publicly indexed with zero review, regardless of content (CSAM, terrorism, malware, etc.). This adds a scan step between "transcoding finished" and "published/indexed," with a pluggable provider so a real vendor can be dropped in later.

**What this cannot do:** integrate an actual scanner. Real providers (Google CSAI Match, Thorn Safer, Microsoft PhotoDNA, hash-matching databases) require legal agreements, vendor-specific credentials, and often membership/vetting outside this codebase. The default (`CONTENT_SCAN_PROVIDER=none`) approves every upload — identical to today's behavior — until an operator configures a real integration. **Do not treat this as CSAM/illegal-content protection until a real vendor is wired in.**

## 2. Architecture

`ContentScanService` (`apps/api/src/modules/content/content-scan/`) picks a provider at startup based on `CONTENT_SCAN_PROVIDER`:

| Provider | Behavior |
|---|---|
| `none` (default) | `NoopContentScanProvider` — always `approve`. Preserves current behavior exactly. |
| `webhook` | `WebhookContentScanProvider` — generic REST integration point. POSTs `{videoId, userId, hlsUrl, thumbnailUrl}` to `CONTENT_SCAN_WEBHOOK_URL`, expects `{action: "approve"|"hold"|"block", categories?: string[]}` back. |

The webhook provider **fails closed to `hold`** on any error, timeout, non-2xx response, or unrecognized `action` value — unlike most external integrations in this codebase (which fail open), a safety scan should err toward caution: a `hold` only queues the video for human review, it doesn't destroy anything.

To integrate a real vendor: implement `ContentScanProvider` (`content-scan.types.ts`) against that vendor's actual API, and add a case to `ContentScanService.buildProvider()` — the call sites (below) don't change.

## 3. Call sites

Both video-ready paths call `ContentScanService.scanVideo()` right before marking a video `READY`:

- `MuxVodService.handleAssetReady` (Mux transcode path, production default)
- `VideoProcessorWorker.process` (local-dev FFmpeg path)

On a non-`approve` verdict:
- `Video.moderationStatus` is set to `held` or `blocked` (existing column — `shouldIndexVideo()`/`indexedAtOnReady()` already gate indexing on `moderationStatus === NONE`, so a held/blocked video's `indexedAt` stays `null` and it never enters search/feed/recommendations even though transcoding succeeded).
- `Video.moderationNote` records the provider + flagged categories; `moderationAt` is stamped.
- `video.content_scan_held` is emitted instead of `video.ready` — so subscriber notifications and feed-cache invalidation for "new video" don't fire for a video that hasn't cleared review. (No admin-facing surface consumes this event yet — it's a hook for future moderation-queue/admin-notification work, same as other emit-only events in this codebase.)

An `approve` verdict (including the no-op default) proceeds exactly as before this change.

## 4. Configuration

See `.env.example`:

```
CONTENT_SCAN_PROVIDER=none        # or 'webhook'
CONTENT_SCAN_WEBHOOK_URL=
CONTENT_SCAN_WEBHOOK_TOKEN=       # optional Bearer token
CONTENT_SCAN_TIMEOUT_MS=15000
```
