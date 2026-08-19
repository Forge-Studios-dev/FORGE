import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngagementService } from './engagement.service';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Follow } from './entities/follow.entity';
import { UserBlock } from './entities/user-block.entity';
import { Share, ShareChannel } from './entities/share.entity';
import { Video } from '../content/entities/video.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AiModerationService } from '../communities/ai-moderation.service';

describe('EngagementService', () => {
  let service: EngagementService;

  const mockRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    })),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngagementService,
        { provide: getRepositoryToken(Comment), useValue: mockRepo() },
        { provide: getRepositoryToken(CommentLike), useValue: mockRepo() },
        { provide: getRepositoryToken(Like), useValue: mockRepo() },
        { provide: getRepositoryToken(Follow), useValue: mockRepo() },
        { provide: getRepositoryToken(UserBlock), useValue: mockRepo() },
        { provide: getRepositoryToken(Share), useValue: mockRepo() },
        { provide: getRepositoryToken(Video), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn() },
        },
        AiModerationService,
      ],
    }).compile();

    service = module.get(EngagementService);
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
  });

  it('returns paginated comments with empty data', async () => {
    const result = await service.getComments('video-1', 20, undefined, 'viewer-1');
    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.total).toBe(0);
    expect(result.meta.sort).toBe('newest');
  });

  it('includes a deleted top-level comment as a masked tombstone when it still has live replies', async () => {
    const commentRepo = (service as any).commentRepository;
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'deleted-1',
          videoId: 'video-1',
          userId: 'ghost',
          user: { id: 'ghost', username: 'ghost' },
          content: 'the real deleted text',
          parentId: null,
          likeCount: 99,
          isPinned: true,
          creatorHearted: true,
          createdAt: new Date('2026-01-01'),
          deletedAt: new Date('2026-01-02'),
        },
      ]),
      getCount: jest.fn().mockResolvedValue(1),
    };
    commentRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getComments('video-1', 20);

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('EXISTS'));
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'deleted-1',
      content: '[deleted]',
      user: null,
      userId: null,
      isDeleted: true,
      likeCount: 0,
      isPinned: false,
    });
  });

  it('rejects comments when viewer is blocked from the video owner', async () => {
    const blockRepo = (service as any).userBlockRepository;
    blockRepo.findOne.mockResolvedValue({ blockerId: 'viewer-1', blockedId: 'owner' });
    await expect(
      service.getComments('video-1', 20, undefined, 'viewer-1'),
    ).rejects.toThrow('This video is not available');
  });

  it('creates a comment when content passes moderation', async () => {
    const redis = (service as any).redis;
    redis.set = jest.fn().mockResolvedValue('OK');
    const blockRepo = (service as any).userBlockRepository;
    blockRepo.findOne.mockResolvedValue(null);
    const commentRepo = (service as any).commentRepository;
    commentRepo.create.mockImplementation((row: unknown) => row);
    commentRepo.save.mockResolvedValue({ id: 'c1' });
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      userId: 'viewer-1',
      videoId: 'video-1',
      content: 'nice video!',
      user: { id: 'viewer-1' },
    });
    const videoRepo = (service as any).videoRepository;

    const result = await service.createComment('viewer-1', 'video-1', {
      content: 'nice video!',
    } as any);
    expect(result).toMatchObject({ id: 'c1' });
    expect(videoRepo.increment).toHaveBeenCalledWith({ id: 'video-1' }, 'commentCount', 1);
  });

  it('holds (does not reject) a comment flagged as spam, for owner review', async () => {
    const redis = (service as any).redis;
    redis.set = jest.fn().mockResolvedValue('OK');
    const blockRepo = (service as any).userBlockRepository;
    blockRepo.findOne.mockResolvedValue(null);
    const commentRepo = (service as any).commentRepository;
    commentRepo.create.mockImplementation((row: unknown) => row);
    commentRepo.save.mockResolvedValue({ id: 'c1' });
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      userId: 'viewer-1',
      videoId: 'video-1',
      content: 'buy now buy now buy now click here free money',
      moderationStatus: 'held',
      user: { id: 'viewer-1' },
    });
    const eventEmitter = (service as any).eventEmitter;

    const result = await service.createComment('viewer-1', 'video-1', {
      content: 'buy now buy now buy now click here free money',
    } as any);

    expect(commentRepo.save).toHaveBeenCalled();
    expect(commentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: 'held' }),
    );
    expect(result.moderationStatus).toBe('held');
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('comment.created', expect.anything());
  });

  it('excludes held/blocked comments from a non-owner viewer', async () => {
    const commentRepo = (service as any).commentRepository;
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    commentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getComments('video-1', 20, undefined, 'viewer-1');
    expect(qb.andWhere).toHaveBeenCalledWith('c.moderationStatus = :none', { none: 'none' });
  });

  it('does not filter held/blocked comments for the video owner', async () => {
    const commentRepo = (service as any).commentRepository;
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    commentRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getComments('video-1', 20, undefined, 'owner');
    expect(qb.andWhere).not.toHaveBeenCalledWith('c.moderationStatus = :none', { none: 'none' });
  });

  it('approveComment clears the hold for the video owner', async () => {
    const commentRepo = (service as any).commentRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'viewer-1',
      moderationStatus: 'held',
      user: { id: 'viewer-1' },
    });
    commentRepo.save.mockImplementation((row: unknown) => row);

    const result = await service.approveComment('owner', 'v1', 'c1');
    expect(commentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: 'none' }),
    );
    expect(result.moderationStatus).toBe('none');
  });

  it('approveComment rejects a non-owner', async () => {
    await expect(service.approveComment('not-owner', 'v1', 'c1')).rejects.toThrow(
      'Only the video owner can manage this',
    );
  });

  it('orders top comments by pin then likeCount', async () => {
    const commentRepo = (service as any).commentRepository;
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    commentRepo.createQueryBuilder.mockReturnValue(qb);
    await service.getComments('video-1', 20, undefined, undefined, 'top');
    expect(qb.orderBy).toHaveBeenCalledWith('c.isPinned', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('c.likeCount', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('c.createdAt', 'DESC');
  });

  it('orders oldest comments by createdAt ascending', async () => {
    const commentRepo = (service as any).commentRepository;
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    commentRepo.createQueryBuilder.mockReturnValue(qb);
    const result = await service.getComments('video-1', 20, undefined, undefined, 'oldest');
    expect(qb.addOrderBy).toHaveBeenCalledWith('c.createdAt', 'ASC');
    expect(result.meta.sort).toBe('oldest');
  });

  it('pins a top-level comment as video owner', async () => {
    const commentRepo = (service as any).commentRepository;
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      parentId: null,
      isPinned: false,
      creatorHearted: false,
      likeCount: 0,
      userId: 'u1',
      content: 'hi',
      createdAt: new Date(),
      user: {
        id: 'u1',
        email: 'a@b.c',
        username: 'u1',
        displayName: 'U',
        role: 'user',
        isVerified: true,
        creatorStatus: null,
        followerCount: 0,
        followingCount: 0,
        videoCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    commentRepo.update.mockResolvedValue({ affected: 0 });
    commentRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.setCommentPinned('owner', 'v1', 'c1', true);
    expect(result.isPinned).toBe(true);
    expect(commentRepo.update).toHaveBeenCalled();
  });

  it('forbids pinning when not the video owner', async () => {
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    await expect(service.setCommentPinned('other', 'v1', 'c1', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets the video owner remove someone else’s comment', async () => {
    const commentRepo = (service as any).commentRepository;
    const videoRepo = (service as any).videoRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'viewer',
      content: 'spam',
      deletedAt: null,
    });
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    commentRepo.save.mockImplementation(async (row: unknown) => row);
    videoRepo.decrement.mockResolvedValue({ affected: 1 });

    const result = await service.deleteComment('owner', UserRole.USER, 'v1', 'c1');
    expect(result).toEqual({ deleted: true });
    expect(commentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ content: '[deleted]', deletedAt: expect.any(Date) }),
    );
    expect(videoRepo.decrement).toHaveBeenCalledWith({ id: 'v1' }, 'commentCount', 1);
  });

  it('forbids deleting someone else’s comment when not the video owner', async () => {
    const commentRepo = (service as any).commentRepository;
    const videoRepo = (service as any).videoRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'viewer',
      content: 'hi',
      deletedAt: null,
    });
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });

    await expect(service.deleteComment('stranger', UserRole.USER, 'v1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('likes a video and clears a prior dislike', async () => {
    const likeRepo = (service as any).likeRepository;
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    likeRepo.findOne.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      videoId: 'v1',
      reaction: 'dislike',
    });
    likeRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.likeVideo('u1', 'v1');
    expect(result).toEqual({ liked: true, disliked: false });
    expect(videoRepo.decrement).toHaveBeenCalledWith({ id: 'v1' }, 'dislikeCount', 1);
    expect(videoRepo.increment).toHaveBeenCalledWith({ id: 'v1' }, 'likeCount', 1);
  });

  it('dislikes a video and clears a prior like', async () => {
    const likeRepo = (service as any).likeRepository;
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    likeRepo.findOne.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      videoId: 'v1',
      reaction: 'like',
    });
    likeRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.dislikeVideo('u1', 'v1');
    expect(result).toEqual({ liked: false, disliked: true });
    expect(videoRepo.decrement).toHaveBeenCalledWith({ id: 'v1' }, 'likeCount', 1);
    expect(videoRepo.increment).toHaveBeenCalledWith({ id: 'v1' }, 'dislikeCount', 1);
  });

  it('dislikes a comment and clears a prior like', async () => {
    const commentRepo = (service as any).commentRepository;
    const commentLikeRepo = (service as any).commentLikeRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'commenter',
      deletedAt: null,
    });
    commentLikeRepo.findOne.mockResolvedValue({
      id: 'cl1',
      userId: 'u1',
      commentId: 'c1',
      reaction: 'like',
    });
    commentLikeRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.dislikeComment('u1', 'v1', 'c1');
    expect(result).toEqual({ liked: false, disliked: true });
    expect(commentRepo.decrement).toHaveBeenCalledWith({ id: 'c1' }, 'likeCount', 1);
    expect(commentRepo.increment).toHaveBeenCalledWith({ id: 'c1' }, 'dislikeCount', 1);
  });

  it('likes a comment and clears a prior dislike', async () => {
    const commentRepo = (service as any).commentRepository;
    const commentLikeRepo = (service as any).commentLikeRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'commenter',
      deletedAt: null,
    });
    commentLikeRepo.findOne.mockResolvedValue({
      id: 'cl1',
      userId: 'u1',
      commentId: 'c1',
      reaction: 'dislike',
    });
    commentLikeRepo.save.mockImplementation(async (row: unknown) => row);

    const result = await service.likeComment('u1', 'v1', 'c1');
    expect(result).toEqual({ liked: true, disliked: false });
    expect(commentRepo.decrement).toHaveBeenCalledWith({ id: 'c1' }, 'dislikeCount', 1);
    expect(commentRepo.increment).toHaveBeenCalledWith({ id: 'c1' }, 'likeCount', 1);
  });

  it('rejects like when viewer is blocked either way', async () => {
    const videoRepo = (service as any).videoRepository;
    const blockRepo = (service as any).userBlockRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    blockRepo.findOne.mockResolvedValue({ blockerId: 'u1', blockedId: 'owner' });

    await expect(service.likeVideo('u1', 'v1')).rejects.toThrow('This video is not available');
  });

  it('blocks a user and mutes channel recommendations', async () => {
    const blockRepo = (service as any).userBlockRepository;
    const userRepo = (service as any).userRepository;
    const followRepo = (service as any).followRepository;
    const redis = (service as any).redis;
    userRepo.findOne.mockResolvedValue({ id: 'u2', username: 'blocked' });
    blockRepo.findOne.mockResolvedValue(null);
    blockRepo.create.mockImplementation((row: unknown) => row);
    blockRepo.save.mockResolvedValue({});
    followRepo.findOne.mockResolvedValue(null);
    redis.setex = jest.fn().mockResolvedValue('OK');
    redis.get = jest.fn().mockResolvedValue(null);

    const result = await service.blockUser('u1', 'u2');
    expect(result).toEqual({ blocked: true });
    expect(blockRepo.save).toHaveBeenCalled();
  });

  it('reports blocked either way', async () => {
    const blockRepo = (service as any).userBlockRepository;
    blockRepo.findOne.mockResolvedValue({ blockerId: 'u2', blockedId: 'u1' });
    await expect(service.isBlockedEitherWay('u1', 'u2')).resolves.toBe(true);
  });

  describe('getFollowers / getFollowing — channel-level block gate', () => {
    it('getFollowers rejects a viewer blocked either way with the channel owner, before hitting the DB', async () => {
      const blockRepo = (service as any).userBlockRepository;
      const followRepo = (service as any).followRepository;
      blockRepo.findOne.mockResolvedValue({ blockerId: 'owner-1', blockedId: 'viewer-1' });

      await expect(service.getFollowers('owner-1', 20, undefined, 'viewer-1')).rejects.toThrow(
        'This channel is not available',
      );
      expect(followRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('getFollowing rejects a viewer blocked either way with the channel owner, before hitting the DB', async () => {
      const blockRepo = (service as any).userBlockRepository;
      const followRepo = (service as any).followRepository;
      blockRepo.findOne.mockResolvedValue({ blockerId: 'viewer-1', blockedId: 'owner-1' });

      await expect(service.getFollowing('owner-1', 20, undefined, 'viewer-1')).rejects.toThrow(
        'This channel is not available',
      );
      expect(followRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('getFollowers allows an unrelated viewer through to the normal query', async () => {
      const blockRepo = (service as any).userBlockRepository;
      const followRepo = (service as any).followRepository;
      blockRepo.findOne.mockResolvedValue(null);
      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      followRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.getFollowers('owner-1', 20, undefined, 'viewer-1'),
      ).resolves.toEqual({ data: [], meta: { cursor: null, hasMore: false } });
    });
  });

  it('subscribe aliases follow', async () => {
    const followRepo = (service as any).followRepository;
    const userRepo = (service as any).userRepository;
    userRepo.findOne.mockResolvedValue({ id: 'channel' });
    followRepo.findOne.mockResolvedValue(null);
    followRepo.create.mockImplementation((row: unknown) => row);
    followRepo.save.mockResolvedValue({});

    const result = await service.subscribe('viewer', 'channel');
    expect(result).toEqual({ following: true, subscribed: true });
    expect(userRepo.increment).toHaveBeenCalled();
  });

  it('batches viewer video reactions in one find', async () => {
    const likeRepo = (service as any).likeRepository;
    likeRepo.find.mockResolvedValue([
      { videoId: 'v1', reaction: 'like' },
      { videoId: 'v2', reaction: 'dislike' },
    ]);

    const map = await service.getViewerVideoReactions('u1', ['v1', 'v2', 'v3']);
    expect(map.get('v1')).toEqual({ viewerLiked: true, viewerDisliked: false });
    expect(map.get('v2')).toEqual({ viewerLiked: false, viewerDisliked: true });
    expect(map.get('v3')).toEqual({ viewerLiked: false, viewerDisliked: false });
    expect(likeRepo.find).toHaveBeenCalledTimes(1);
  });

  it('batches following set in one find', async () => {
    const followRepo = (service as any).followRepository;
    followRepo.find.mockResolvedValue([{ followingId: 'c1' }, { followingId: 'c3' }]);

    const set = await service.getFollowingSet('u1', ['c1', 'c2', 'c3']);
    expect(set.has('c1')).toBe(true);
    expect(set.has('c2')).toBe(false);
    expect(set.has('c3')).toBe(true);
    expect(followRepo.find).toHaveBeenCalledTimes(1);
  });

  it('getComment returns mapped public comment', async () => {
    const commentRepo = (service as any).commentRepository;
    commentRepo.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      userId: 'u1',
      content: 'hello',
      parentId: null,
      likeCount: 2,
      isPinned: false,
      creatorHearted: false,
      createdAt: new Date('2026-01-01'),
      user: { id: 'u1', username: 'alice', displayName: 'Alice' },
    });
    commentRepo.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ parentId: 'c1', cnt: '3' }]),
    }));

    const result = await service.getComment('v1', 'c1', 'viewer');
    expect(result.id).toBe('c1');
    expect(result.replyCount).toBe(3);
  });

  it('lists disliked videos newest first with public shape', async () => {
    const likeRepo = (service as any).likeRepository;
    const videoRepo = (service as any).videoRepository;
    const dislikedAt = new Date('2026-08-01');
    likeRepo.find.mockResolvedValue([{ id: 'l1', videoId: 'v1', createdAt: dislikedAt }]);
    likeRepo.count.mockResolvedValue(1);
    videoRepo.find.mockResolvedValue([
      {
        id: 'v1',
        userId: 'c1',
        title: 'Nope',
        description: null,
        status: 'ready',
        visibility: 'public',
        hlsUrl: null,
        thumbnailUrl: null,
        captionUrl: null,
        captionTracks: null,
        durationSeconds: 10,
        videoType: 'video',
        viewCount: 1,
        likeCount: 0,
        dislikeCount: 1,
        commentCount: 0,
        skillTags: [],
        categoryId: null,
        createdAt: new Date(),
        publishedAt: new Date(),
        scheduledPublishAt: null,
        requiredTierId: null,
        sourceStreamId: null,
        user: { id: 'c1', username: 'creator', displayName: 'Creator' },
      },
    ]);

    const result = await service.listDislikedVideos('u1', 50);
    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('v1');
    expect(result.data[0].viewerDisliked).toBe(true);
    expect(result.data[0].dislikedAt).toEqual(dislikedAt);
  });

  it('clearDislikedVideos removes reactions and decrements counts', async () => {
    const likeRepo = (service as any).likeRepository;
    const videoRepo = (service as any).videoRepository;
    likeRepo.find.mockResolvedValue([
      { id: 'l1', videoId: 'v1' },
      { id: 'l2', videoId: 'v2' },
    ]);
    likeRepo.remove.mockResolvedValue(undefined);
    videoRepo.decrement.mockResolvedValue(undefined);

    const result = await service.clearDislikedVideos('u1');
    expect(result).toEqual({ ok: true, cleared: 2 });
    expect(likeRepo.remove).toHaveBeenCalledTimes(2);
    expect(videoRepo.decrement).toHaveBeenCalledWith({ id: 'v1' }, 'dislikeCount', 1);
    expect(videoRepo.decrement).toHaveBeenCalledWith({ id: 'v2' }, 'dislikeCount', 1);
  });

  it('recordShare logs the event and increments shareCount for a logged-in sharer', async () => {
    const videoRepo = (service as any).videoRepository;
    const shareRepo = (service as any).shareRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'creator-1', shareCount: 4 });
    shareRepo.create.mockImplementation((x: unknown) => x);
    shareRepo.save.mockResolvedValue(undefined);
    videoRepo.increment.mockResolvedValue(undefined);

    const result = await service.recordShare('v1', 'u1', ShareChannel.NATIVE);

    expect(shareRepo.create).toHaveBeenCalledWith({
      videoId: 'v1',
      userId: 'u1',
      channel: ShareChannel.NATIVE,
    });
    expect(shareRepo.save).toHaveBeenCalled();
    expect(videoRepo.increment).toHaveBeenCalledWith({ id: 'v1' }, 'shareCount', 1);
    expect(result).toEqual({ shareCount: 5 });
  });

  it('recordShare tracks an anonymous (logged-out) sharer', async () => {
    const videoRepo = (service as any).videoRepository;
    const shareRepo = (service as any).shareRepository;
    videoRepo.findOne.mockResolvedValue({ id: 'v1', userId: 'creator-1', shareCount: 0 });
    shareRepo.create.mockImplementation((x: unknown) => x);

    await service.recordShare('v1', null, ShareChannel.COPY_LINK);

    expect(shareRepo.create).toHaveBeenCalledWith({
      videoId: 'v1',
      userId: null,
      channel: ShareChannel.COPY_LINK,
    });
  });

  it('recordShare throws when the video does not exist', async () => {
    const videoRepo = (service as any).videoRepository;
    videoRepo.findOne.mockResolvedValue(null);

    await expect(service.recordShare('missing', 'u1', ShareChannel.OTHER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
