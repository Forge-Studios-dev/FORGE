import { ReportSeverity } from '@forge/shared-types';
import {
  dailyReportCapForTrust,
  demoteSeverityForLowTrust,
  ELEVATED_DISMISS_DAILY_REPORT_CAP,
  isLowTrustReporter,
  LOW_TRUST_DAILY_REPORT_CAP,
  TRUSTED_DAILY_REPORT_CAP,
} from './reporter-trust.util';

describe('reporter-trust.util', () => {
  describe('dailyReportCapForTrust', () => {
    it('gives the trusted cap with no history', () => {
      expect(dailyReportCapForTrust(0, 0)).toBe(TRUSTED_DAILY_REPORT_CAP);
    });

    it('lowers the cap for chronically dismissed reporters', () => {
      expect(dailyReportCapForTrust(7, 1)).toBe(LOW_TRUST_DAILY_REPORT_CAP);
      expect(isLowTrustReporter(7, 1)).toBe(true);
    });

    it('uses the elevated-dismiss cap when dismissals are high but not chronic', () => {
      expect(dailyReportCapForTrust(8, 8)).toBe(ELEVATED_DISMISS_DAILY_REPORT_CAP);
      expect(isLowTrustReporter(8, 8)).toBe(false);
    });

    it('keeps trusted cap when most reports are upheld', () => {
      expect(dailyReportCapForTrust(1, 5)).toBe(TRUSTED_DAILY_REPORT_CAP);
    });
  });

  describe('demoteSeverityForLowTrust', () => {
    it('never demotes P0', () => {
      expect(demoteSeverityForLowTrust(ReportSeverity.P0)).toBe(ReportSeverity.P0);
    });

    it('demotes P1→P2 and P2→P3', () => {
      expect(demoteSeverityForLowTrust(ReportSeverity.P1)).toBe(ReportSeverity.P2);
      expect(demoteSeverityForLowTrust(ReportSeverity.P2)).toBe(ReportSeverity.P3);
      expect(demoteSeverityForLowTrust(ReportSeverity.P3)).toBe(ReportSeverity.P3);
    });
  });
});
