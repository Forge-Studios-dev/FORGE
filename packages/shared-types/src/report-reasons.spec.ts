import {
  COMMENT_REPORT_REASONS,
  REPORT_REASONS,
  REPORT_SEVERITY_BY_REASON,
  REPORT_SEVERITY_RANK,
  ReportReason,
  ReportSeverity,
  USER_REPORT_REASONS,
  VIDEO_REPORT_REASONS,
  severityForReportReason,
} from './report-reasons';

describe('report-reasons', () => {
  it('maps every ReportReason to a severity', () => {
    for (const reason of REPORT_REASONS) {
      expect(REPORT_SEVERITY_BY_REASON[reason]).toBeDefined();
    }
  });

  it('every picker list only uses valid reasons', () => {
    for (const list of [VIDEO_REPORT_REASONS, COMMENT_REPORT_REASONS, USER_REPORT_REASONS]) {
      for (const reason of list) {
        expect(REPORT_REASONS).toContain(reason);
      }
    }
  });

  it('severityForReportReason falls back to P3 for an unknown string', () => {
    expect(severityForReportReason('not a real reason')).toBe(ReportSeverity.P3);
  });

  it('severityForReportReason resolves known reasons correctly', () => {
    expect(severityForReportReason(ReportReason.CHILD_ABUSE)).toBe(ReportSeverity.P0);
    expect(severityForReportReason(ReportReason.SPAM_OR_MISLEADING)).toBe(ReportSeverity.P3);
  });

  it('REPORT_SEVERITY_RANK orders P0 before P3', () => {
    expect(REPORT_SEVERITY_RANK[ReportSeverity.P0]).toBeLessThan(
      REPORT_SEVERITY_RANK[ReportSeverity.P3],
    );
  });
});
