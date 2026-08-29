# Phase 15 — Report

**Completion:** ~85% (DM send error + retry UX shipped 2026-08-29)
**Readiness:** proceed to Phase 16.

## Shipped (Wave 11 follow-up)

| Area | Change |
| --- | --- |
| Web DMs | Surface API error (incl. blocked peer) via `getApiErrorMessage`; retry-friendly pending label |
| Mobile DMs | DioException message + SnackBar Retry action on send failure |

## Deferred

Broader push-preference matrix beyond category mutes (already gated in `PushDispatchService`).
