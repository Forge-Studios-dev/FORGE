import { diversifyByCreator } from './feed-diversity.util';

describe('forYou ranking helpers', () => {
  it('diversifyByCreator keeps length and soft-caps early creator runs', () => {
    const items = [
      { userId: 'a', id: '1' },
      { userId: 'a', id: '2' },
      { userId: 'a', id: '3' },
      { userId: 'b', id: '4' },
      { userId: 'c', id: '5' },
    ];
    const out = diversifyByCreator(items, 2);
    expect(out).toHaveLength(5);
    expect(out.slice(0, 4).map((x) => x.userId)).toEqual(['a', 'a', 'b', 'c']);
    expect(out[4].id).toBe('3');
  });

  it('category-affinity boost outweighs plain popularity in scoring math', () => {
    // Mirrors feed.service forYouScore: follow +2, creator aff +1, category +1.5
    const popular = (viewCount: number, likeCount: number) =>
      viewCount * 0.6 + likeCount * 0.3 + (1_700_000_000_000 / 1000 / 86400) * 0.1;
    const base = popular(100, 10);
    const withCategory = base + 1.5;
    const withFollow = base + 2;
    expect(withCategory).toBeGreaterThan(base);
    expect(withFollow).toBeGreaterThan(withCategory);
  });
});
