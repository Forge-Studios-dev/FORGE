import { describe, expect, it } from 'vitest';
import {
  buildWatchShareUrl,
  formatTimeQueryParam,
  parseTimeQueryParam,
} from './watch-url';

describe('watch-url', () => {
  it('formats and parses t= params', () => {
    expect(formatTimeQueryParam(45)).toBe('45');
    expect(formatTimeQueryParam(90)).toBe('1m30s');
    expect(formatTimeQueryParam(3723)).toBe('1h2m3s');
    expect(parseTimeQueryParam('90')).toBe(90);
    expect(parseTimeQueryParam('1m30s')).toBe(90);
    expect(parseTimeQueryParam('1h2m3s')).toBe(3723);
    expect(parseTimeQueryParam('bad')).toBeNull();
  });

  it('builds share URLs with list and timestamp', () => {
    const url = buildWatchShareUrl({
      videoId: 'vid-1',
      origin: 'https://example.com',
      seconds: 90,
      listId: 'pl-1',
    });
    expect(url).toContain('/watch/vid-1');
    expect(url).toContain('list=pl-1');
    expect(url).toContain('t=1m30s');
  });
});
