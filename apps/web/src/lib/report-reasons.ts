/** YouTube-style report reason presets (sent as the report `reason` string). */

export const VIDEO_REPORT_REASONS = [
  'Spam or misleading',
  'Hate speech or harassment',
  'Sexual content',
  'Violent or repulsive content',
  'Harmful or dangerous acts',
  'Child abuse',
  'Promotes terrorism',
  'Copyright infringement',
  'Privacy violation',
  'Other',
] as const;

export const COMMENT_REPORT_REASONS = [
  'Spam or misleading',
  'Hate speech or harassment',
  'Sexual content',
  'Violence or threats',
  'Child abuse',
  'Privacy violation',
  'Other',
] as const;

export type VideoReportReason = (typeof VIDEO_REPORT_REASONS)[number];
export type CommentReportReason = (typeof COMMENT_REPORT_REASONS)[number];
