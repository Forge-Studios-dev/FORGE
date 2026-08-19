import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { VideosService } from '../content/videos.service';
import { EngagementService } from '../engagement/engagement.service';

function makeQb<T>(result: T) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  };
}

describe('SearchService', () => {
  let service: SearchService;

  const redis = {
    get: jest.fn(),
    setex: jest.fn(),
  };

  let videoQb: ReturnType<typeof makeQb<Video[]>>;
  let userQb: ReturnType<typeof makeQb<User[]>>;
  let suggestionQb: ReturnType<typeof makeQb<{ title: string }[]>>;
  let playlistQb: ReturnType<typeof makeQb<Playlist[]>>;

  const videoRepository = {
    createQueryBuilder: jest.fn(),
  };
  const userRepository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const playlistRepository = {
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };
  const videosService = {
    mapToPublicVideo: jest.fn((v: Video) => ({ id: v.id, title: v.title })),
  };

  const sampleVideo = (id: string): Video =>
    ({
      id,
      title: `Title ${id}`,
      userId: 'creator-1',
      status: VideoStatus.READY,
      visibility: VideoVisibility.PUBLIC,
    }) as Video;

  const sampleUser = (id: string): User =>
    ({
      id,
      email: `${id}@example.com`,
      username: id,
      displayName: `User ${id}`,
      role: UserRole.USER,
      isVerified: true,
      followerCount: 5,
      followingCount: 2,
      videoCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    videoQb = makeQb<Video[]>([]);
    userQb = makeQb<User[]>([]);
    suggestionQb = makeQb<{ title: string }[]>([]);
    videoRepository.createQueryBuilder.mockImplementation((alias?: string) => {
      if (alias === 'v' && suggestionQb.select.mock.calls.length) {
        return suggestionQb;
      }
      return videoQb;
    });
    userRepository.createQueryBuilder.mockReturnValue(userQb);
    playlistQb = makeQb<Playlist[]>([]);
    playlistRepository.createQueryBuilder.mockReturnValue(playlistQb);
    playlistRepository.find.mockResolvedValue([]);
    userRepository.find.mockResolvedValue([]);
    redis.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Playlist), useValue: playlistRepository },
        { provide: VideosService, useValue: videosService },
        {
          provide: EngagementService,
          useValue: { getBlockedPeerIds: jest.fn().mockResolvedValue([]) },
        },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get(SearchService);
  });

  describe('search', () => {
    it('returns empty results for queries shorter than 2 characters', async () => {
      const result = await service.search('a');
      expect(result).toEqual({
        videos: [],
        users: [],
        playlists: [],
        meta: { q: 'a', type: 'all', duration: 'any', uploaded: 'any', sort: 'relevance', captions: 'any', kind: 'any', watched: 'any' },
      });
      expect(videoRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns cached search payload when present', async () => {
      const cached = {
        videos: [{ id: 'v1', title: 'Cached' }],
        users: [],
        playlists: [],
        meta: { q: 'forge', mode: 'fts', type: 'all' },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.search('forge');

      expect(result).toEqual(cached);
      expect(videoRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('bypasses the shared cache (read and write) for a signed-in viewer, since results are block/mute-filtered per viewer', async () => {
      const cached = {
        videos: [{ id: 'v1', title: 'Cached' }],
        users: [],
        playlists: [],
        meta: { q: 'forge', mode: 'fts', type: 'all' },
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));
      videoQb.getMany.mockResolvedValue([sampleVideo('v2')]);
      userQb.getMany.mockResolvedValue([]);

      const result = await service.search('forge', 20, 'all', undefined, 'viewer-1');

      // Ignored the stale cache hit and actually queried, because a viewer was present.
      expect(videoRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result.videos).toEqual([{ id: 'v2', title: 'Title v2' }]);
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('searches via FTS and caches results', async () => {
      videoQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      userQb.getMany.mockResolvedValue([sampleUser('u1')]);

      const result = await service.search('forge', 20);

      expect(result.videos).toEqual([{ id: 'v1', title: 'Title v1' }]);
      expect(result.users[0].username).toBe('u1');
      expect(result.playlists).toEqual([]);
      expect(result.meta).toEqual({
        q: 'forge',
        limit: 20,
        mode: 'fts',
        type: 'all',
        duration: 'any',
        uploaded: 'any',
        sort: 'relevance',
        captions: 'any',
        kind: 'any',
        watched: 'any',
      });
      expect(redis.setex).toHaveBeenCalled();
    });

    it('searches playlists only when type=playlist, ranked by relevance', async () => {
      playlistQb.getMany.mockResolvedValue([
        {
          id: 'pl1',
          title: 'Forge hits',
          description: null,
          userId: 'u1',
          visibility: 'public',
          systemType: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
        },
      ]);
      userRepository.find.mockResolvedValue([sampleUser('u1')]);

      const result = await service.search('forge', 20, 'playlist');

      expect(result.videos).toEqual([]);
      expect(result.users).toEqual([]);
      expect(result.playlists).toHaveLength(1);
      expect(result.playlists[0].title).toBe('Forge hits');
      expect(result.playlists[0].owner?.username).toBe('u1');
      expect(videoRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(playlistQb.orderBy).toHaveBeenCalledWith(
        `ts_rank_cd(p.searchVector, plainto_tsquery('english', :q))`,
        'DESC',
      );
      expect(playlistRepository.find).not.toHaveBeenCalled();
    });

    it('falls back to ILIKE for playlists when playlist FTS fails', async () => {
      playlistQb.getMany.mockRejectedValue(new Error('fts unavailable'));
      playlistRepository.find.mockResolvedValue([
        {
          id: 'pl2',
          title: 'Legacy playlist',
          description: null,
          userId: 'u1',
          visibility: 'public',
          systemType: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
        },
      ]);
      userRepository.find.mockResolvedValue([sampleUser('u1')]);

      const result = await service.search('forge', 20, 'playlist');

      expect(result.playlists).toHaveLength(1);
      expect(result.playlists[0].title).toBe('Legacy playlist');
    });

    it('falls back to legacy ILIKE search when FTS fails', async () => {
      videoQb.getMany.mockRejectedValueOnce(new Error('fts unavailable'));
      videoQb.getMany.mockResolvedValueOnce([sampleVideo('legacy-v1')]);
      userRepository.find.mockResolvedValue([sampleUser('legacy-u1')]);

      const result = await service.search('legacy', 10);

      expect(result.meta).toEqual({
        q: 'legacy',
        limit: 10,
        mode: 'legacy_ilike',
        type: 'all',
        duration: 'any',
        uploaded: 'any',
        sort: 'relevance',
        captions: 'any',
        kind: 'any',
        watched: 'any',
      });
      expect(result.videos[0].id).toBe('legacy-v1');
      expect(userRepository.find).toHaveBeenCalled();
    });

    it('caps FTS limit at 50', async () => {
      await service.search('query', 100);
      expect(videoQb.take).toHaveBeenCalledWith(50);
      expect(userQb.take).toHaveBeenCalledWith(50);
    });

    it('applies duration and upload filters to video search', async () => {
      videoQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      await service.search('forge', 20, 'video', { duration: 'short', uploaded: 'week' });
      expect(videoQb.andWhere).toHaveBeenCalledWith(
        'v.duration_seconds IS NOT NULL AND v.duration_seconds < 240',
      );
      expect(videoQb.andWhere).toHaveBeenCalledWith(
        `COALESCE(v.published_at, v.created_at) >= NOW() - CAST(:uploadedInterval AS interval)`,
        { uploadedInterval: '7 days' },
      );
    });

    it('orders by view count when sort=views', async () => {
      videoQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      await service.search('forge', 20, 'video', { sort: 'views' });
      expect(videoQb.orderBy).toHaveBeenCalledWith('v.view_count', 'DESC');
    });
    it('filters Shorts by video_type when kind=short', async () => {
      videoQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      await service.search('forge', 20, 'video', { kind: 'short' });
      expect(videoQb.andWhere).toHaveBeenCalledWith('v.video_type = :videoKind', {
        videoKind: 'short',
      });
    });

    it('filters watched videos via watch_history when viewer present', async () => {
      videoQb.getMany.mockResolvedValue([sampleVideo('v1')]);
      await service.search('forge', 20, 'video', { watched: 'watched' }, 'viewer-1');
      expect(videoQb.andWhere).toHaveBeenCalledWith(
        `EXISTS (SELECT 1 FROM watch_history wh WHERE wh.video_id = v.id AND wh.user_id = :watchViewerId)`,
        { watchViewerId: 'viewer-1' },
      );
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('suggestions', () => {
    it('returns empty titles for short prefix', async () => {
      const result = await service.suggestions('a');
      expect(result).toEqual({ titles: [], channels: [] });
    });

    it('returns distinct title prefixes', async () => {
      videoRepository.createQueryBuilder.mockImplementation(() => {
        suggestionQb.select.mockReturnThis();
        return suggestionQb;
      });
      suggestionQb.getRawMany.mockResolvedValue([
        { title: 'Forge Basics' },
        { title: 'Forge Advanced' },
      ]);
      userQb.getMany.mockResolvedValue([
        { username: 'forge_tv', displayName: 'Forge TV' },
      ]);

      const result = await service.suggestions('for', 8);

      expect(result.titles).toEqual(['Forge Basics', 'Forge Advanced']);
      expect(result.channels).toEqual([{ username: 'forge_tv', displayName: 'Forge TV' }]);
      expect(suggestionQb.andWhere).toHaveBeenCalledWith('v.title ILIKE :p', { p: 'for%' });
    });

    it('excludes blocked peers from title and channel suggestions', async () => {
      const engagement = {
        getBlockedPeerIds: jest.fn().mockResolvedValue(['blocked-1']),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: getRepositoryToken(Video), useValue: videoRepository },
          { provide: getRepositoryToken(User), useValue: userRepository },
          { provide: getRepositoryToken(Playlist), useValue: playlistRepository },
          { provide: VideosService, useValue: videosService },
          { provide: EngagementService, useValue: engagement },
          { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        ],
      }).compile();
      const svc = module.get(SearchService);

      videoRepository.createQueryBuilder.mockImplementation(() => suggestionQb);
      suggestionQb.getRawMany.mockResolvedValue([{ title: 'Ok Title' }]);
      userQb.getMany.mockResolvedValue([{ username: 'ok_tv', displayName: 'Ok TV' }]);

      await svc.suggestions('ok', 8, 'viewer-1');

      expect(engagement.getBlockedPeerIds).toHaveBeenCalledWith('viewer-1');
      expect(suggestionQb.andWhere).toHaveBeenCalledWith('v.user_id NOT IN (:...excluded)', {
        excluded: ['blocked-1'],
      });
      expect(userQb.andWhere).toHaveBeenCalledWith('u.id NOT IN (:...excluded)', {
        excluded: ['blocked-1'],
      });
    });

    it('caps suggestion limit at 20', async () => {
      videoRepository.createQueryBuilder.mockImplementation(() => suggestionQb);
      userQb.getMany.mockResolvedValue([]);
      await service.suggestions('forge', 50);
      expect(suggestionQb.take).toHaveBeenCalledWith(20);
    });
  });
});
