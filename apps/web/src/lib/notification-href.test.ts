import { describe, expect, it } from 'vitest';
import { adminContentHeldHref, notificationHref } from './notification-href';

describe('notificationHref', () => {
  it('routes content_scan_held to admin held queue (never consumer watch)', () => {
    const href = notificationHref('content_scan_held', { videoId: 'v-held' });
    expect(href).toMatch(/\/content\?/);
    expect(href).toContain('moderationStatus=held');
    expect(href).toContain('videoId=v-held');
    expect(href).not.toContain('/watch/');
  });

  it('adminContentHeldHref builds held-queue URL', () => {
    const href = adminContentHeldHref('abc');
    expect(href).toContain('/content?');
    expect(href).toContain('moderationStatus=held');
    expect(href).toContain('videoId=abc');
  });
});
