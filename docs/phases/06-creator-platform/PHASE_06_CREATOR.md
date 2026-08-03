# Phase 06 — Creator Platform

**Status:** Complete for Master creator chrome + Create Short upload wiring

## Goal

YouTube-shaped Creator Studio IA plus end-to-end **Create Short** so `/upload?type=short` persists type through draft → complete API → processing.

## Shipped

### Studio chrome (prior + polish)
- Studio Create menu: Upload video, Create Short (`/upload?type=short`), Go live, New playlist
- TopBar Create menu already linked Short correctly; StudioCommandBar aligned
- Nav: Content / Comments / Live / Analytics / Memberships / Settings

### Create Short pipeline (this slice)
- `UploadDraft.videoType`: `video` | `short`; seeded from `?type=short`
- Upload step UI: Video / Short type toggle; title/subtitle voice
- `CompleteUploadOptions.videoType` → `POST /videos/:id/complete`
- API `CompleteUploadDto.videoType` + `videosService.completeUpload` sets entity type
- Processing still refines SHORT by duration ≤60s (Mux)
- Mobile: Video/Short segmented control + repository `videoType` on complete / resume

## Intentional gaps (later)

- Orphan economy Studio routes remain by URL, not primary NAV
- Deep analytics / branding editor / comment moderation UX
- Hard reject uploads >60s when type=short (YouTube-style); currently Mux reclassifies by duration

See [PHASE_06_REPORT.md](./PHASE_06_REPORT.md).
