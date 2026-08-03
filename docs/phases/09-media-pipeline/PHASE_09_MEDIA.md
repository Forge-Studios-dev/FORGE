# Phase 09 — Media Processing Pipeline

**Status:** Complete for captions + Mux ingest parity slice

## Goal

Close the media pipeline gap that blocked watch captions: store caption URLs, request Mux auto-captions on ingest, attach tracks when ready.

## Architecture (current)

```
Client → POST /videos/presigned-url → S3 PUT (single|multipart)
  → POST /videos/:id/complete → BullMQ (ffmpeg | mux-vod-ingest)
  → Mux asset create (+ generated_subtitles en)
  → webhook video.asset.ready → READY + hls/thumb/(optional caption)
  → webhook video.asset.track.ready → caption_url
  → Watch VideoPlayer <track kind="captions">
```

## Shipped

- Migration `1870000000000-video-caption-url.ts` (`videos.caption_url`)
- Entity + PublicVideo mapper + shared-types `captionUrl`
- Mux ingest requests English auto-generated subtitles
- `handleAssetReady` / `handleTrackReady` + streaming webhook wiring
- WatchExperience passes `captionUrl` into VideoPlayer
- Caption URL sanitizer (Mux VTT only)

## Deferred

- Multi-language caption selection UI
- Manual caption upload from Studio
- ffmpeg-path caption generation (Mux-only for now)

See [PHASE_09_REPORT.md](./PHASE_09_REPORT.md).
