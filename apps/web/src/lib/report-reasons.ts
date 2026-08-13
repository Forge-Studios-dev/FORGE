/**
 * YouTube-style report reason presets (sent as both the free-text `reason`
 * preset and the structured `reasonCategory`). Re-exported from
 * `@forge/shared-types` — that's the single source of truth shared with the
 * API's validation and severity triage; don't fork this list again.
 */
export {
  VIDEO_REPORT_REASONS,
  COMMENT_REPORT_REASONS,
  type ReportReason as VideoReportReason,
  type ReportReason as CommentReportReason,
} from '@forge/shared-types';
