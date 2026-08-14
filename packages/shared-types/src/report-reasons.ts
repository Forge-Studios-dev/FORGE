/**
 * Canonical report-reason taxonomy — single source of truth for the API's
 * validation (`CreateReportDto`) and any client picker. Consolidates what
 * were three independently-drifted lists (web `report-reasons.ts`, several
 * inline lists in `apps/mobile`) into one; values are the exact strings
 * already in use, so adopting this list is not a breaking change for any
 * existing caller.
 *
 * Severity mirrors the tiers already defined for community content in
 * `docs/ESCALATION_RULES.md` §1 (P0–P3) — this extends that same, already-
 * approved taxonomy to platform-wide reports (video/user/comment) rather
 * than inventing a new one. Used for admin-queue triage ordering only; it
 * does not drive any auto-action (unlike the community AI-moderation
 * pipeline, an unverified user report should never auto-block content).
 */
export enum ReportReason {
  SPAM_OR_MISLEADING = 'Spam or misleading',
  HATE_SPEECH_OR_HARASSMENT = 'Hate speech or harassment',
  SEXUAL_CONTENT = 'Sexual content',
  VIOLENT_OR_REPULSIVE_CONTENT = 'Violent or repulsive content',
  VIOLENCE_OR_THREATS = 'Violence or threats',
  HARMFUL_OR_DANGEROUS_ACTS = 'Harmful or dangerous acts',
  CHILD_ABUSE = 'Child abuse',
  PROMOTES_TERRORISM = 'Promotes terrorism',
  COPYRIGHT_INFRINGEMENT = 'Copyright infringement',
  PRIVACY_VIOLATION = 'Privacy violation',
  IMPERSONATION = 'Impersonation',
  OTHER = 'Other',
}

export const REPORT_REASONS: ReportReason[] = Object.values(ReportReason);

/** Video-report picker order (superset — matches the existing web list). */
export const VIDEO_REPORT_REASONS: ReportReason[] = [
  ReportReason.SPAM_OR_MISLEADING,
  ReportReason.HATE_SPEECH_OR_HARASSMENT,
  ReportReason.SEXUAL_CONTENT,
  ReportReason.VIOLENT_OR_REPULSIVE_CONTENT,
  ReportReason.HARMFUL_OR_DANGEROUS_ACTS,
  ReportReason.CHILD_ABUSE,
  ReportReason.PROMOTES_TERRORISM,
  ReportReason.COPYRIGHT_INFRINGEMENT,
  ReportReason.PRIVACY_VIOLATION,
  ReportReason.OTHER,
];

/** Comment-report picker order (matches the existing web list). */
export const COMMENT_REPORT_REASONS: ReportReason[] = [
  ReportReason.SPAM_OR_MISLEADING,
  ReportReason.HATE_SPEECH_OR_HARASSMENT,
  ReportReason.SEXUAL_CONTENT,
  ReportReason.VIOLENCE_OR_THREATS,
  ReportReason.CHILD_ABUSE,
  ReportReason.PRIVACY_VIOLATION,
  ReportReason.OTHER,
];

/** User-report picker order (matches existing mobile usage). */
export const USER_REPORT_REASONS: ReportReason[] = [
  ReportReason.SPAM_OR_MISLEADING,
  ReportReason.HATE_SPEECH_OR_HARASSMENT,
  ReportReason.IMPERSONATION,
  ReportReason.COPYRIGHT_INFRINGEMENT,
  ReportReason.PRIVACY_VIOLATION,
  ReportReason.HARMFUL_OR_DANGEROUS_ACTS,
  ReportReason.CHILD_ABUSE,
  ReportReason.OTHER,
];

export enum ReportSeverity {
  P0 = 'p0',
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
}

/** Mirrors docs/ESCALATION_RULES.md §1's tiers, extended to platform-wide reports. */
export const REPORT_SEVERITY_BY_REASON: Record<ReportReason, ReportSeverity> = {
  [ReportReason.CHILD_ABUSE]: ReportSeverity.P0,
  [ReportReason.PROMOTES_TERRORISM]: ReportSeverity.P0,
  [ReportReason.HATE_SPEECH_OR_HARASSMENT]: ReportSeverity.P1,
  [ReportReason.VIOLENT_OR_REPULSIVE_CONTENT]: ReportSeverity.P1,
  [ReportReason.VIOLENCE_OR_THREATS]: ReportSeverity.P1,
  [ReportReason.HARMFUL_OR_DANGEROUS_ACTS]: ReportSeverity.P1,
  [ReportReason.COPYRIGHT_INFRINGEMENT]: ReportSeverity.P2,
  [ReportReason.PRIVACY_VIOLATION]: ReportSeverity.P2,
  [ReportReason.IMPERSONATION]: ReportSeverity.P2,
  [ReportReason.SEXUAL_CONTENT]: ReportSeverity.P2,
  [ReportReason.SPAM_OR_MISLEADING]: ReportSeverity.P3,
  [ReportReason.OTHER]: ReportSeverity.P3,
};

export function severityForReportReason(reason: string): ReportSeverity {
  return REPORT_SEVERITY_BY_REASON[reason as ReportReason] ?? ReportSeverity.P3;
}

/** Lower number sorts first — use as an ORDER BY key alongside createdAt. */
export const REPORT_SEVERITY_RANK: Record<ReportSeverity, number> = {
  [ReportSeverity.P0]: 0,
  [ReportSeverity.P1]: 1,
  [ReportSeverity.P2]: 2,
  [ReportSeverity.P3]: 3,
};
