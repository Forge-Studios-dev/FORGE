import { describe, expect, it } from 'vitest';
import {
  buildWatchListHref,
  pickShuffledNextId,
} from './playlist-watch-prefs';

describe('playlist-watch-prefs', () => {
  it('buildWatchListHref includes list and optional shuffle', () => {
    expect(buildWatchListHref('v1', null, true)).toBe('/watch/v1');
    expect(buildWatchListHref('v1', 'pl1', false)).toBe('/watch/v1?list=pl1');
    expect(buildWatchListHref('v1', 'pl1', true)).toBe('/watch/v1?list=pl1&shuffle=1');
  });

  it('pickShuffledNextId skips current and is stable for same seed', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const first = pickShuffledNextId(ids, 'a', 'list-1');
    const second = pickShuffledNextId(ids, 'a', 'list-1');
    expect(first).toBe(second);
    expect(first).not.toBe('a');
    expect(ids).toContain(first!);
  });

  it('pickShuffledNextId returns null when alone', () => {
    expect(pickShuffledNextId(['only'], 'only', 'list-1')).toBeNull();
  });
});
