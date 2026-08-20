import { diversifyByCreator } from '../feed/feed-diversity.util';
import { rankShortsByScore, scoreShortForFeed } from './shorts-rank.util';

describe('shorts-rank.util', () => {
  const now = Date.parse('2026-08-04T12:00:00.000Z');

  it('scores fresher shorts higher than older high-view ones within a day', () => {
    const fresh = scoreShortForFeed(
      {
        userId: 'a',
        publishedAt: new Date(now - 2 * 3_600_000),
        viewCount: 10,
        likeCount: 1,
      },
      now,
    );
    const oldViral = scoreShortForFeed(
      {
        userId: 'b',
        publishedAt: new Date(now - 30 * 24 * 3_600_000),
        viewCount: 10_000,
        likeCount: 500,
      },
      now,
    );
    expect(fresh).toBeGreaterThan(oldViral);
  });

  it('ranks and diversifies so one creator does not dominate the top', () => {
    const items = [
      {
        id: '1',
        userId: 'c1',
        publishedAt: new Date(now - 1 * 3_600_000),
        viewCount: 100,
        likeCount: 10,
      },
      {
        id: '2',
        userId: 'c1',
        publishedAt: new Date(now - 2 * 3_600_000),
        viewCount: 90,
        likeCount: 9,
      },
      {
        id: '3',
        userId: 'c2',
        publishedAt: new Date(now - 3 * 3_600_000),
        viewCount: 50,
        likeCount: 5,
      },
    ];
    const ranked = rankShortsByScore(items, now);
    const diversified = diversifyByCreator(ranked, 1);
    expect(diversified[0].userId).toBe('c1');
    expect(diversified[1].userId).toBe('c2');
    expect(diversified.map((i) => i.id).sort()).toEqual(['1', '2', '3']);
  });

  it('scores a higher-completion short above an equally fresh, equally viewed one', () => {
    const base = { userId: 'a', publishedAt: new Date(now - 2 * 3_600_000), viewCount: 100, likeCount: 10 };
    const highCompletion = scoreShortForFeed({ ...base, avgWatchPercent: 90 }, now);
    const lowCompletion = scoreShortForFeed({ ...base, avgWatchPercent: 20 }, now);
    expect(highCompletion).toBeGreaterThan(lowCompletion);
  });

  it('treats a missing avgWatchPercent (not yet computed) as zero contribution, not a penalty vs. explicit zero', () => {
    const base = { userId: 'a', publishedAt: new Date(now - 2 * 3_600_000), viewCount: 100, likeCount: 10 };
    const missing = scoreShortForFeed({ ...base }, now);
    const explicitZero = scoreShortForFeed({ ...base, avgWatchPercent: 0 }, now);
    expect(missing).toBe(explicitZero);
  });

  it('clamps an out-of-range avgWatchPercent instead of letting it dominate or invert the score', () => {
    const base = { userId: 'a', publishedAt: new Date(now - 2 * 3_600_000), viewCount: 100, likeCount: 10 };
    const over100 = scoreShortForFeed({ ...base, avgWatchPercent: 250 }, now);
    const at100 = scoreShortForFeed({ ...base, avgWatchPercent: 100 }, now);
    expect(over100).toBe(at100);
  });
});
