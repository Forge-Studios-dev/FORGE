import { ANALYTICS_EVENTS, isAllowedAnalyticsEvent } from './analytics';

describe('analytics allowlist', () => {
  it('accepts known events', () => {
    for (const e of ANALYTICS_EVENTS) {
      expect(isAllowedAnalyticsEvent(e)).toBe(true);
    }
  });

  it('rejects unknown events', () => {
    expect(isAllowedAnalyticsEvent('page.view')).toBe(false);
  });
});
