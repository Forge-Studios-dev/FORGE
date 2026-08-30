import { ReportSeverity } from '@forge/shared-types';

/** Rolling window for dismissed/upheld report history used in trust scoring. */
export const REPORTER_TRUST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Soft daily ceiling for trusted reporters (above the per-minute @Throttle). */
export const TRUSTED_DAILY_REPORT_CAP = 25;

/** Daily cap when ≥70% of recent resolutions were dismissals (≥3 resolved). */
export const LOW_TRUST_DAILY_REPORT_CAP = 3;

/** Intermediate cap when a reporter has many dismissals but mixed outcomes. */
export const ELEVATED_DISMISS_DAILY_REPORT_CAP = 5;

/**
 * Daily report submission cap from recent moderation outcomes.
 * Chronically dismissed reporters get a hard lower ceiling (review-bombing mitigation).
 */
export function dailyReportCapForTrust(dismissed30d: number, upheld30d: number): number {
  const dismissed = Math.max(0, dismissed30d);
  const upheld = Math.max(0, upheld30d);
  const resolved = dismissed + upheld;
  if (resolved >= 3 && dismissed / resolved >= 0.7) {
    return LOW_TRUST_DAILY_REPORT_CAP;
  }
  if (dismissed >= 8) {
    return ELEVATED_DISMISS_DAILY_REPORT_CAP;
  }
  return TRUSTED_DAILY_REPORT_CAP;
}

export function isLowTrustReporter(dismissed30d: number, upheld30d: number): boolean {
  return dailyReportCapForTrust(dismissed30d, upheld30d) === LOW_TRUST_DAILY_REPORT_CAP;
}

/**
 * Demote non-P0 severity one tier for low-trust reporters so they cannot
 * inflate the admin queue with high-priority spam. P0 (CSAM/terrorism) stays.
 */
export function demoteSeverityForLowTrust(severity: ReportSeverity): ReportSeverity {
  if (severity === ReportSeverity.P0) return ReportSeverity.P0;
  if (severity === ReportSeverity.P1) return ReportSeverity.P2;
  if (severity === ReportSeverity.P2) return ReportSeverity.P3;
  return ReportSeverity.P3;
}
