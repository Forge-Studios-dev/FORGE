import { RecommendationsService, RecommendedVideo, parseTrendingWindowHours } from './recommendations.service';
import { DataSource } from 'typeorm';

describe('parseTrendingWindowHours', () => {
  it('maps now/24h to 24 and week/default to 168', () => {
    expect(parseTrendingWindowHours('now')).toBe(24);
    expect(parseTrendingWindowHours('24h')).toBe(24);
    expect(parseTrendingWindowHours('week')).toBe(168);
    expect(parseTrendingWindowHours(undefined)).toBe(168);
    expect(parseTrendingWindowHours('')).toBe(168);
  });
});

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let queryMock: jest.Mock;
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(() => {
    queryMock = jest.fn();
    redis.get.mockResolvedValue(null);
    const ds = { query: queryMock } as unknown as DataSource;
    const engagement = {
      getBlockedPeerIds: jest.fn().mockResolvedValue([]),
    };
    service = new RecommendationsService(ds, redis as never, engagement as never);
  });

  const fakeVideo = (overrides: Partial<RecommendedVideo> = {}): RecommendedVideo => ({
    id: 'v1',
    title: 'Learn Guitar',
    thumbnailUrl: null,
    duration: 600,
    viewCount: 100,
    userId: 'creator-1',
    categoryId: 'cat-1',
    score: 50,
    reason: 'trending',
    ...overrides,
  });

  describe('getPersonalizedFeed', () => {
    it('returns personalized results when user has watch history', async () => {
      const videos = [fakeVideo(), fakeVideo({ id: 'v2', title: 'Learn Piano', score: 30 })];

      // Enough rows that getTrending fallback is skipped (limit 2).
      // Queries: top cats → session cats → watched → main
      queryMock
        .mockResolvedValueOnce([{ category_id: 'cat-1', watch_count: '10' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ video_id: 'already-watched' }])
        .mockResolvedValueOnce(videos);

      const result = await service.getPersonalizedFeed('user-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('v1');
      expect(result.data[1].id).toBe('v2');

      expect(queryMock).toHaveBeenCalledTimes(4);
      const [topCatQuery] = queryMock.mock.calls[0];
      expect(topCatQuery).toContain('watch_history');
      expect(topCatQuery).toContain('category_id');
    });

    it('prefers session categories ahead of long-term affinity', async () => {
      queryMock
        .mockResolvedValueOnce([{ category_id: 'long-term', watch_count: '50' }])
        .mockResolvedValueOnce([{ category_id: 'session-cat' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([fakeVideo({ id: 'v1' }), fakeVideo({ id: 'v2' })]);

      await service.getPersonalizedFeed('user-1', { limit: 2 });

      const mainParams = queryMock.mock.calls[3][1] as unknown[];
      expect(mainParams[1]).toEqual(['session-cat', 'long-term']);
      const sessionQuery = queryMock.mock.calls[1][0] as string;
      expect(sessionQuery).toContain("INTERVAL '2 hours'");
    });

    it('includes session_creators CTE in ranking SQL', async () => {
      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([fakeVideo({ id: 'v1' }), fakeVideo({ id: 'v2' })]);

      await service.getPersonalizedFeed('user-1', { limit: 2 });

      const mainQuery = queryMock.mock.calls[3][0] as string;
      expect(mainQuery).toContain('session_creators');
      expect(mainQuery).toContain('session_affinity');
    });

    it('clamps limit to 50', async () => {
      // Return 50 rows so fallback getTrending is not invoked; exploration runs on first page.
      const rows = Array.from({ length: 50 }, (_, i) => fakeVideo({ id: `v${i}` }));
      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([]);

      await service.getPersonalizedFeed('user-1', { limit: 200 });

      const mainQuery = queryMock.mock.calls[3][0] as string;
      const params = queryMock.mock.calls[3][1] as unknown[];
      const limitParam = params[params.length - 2];
      expect(limitParam).toBe(50);
      expect(mainQuery).toContain('ORDER BY score DESC');
    });

    it('fills with trending when personalized results are insufficient', async () => {
      const personalizedVideos = [fakeVideo({ id: 'p1' })];
      const trendingFallback = [fakeVideo({ id: 't1' }), fakeVideo({ id: 't2' })];

      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(personalizedVideos)
        .mockResolvedValueOnce(trendingFallback);

      const result = await service.getPersonalizedFeed('user-1', { limit: 20 });

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      // top + session + watched + main + trending = 5; rows after fallback < 4 → no exploration
      expect(queryMock).toHaveBeenCalledTimes(5);
    });

    it('excludes specified video IDs', async () => {
      // Full page → no trending fallback; exclusion still present on main query params.
      const rows = Array.from({ length: 10 }, (_, i) => fakeVideo({ id: `v${i}` }));
      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([]);

      await service.getPersonalizedFeed('user-1', {
        limit: 10,
        excludeVideoIds: ['exclude-1', 'exclude-2'],
      });

      const params = queryMock.mock.calls[3][1] as unknown[];
      expect(params).toContain('exclude-1');
      expect(params).toContain('exclude-2');
    });

    it('weaves exploration candidates on the first page', async () => {
      const rows = Array.from({ length: 8 }, (_, i) =>
        fakeVideo({ id: `a${i}`, userId: `c${i}` }),
      );
      const exploration = [
        fakeVideo({ id: 'e1', userId: 'explorer', reason: 'exploration', score: 12 }),
      ];

      queryMock
        .mockResolvedValueOnce([{ category_id: 'cat-1', watch_count: '3' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce(exploration);

      const result = await service.getPersonalizedFeed('user-1', { limit: 8 });

      expect(result.data.some((v) => v.id === 'e1')).toBe(true);
      const explorationQuery = queryMock.mock.calls[4][0] as string;
      expect(explorationQuery).toContain("'exploration'");
      expect(explorationQuery).toContain('NOT IN (SELECT following_id FROM follows');
    });

    it('skips exploration on offset pages', async () => {
      const rows = Array.from({ length: 8 }, (_, i) => fakeVideo({ id: `a${i}` }));
      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(rows);

      await service.getPersonalizedFeed('user-1', { limit: 8, offset: 8 });

      expect(queryMock).toHaveBeenCalledTimes(4);
    });

    it('handles user with no watch history gracefully', async () => {
      const trending = [fakeVideo({ id: 't1', reason: 'trending' })];

      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(trending);

      const result = await service.getPersonalizedFeed('new-user', { limit: 5 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].reason).toBe('trending');
    });
  });

  describe('getTrending', () => {
    it('returns trending videos sorted by recent views + total', async () => {
      const videos = [
        fakeVideo({ id: 'tr1', score: 200 }),
        fakeVideo({ id: 'tr2', score: 150 }),
      ];
      queryMock.mockResolvedValueOnce(videos);

      const result = await service.getTrending('user-1', 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tr1');

      const query = queryMock.mock.calls[0][0] as string;
      const params = queryMock.mock.calls[0][1] as unknown[];
      expect(query).toContain('publish_status');
      expect(query).toContain("visibility = 'public'");
      expect(query).toContain('watched_at');
      expect(params[0]).toBe(10);
      expect(params[1]).toBe(168);
      expect(params[2]).toBe('user-1');
    });

    it('uses 24h window when requested', async () => {
      queryMock.mockResolvedValueOnce([]);
      await service.getTrending(undefined, 10, [], 24);
      const params = queryMock.mock.calls[0][1] as unknown[];
      expect(params[1]).toBe(24);
    });

    it('excludes specific video IDs', async () => {
      queryMock.mockResolvedValueOnce([]);

      await service.getTrending('user-1', 10, ['skip-1']);

      const params = queryMock.mock.calls[0][1] as unknown[];
      expect(params).toContain('skip-1');
    });

    it('works without excludeUserId', async () => {
      queryMock.mockResolvedValueOnce([fakeVideo()]);

      const result = await service.getTrending(undefined, 5);

      expect(result).toHaveLength(1);
      const query = queryMock.mock.calls[0][0] as string;
      expect(query).not.toContain('user_id !=');
    });
  });

  describe('getSimilarVideos', () => {
    it('returns videos in the same category', async () => {
      const similar = [fakeVideo({ id: 's1', reason: 'same_category' })];
      queryMock.mockResolvedValueOnce(similar);

      const result = await service.getSimilarVideos('source-video', 5);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('same_category');

      const [query, params] = queryMock.mock.calls[0];
      expect(query).toContain('src.id = $1');
      expect(params).toEqual(['source-video', 5]);
    });

    it('defaults limit to 10', async () => {
      queryMock.mockResolvedValueOnce([]);

      await service.getSimilarVideos('v1');

      const params = queryMock.mock.calls[0][1] as unknown[];
      expect(params[1]).toBe(10);
    });

    it('excludes blocked peers when viewerId is set', async () => {
      const engagement = (service as any).engagementService as {
        getBlockedPeerIds: jest.Mock;
      };
      engagement.getBlockedPeerIds.mockResolvedValueOnce(['blocked-creator']);
      queryMock.mockResolvedValueOnce([]);

      await service.getSimilarVideos('v1', 5, 'viewer-1');

      const [query, params] = queryMock.mock.calls[0] as [string, unknown[]];
      expect(query).toContain('v.user_id NOT IN');
      expect(params).toEqual(['v1', 5, 'blocked-creator']);
      expect(engagement.getBlockedPeerIds).toHaveBeenCalledWith('viewer-1');
    });
  });

  describe('discoverable-video filters (moderation/schedule/index gate)', () => {
    // Every discovery surface (feed, search) excludes held/blocked videos,
    // future-scheduled premieres, and not-yet-indexed videos via
    // applyDiscoverableVideoFilters — recommendations/trending/similar used
    // to skip all three, letting such content leak into the home "For You"
    // feed and the public trending/recommended endpoints ahead of schedule
    // or after a moderator action.
    function assertHasDiscoverableFilters(query: string) {
      expect(query).toContain("v.moderation_status = 'none'");
      expect(query).toContain('v.scheduled_publish_at IS NULL');
      expect(query).toContain('v.published_at IS NULL');
      expect(query).toContain('v.indexed_at IS NOT NULL');
    }

    it('getPersonalizedFeed excludes held/scheduled/unindexed videos', async () => {
      queryMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getPersonalizedFeed('user-1', { limit: 5 });

      const query = queryMock.mock.calls[3][0] as string;
      assertHasDiscoverableFilters(query);
    });

    it('getTrending excludes held/scheduled/unindexed videos', async () => {
      queryMock.mockResolvedValueOnce([]);
      await service.getTrending('user-1', 10);
      assertHasDiscoverableFilters(queryMock.mock.calls[0][0] as string);
    });

    it('getSimilarVideos excludes held/scheduled/unindexed videos', async () => {
      queryMock.mockResolvedValueOnce([]);
      await service.getSimilarVideos('v1', 5);
      assertHasDiscoverableFilters(queryMock.mock.calls[0][0] as string);
    });
  });
});
