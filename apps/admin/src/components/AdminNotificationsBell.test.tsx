import { describe, expect, it } from 'vitest';
import { adminNotificationHref } from './AdminNotificationsBell';

describe('adminNotificationHref', () => {
  it('routes content_scan_held to held content with videoId', () => {
    expect(
      adminNotificationHref({
        type: 'content_scan_held',
        metadata: { videoId: 'v-held' },
      }),
    ).toBe('/content?moderationStatus=held&videoId=v-held');
  });

  it('falls back to held queue without videoId', () => {
    expect(adminNotificationHref({ type: 'content_scan_held', metadata: {} })).toBe(
      '/content?moderationStatus=held',
    );
  });

  it('defaults other types to held queue for admin triage', () => {
    expect(adminNotificationHref({ type: 'strike_issued', metadata: null })).toBe(
      '/content?moderationStatus=held',
    );
  });
});
