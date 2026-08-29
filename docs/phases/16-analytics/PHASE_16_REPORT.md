# Phase 16 — Report

**Completion:** ~90% (realtime pulse + coarse audience retention shipped 2026-08-29)

## Shipped

| Area | Change |
| --- | --- |
| API | `GET /analytics/studio/realtime` (60m views/impressions) |
| API | `audienceRetention` on `GET /analytics/studio/video-performance` (10% buckets from `watch_history.progress_seconds`) |
| Web Studio | Realtime pulse + retention bar chart |
| Mobile Studio | Realtime row + retention bars |

## Schema note

True per-second YouTube-style curves still need richer watch-session samples than last-known `progress_seconds`. The shipped curve is a **relative “still watching” approximation** from session end progress — good enough for Studio decisions until beacon histograms exist.

**Readiness:** proceed to Phase 17 / production checklist.
