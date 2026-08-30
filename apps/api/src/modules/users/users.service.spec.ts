import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { User, UserRole, CreatorStatus } from './entities/user.entity';
import { Video, VideoVisibility } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { CommunityPost } from '../communities/entities/community-post.entity';
import { AccountStrike } from '../account-strikes/entities/account-strike.entity';
import { UsernameHistory } from './entities/username-history.entity';
import { VideosService } from '../content/videos.service';
import { EngagementService } from '../engagement/engagement.service';

describe('UsersService', () => {
  const userRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn((u) => Promise.resolve(u)),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const historyRepo = {
    createQueryBuilder: jest.fn(() => ({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })) as jest.Mock,
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };

  // Records every andWhere clause so we can assert visibility enforcement.
  let qbCalls: Array<{ method: string; args: unknown[] }>;
  const videoRepo = {
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      const chain = (method: string) =>
        jest.fn((...args: unknown[]) => {
          qbCalls.push({ method, args });
          return qb;
        });
      qb.leftJoinAndSelect = chain('leftJoinAndSelect');
      qb.where = chain('where');
      qb.andWhere = chain('andWhere');
      qb.orderBy = chain('orderBy');
      qb.addOrderBy = chain('addOrderBy');
      qb.take = chain('take');
      qb.getMany = jest.fn(async () => []);
      return qb;
    }),
  };

  const commentRepo = { find: jest.fn().mockResolvedValue([]) };
  const communityPostRepo = { find: jest.fn().mockResolvedValue([]) };
  const strikeRepo = { find: jest.fn().mockResolvedValue([]) };

  const setup = async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UsernameHistory), useValue: historyRepo },
        { provide: getRepositoryToken(Video), useValue: videoRepo },
        { provide: getRepositoryToken(WatchHistory), useValue: {} },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(CommunityPost), useValue: communityPostRepo },
        { provide: getRepositoryToken(AccountStrike), useValue: strikeRepo },
        {
          provide: VideosService,
          useValue: {
            listStudioVideos: jest.fn(),
            releaseAllStuckUploads: jest.fn(),
            mapToPublicVideo: jest.fn((v) => v),
          },
        },
        {
          provide: EngagementService,
          useValue: {
            getBlockedPeerIds: jest.fn().mockResolvedValue([]),
            isBlockedEitherWay: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'aws.region') return 'us-east-1';
              if (key === 'aws.s3BucketName') return 'test-bucket';
              return '';
            }),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), setex: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();
    return module.get(UsersService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qbCalls = [];
  });

  it('getUserVideos hides UNLISTED (and non-public) videos from non-owners', async () => {
    const svc = await setup();
    await svc.getUserVideos('creator-1', 20, undefined, 'viewer-2');

    const visClause = qbCalls.find(
      (c) => c.method === 'andWhere' && c.args[0] === 'v.visibility = :vis',
    );
    expect(visClause).toBeDefined();
    expect(visClause?.args[1]).toEqual({ vis: VideoVisibility.PUBLIC });

    // never widens to include unlisted on a public profile surface
    const widened = qbCalls.find((c) => c.args[0] === 'v.visibility IN (:...vis)');
    expect(widened).toBeUndefined();
  });

  it('getUserVideos does not apply visibility filter for the owner (sees own catalog)', async () => {
    const svc = await setup();
    await svc.getUserVideos('creator-1', 20, undefined, 'creator-1');

    const visClause = qbCalls.find((c) => c.args[0] === 'v.visibility = :vis');
    expect(visClause).toBeUndefined();
  });

  it('getUserVideos filters by videoType when type=short', async () => {
    const svc = await setup();
    await svc.getUserVideos('creator-1', 20, undefined, 'viewer-2', 'short');

    const typeClause = qbCalls.find(
      (c) => c.method === 'andWhere' && c.args[0] === 'v.video_type = :vtype',
    );
    expect(typeClause).toBeDefined();
    expect(typeClause?.args[1]).toEqual({ vtype: 'short' });
  });

  it('getUserVideos sorts by popular views', async () => {
    const svc = await setup();
    await svc.getUserVideos('creator-1', 20, undefined, 'viewer-2', 'all', 'popular');
    const order = qbCalls.find((c) => c.method === 'orderBy');
    expect(order?.args[0]).toBe('v.view_count');
    expect(order?.args[1]).toBe('DESC');
  });

  it('update sets website and channel links', async () => {
    const user = {
      id: 'u1',
      username: 'alice',
      usernameChangedAt: null,
      displayName: 'A',
      bio: null,
      websiteUrl: null,
      channelLinks: null,
    } as unknown as User;
    userRepo.findOne.mockResolvedValue(user);
    userRepo.save.mockImplementation((u) => Promise.resolve(u));

    const svc = await setup();
    const result = await svc.update('u1', 'u1', {
      websiteUrl: 'https://forge.example',
      channelLinks: [{ title: 'Discord', url: 'https://discord.gg/forge' }],
    });

    expect(result.websiteUrl).toBe('https://forge.example');
    expect(result.channelLinks).toEqual([
      { title: 'Discord', url: 'https://discord.gg/forge' },
    ]);
  });

  it('update renames username when available', async () => {
    const user = {
      id: 'u1',
      username: 'alice',
      usernameChangedAt: null,
      displayName: 'A',
      bio: null,
      websiteUrl: null,
      channelLinks: null,
    } as unknown as User;
    userRepo.findOne.mockResolvedValue(user);
    const takenQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    userRepo.createQueryBuilder.mockReturnValue(takenQb);
    const histQb = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    historyRepo.createQueryBuilder.mockReturnValue(histQb);
    userRepo.save.mockImplementation((u) => Promise.resolve(u));

    const svc = await setup();
    const result = await svc.update('u1', 'u1', { username: 'alice_new' });

    expect(result.username).toBe('alice_new');
    expect(result.usernameChangedAt).toBeInstanceOf(Date);
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', username: 'alice' }),
    );
  });

  it('findByUsername resolves former handles via username_history', async () => {
    userRepo.findOne.mockResolvedValue(null);
    const current = { id: 'u1', username: 'alice_new' } as User;
    historyRepo.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ user: current }),
    });
    const svc = await setup();
    await expect(svc.findByUsername('alice')).resolves.toBe(current);
  });

  it('update rejects reserved username', async () => {
    const user = {
      id: 'u1',
      username: 'alice',
      usernameChangedAt: null,
    } as unknown as User;
    userRepo.findOne.mockResolvedValue(user);

    const svc = await setup();
    await expect(svc.update('u1', 'u1', { username: 'studio' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update rejects username change during cooldown', async () => {
    const user = {
      id: 'u1',
      username: 'alice',
      usernameChangedAt: new Date(),
    } as unknown as User;
    userRepo.findOne.mockResolvedValue(user);

    const svc = await setup();
    await expect(svc.update('u1', 'u1', { username: 'alice2' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requestCreator requires verified email', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: UserRole.USER,
      isVerified: false,
      creatorStatus: null,
    } as User);

    const svc = await setup();
    await expect(svc.requestCreator('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requestCreator sets pending status for verified user', async () => {
    const user = {
      id: 'u1',
      role: UserRole.USER,
      isVerified: true,
      creatorStatus: null,
      creatorRequestedAt: null,
      creatorReviewedAt: null,
      creatorReviewNote: null,
    } as User;
    userRepo.findOne.mockResolvedValue(user);

    const svc = await setup();
    const result = await svc.requestCreator('u1');

    expect(result.role).toBe(UserRole.CREATOR);
    expect(result.creatorStatus).toBe(CreatorStatus.PENDING);
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('findByUsername rejects invalid usernames without a DB lookup', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const svc = await setup();
    await expect(svc.findByUsername('favicon.ico')).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('findByUsername looks up valid usernames', async () => {
    const user = { id: 'u1', username: 'john_doe' } as User;
    userRepo.findOne.mockResolvedValue(user);
    const svc = await setup();
    await expect(svc.findByUsername('john_doe')).resolves.toBe(user);
    expect(userRepo.findOne).toHaveBeenCalled();
  });

  it('getAvatarUploadUrl does not persist avatarUrl before finalize', async () => {
    const svc = await setup();

    const result = await svc.getAvatarUploadUrl(
      'u1',
      { contentType: 'image/png', fileSizeBytes: 1024 },
      'u1',
    );

    expect(result.uploadUrl).toContain('X-Amz-');
    expect(result.publicUrl).toContain('/avatars/u1/');
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('getAvatarUploadUrl rejects oversized avatar uploads', async () => {
    const svc = await setup();

    await expect(
      svc.getAvatarUploadUrl(
        'u1',
        { contentType: 'image/png', fileSizeBytes: 6 * 1024 * 1024 },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completeBannerUpload persists bannerUrl only after successful upload', async () => {
    const svc = await setup();

    const result = await svc.completeBannerUpload('u1', 'banners/u1/test.webp', 'u1');

    expect(userRepo.update).toHaveBeenCalledWith('u1', {
      bannerUrl: 'https://test-bucket.s3.amazonaws.com/banners/u1/test.webp',
    });
    expect(result.publicUrl).toBe('https://test-bucket.s3.amazonaws.com/banners/u1/test.webp');
  });

  it('getNotificationPreferences defaults to no muted categories, no digest', async () => {
    const svc = await setup();
    userRepo.findOne.mockResolvedValue({ id: 'u1', notificationPreferences: null });

    const prefs = await svc.getNotificationPreferences('u1');

    expect(prefs).toEqual({ mutedCategories: [], emailDigest: false });
  });

  it('getNotificationPreferences returns the stored value when set', async () => {
    const svc = await setup();
    userRepo.findOne.mockResolvedValue({
      id: 'u1',
      notificationPreferences: { mutedCategories: ['live'], emailDigest: true },
    });

    const prefs = await svc.getNotificationPreferences('u1');

    expect(prefs).toEqual({ mutedCategories: ['live'], emailDigest: true });
  });

  it('setNotificationPreferences saves and dedupes muted categories', async () => {
    const svc = await setup();
    userRepo.findOne.mockResolvedValue({ id: 'u1', notificationPreferences: null });

    const result = await svc.setNotificationPreferences('u1', {
      mutedCategories: ['live', 'live', 'social'],
      emailDigest: true,
    });

    expect(result).toEqual({ mutedCategories: ['live', 'social'], emailDigest: true });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationPreferences: { mutedCategories: ['live', 'social'], emailDigest: true },
      }),
    );
  });

  it('searchUsersForPicker excludes deleted/deactivated users from both match branches', async () => {
    const svc = await setup();
    await svc.searchUsersForPicker('alice');

    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          expect.objectContaining({ isActive: true, deletedAt: expect.anything() }),
          expect.objectContaining({ isActive: true, deletedAt: expect.anything() }),
        ],
      }),
    );
  });

  it('exportAuthoredComments redacts soft-deleted bodies', async () => {
    const svc = await setup();
    commentRepo.find.mockResolvedValueOnce([
      {
        id: 'c1',
        videoId: 'v1',
        parentId: null,
        content: 'visible',
        moderationStatus: 'none',
        likeCount: 1,
        dislikeCount: 0,
        createdAt: new Date('2026-01-01'),
        deletedAt: null,
      },
      {
        id: 'c2',
        videoId: 'v1',
        parentId: null,
        content: 'secret',
        moderationStatus: 'none',
        likeCount: 0,
        dislikeCount: 0,
        createdAt: new Date('2026-01-02'),
        deletedAt: new Date('2026-01-03'),
      },
    ]);

    const rows = await svc.exportAuthoredComments('u1');
    expect(rows[0].content).toBe('visible');
    expect(rows[1].content).toBe('[deleted]');
    expect(commentRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, take: 2000 }),
    );
  });

  it('exportAuthoredCommunityPosts maps author posts', async () => {
    const svc = await setup();
    communityPostRepo.find.mockResolvedValueOnce([
      {
        id: 'p1',
        communityId: 'comm-1',
        title: 'Hello',
        body: 'World',
        postType: 'post',
        isPinned: false,
        mediaUrls: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    const rows = await svc.exportAuthoredCommunityPosts('u1');
    expect(rows).toEqual([
      expect.objectContaining({ id: 'p1', communityId: 'comm-1', title: 'Hello', body: 'World' }),
    ]);
    expect(communityPostRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: 'u1' }, take: 2000 }),
    );
  });

  it('exportAccountStrikes maps strike fields', async () => {
    const svc = await setup();
    strikeRepo.find.mockResolvedValueOnce([
      {
        id: 's1',
        type: 'copyright',
        reason: 'DMCA',
        consequence: 'warning',
        status: 'active',
        appealStatus: 'none',
        appealReason: null,
        sourceVideoId: 'v1',
        sourceReportId: 'n1',
        createdAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-04-01'),
        resolvedAt: null,
      },
    ]);

    const rows = await svc.exportAccountStrikes('u1');
    expect(rows).toEqual([
      expect.objectContaining({
        id: 's1',
        type: 'copyright',
        sourceReportId: 'n1',
        status: 'active',
      }),
    ]);
    expect(strikeRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, take: 2000 }),
    );
  });
});
