import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeedService } from './feed.service';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';
import { Follow } from '../engagement/entities/follow.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Category } from '../categories/entities/category.entity';
import { VideosService } from '../content/videos.service';
import { EngagementService } from '../engagement/engagement.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('FeedService', () => {
  let service: FeedService;

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
  };

  const feedQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const videoRepository = {
    createQueryBuilder: jest.fn(() => feedQb),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const followRepository = { find: jest.fn().mockResolvedValue([]) };
  const watchHistoryRepository = { find: jest.fn().mockResolvedValue([]) };
  const categoryRepository = { findOne: jest.fn() };
  const videosService = {
    mapToPublicVideo: jest.fn((v: Video) => ({ id: v.id, title: v.title })),
  };
  const engagementService = {
    getFollowingCreatorIds: jest.fn().mockResolvedValue([]),
  };
  const entitlementsService = {
    listMySubscriptions: jest.fn().mockResolvedValue([]),
  };

  const sampleVideo = (id: string): Video =>
    ({
      id,
      title: `Video ${id}`,
      userId: 'creator-1',
      status: VideoStatus.READY,
      visibility: VideoVisibility.PUBLIC,
      viewCount: 100,
      likeCount: 10,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      publishedAt: new Date('2026-01-02T00:00:00Z'),
    }) as Video;

  beforeEach(async () => {
    jest.clearAllMocks();
    feedQb.getRawMany.mockResolvedValue([]);
    feedQb.getMany.mockResolvedValue([]);
    videoRepository.find.mockResolvedValue([]);
    videoRepository.findOne.mockResolvedValue(null);
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(2);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: getRepositoryToken(WatchHistory), useValue: watchHistoryRepository },
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: VideosService, useValue: videosService },
        { provide: EngagementService, useValue: engagementService },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get(FeedService);
  });

  describe('getFeed', () => {
    it('returns empty feed when no videos match', async () => {
      const result = await service.getFeed({ sort: 'latest' });
      expect(result).toEqual({ data: [], meta: { cursor: null, hasMore: false } });
    });

    it('hydrates videos and maps to public shape', async () => {
      feedQb.getRawMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);
      const videos = [sampleVideo('v1'), sampleVideo('v2')];
      videoRepository.find.mockResolvedValue(videos);

      const result = await service.getFeed({ sort: 'latest', limit: 20 });

      expect(result.data).toEqual([
        { id: 'v1', title: 'Video v1' },
        { id: 'v2', title: 'Video v2' },
      ]);
      expect(result.meta.hasMore).toBe(false);
      expect(videosService.mapToPublicVideo).toHaveBeenCalledTimes(2);
    });

    it('returns cached anonymous latest feed when present', async () => {
      const cached = {
        data: [{ id: 'cached-1', title: 'Cached' }],
        meta: { cursor: null, hasMore: false },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getFeed({ sort: 'latest' });

      expect(result).toEqual(cached);
      expect(videoRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('does not use cache for personalized forYou feed', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ data: [], meta: { cursor: null, hasMore: false } }),
      );

      await service.getFeed({ sort: 'forYou', userId: 'user-1' });

      expect(videoRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('falls back to latest when forYou requested without user', async () => {
      await service.getFeed({ sort: 'forYou' });
      expect(feedQb.orderBy).toHaveBeenCalledWith('sort_time', 'DESC');
    });

    it('resolves category slug to id', async () => {
      categoryRepository.findOne.mockResolvedValue({ id: 'cat-1', slug: 'music' });
      await service.getFeed({ categorySlug: 'music' });
      expect(categoryRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'music' } });
      expect(feedQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('category_id'),
        { categoryId: 'cat-1' },
      );
    });

    it('caps limit at 50', async () => {
      await service.getFeed({ limit: 100 });
      expect(feedQb.limit).toHaveBeenCalledWith(51);
    });

    it('sets next cursor when more results exist', async () => {
      feedQb.getRawMany.mockResolvedValue([
        { id: 'v1' },
        { id: 'v2' },
        { id: 'v3' },
      ]);
      videoRepository.find.mockResolvedValue([
        sampleVideo('v1'),
        sampleVideo('v2'),
      ]);

      const result = await service.getFeed({ sort: 'latest', limit: 2 });

      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBeTruthy();
    });

    it('caches anonymous latest results in redis', async () => {
      feedQb.getRawMany.mockResolvedValue([{ id: 'v1' }]);
      videoRepository.find.mockResolvedValue([sampleVideo('v1')]);

      await service.getFeed({ sort: 'latest' });

      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('getFollowingFeed', () => {
    it('requires authentication', async () => {
      await expect(service.getFollowingFeed({ userId: '' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns empty when user follows no creators and has no subscriptions', async () => {
      const result = await service.getFollowingFeed({ userId: 'user-1' });
      expect(result).toEqual({ data: [], meta: { cursor: null, hasMore: false } });
      expect(videoRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('merges followed and subscribed creator ids', async () => {
      engagementService.getFollowingCreatorIds.mockResolvedValue(['c1']);
      entitlementsService.listMySubscriptions.mockResolvedValue([
        { creatorId: 'c2' },
        { creatorId: 'c1' },
      ]);
      feedQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      videoRepository.find.mockResolvedValue([sampleVideo('v1')]);

      await service.getFollowingFeed({ userId: 'user-1' });

      expect(feedQb.andWhere).toHaveBeenCalledWith('v.user_id IN (:...creatorIds)', {
        creatorIds: expect.arrayContaining(['c1', 'c2']),
      });
    });
  });

  describe('getRelatedVideos', () => {
    const source = {
      id: 'src',
      userId: 'creator-1',
      categoryId: 'cat-1',
      skillTags: [{ id: 'tag-1' }, { id: 'tag-2' }],
    } as unknown as Video;

    it('throws when the source video does not exist', async () => {
      videoRepository.findOne.mockResolvedValue(null);
      await expect(service.getRelatedVideos({ videoId: 'missing' })).rejects.toThrow(
        'Video not found',
      );
    });

    it('ranks by content relevance and hydrates results', async () => {
      videoRepository.findOne.mockResolvedValue(source);
      feedQb.getRawMany.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);
      videoRepository.find.mockResolvedValue([sampleVideo('v1'), sampleVideo('v2')]);

      const result = await service.getRelatedVideos({ videoId: 'src', limit: 12 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ source: 'src' });
      expect(feedQb.orderBy).toHaveBeenCalledWith('relevance', 'DESC');
      // Source video must never recommend itself.
      expect(feedQb.andWhere).toHaveBeenCalledWith('v.id != :relSourceId', { relSourceId: 'src' });
    });

    it('excludes already-watched videos for signed-in viewers', async () => {
      videoRepository.findOne.mockResolvedValue(source);
      feedQb.getRawMany.mockResolvedValue([{ id: 'v1' }]);
      videoRepository.find.mockResolvedValue([sampleVideo('v1')]);

      await service.getRelatedVideos({ videoId: 'src', userId: 'viewer-1', limit: 12 });

      expect(feedQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('NOT EXISTS'),
        { relViewerId: 'viewer-1' },
      );
    });

    it('caches anonymous related results', async () => {
      videoRepository.findOne.mockResolvedValue(source);
      feedQb.getRawMany.mockResolvedValue([{ id: 'v1' }]);
      videoRepository.find.mockResolvedValue([sampleVideo('v1')]);

      await service.getRelatedVideos({ videoId: 'src' });

      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    it('increments feed cache generation', async () => {
      await service.invalidateFeedCache();
      expect(redis.incr).toHaveBeenCalledWith('feed:cache:generation');
    });

    it('deletes video detail cache key', async () => {
      await service.invalidateVideoDetailCache('video-1');
      expect(redis.del).toHaveBeenCalledWith('video:detail:video-1');
    });
  });
});
