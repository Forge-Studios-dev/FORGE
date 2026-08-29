# Phase 16 — Report

**Completion:** ~85% (studio realtime pulse + mobile parity shipped 2026-08-29)

## Shipped (Wave 11 follow-up)

| Area | Change |
| --- | --- |
| API | `GET /analytics/studio/realtime` (60m views/impressions) |
| Web Studio | Realtime pulse card on analytics page |
| Mobile Studio | Realtime views/impressions row on analytics screen |

## Schema note

Audience retention *curves* (per-second histogram) need richer watch-session samples than `watch_history.progress_seconds` alone — documented gap; avg watch % remains the shipped retention signal.

**Readiness:** proceed to Phase 17.
