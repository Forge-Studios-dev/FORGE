import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunityPostsService } from './community-posts.service';
import { CommunityStorageService } from './community-storage.service';
import { CommunityPost, CommunityPostType } from './entities/community-post.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPostReaction } from './entities/community-post-reaction.entity';
import { Community } from './entities/community.entity';
import { CommunitiesService } from './communities.service';
import { CommunityModerationService } from './community-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';

describe('CommunityPostsService', () => {
  let service: CommunityPostsService;
  let commentRepository: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let moderationService: { isBanned: jest.Mock };
  let aiCommunityService: { scoreContent: jest.Mock };
  let moderationQueueService: {
    enqueueFlaggedMessage: jest.Mock;
    maybeQueueLlmTail: jest.Mock;
  };
  let postRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let communityRepository: { findOne: jest.Mock; find: jest.Mock };
  let communitiesService: {
    assertCommunityAccess: jest.Mock;
    assertCommunityStudioAccess: jest.Mock;
    listActiveMemberCommunityIds: jest.Mock;
  };

  beforeEach(async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    postRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      save: jest.fn().mockImplementation((x) => Promise.resolve({ ...x, id: 'post-1', createdAt: new Date() })),
      create: jest.fn((x) => x),
      findOne: jest.fn().mockResolvedValue({
        id: 'post-1',
        communityId: 'comm-1',
        title: 'T',
        body: 'Body',
        postType: CommunityPostType.POST,
        isPinned: false,
        updatedAt: new Date(),
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    communityRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
      find: jest.fn().mockResolvedValue([]),
    };
    communitiesService = {
      assertCommunityAccess: jest.fn().mockResolvedValue(undefined),
      assertCommunityStudioAccess: jest
        .fn()
        .mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
      listActiveMemberCommunityIds: jest.fn().mockResolvedValue([]),
    };
    commentRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation((x) => Promise.resolve({ ...x, id: 'cmt-1', createdAt: new Date() })),
      create: jest.fn((x) => x),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };
    moderationService = { isBanned: jest.fn().mockResolvedValue(false) };
    aiCommunityService = {
      scoreContent: jest
        .fn()
        .mockReturnValue({ flagged: false, score: 0, reasons: [], model: 'regex' }),
    };
    moderationQueueService = {
      enqueueFlaggedMessage: jest.fn().mockResolvedValue(undefined),
      maybeQueueLlmTail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPostsService,
        { provide: getRepositoryToken(CommunityPost), useValue: postRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        {
          provide: getRepositoryToken(CommunityPostComment),
          useValue: commentRepository,
        },
        {
          provide: getRepositoryToken(CommunityPostReaction),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((x) => x),
            delete: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: AiCommunityService, useValue: aiCommunityService },
        { provide: CommunityModerationQueueService, useValue: moderationQueueService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: CommunityStorageService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(true),
            getPostMediaUploadUrl: jest.fn().mockResolvedValue({
              uploadUrl: 'https://s3/upload',
              publicUrl: 'https://cdn/img.jpg',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(CommunityPostsService);
  });

  it('creates post for owned community', async () => {
    const result = await service.createPost('creator-1', 'comm-1', 'creator-1', {
      body: 'Hello',
    });
    expect(result.id).toBe('post-1');
    expect(postRepository.save).toHaveBeenCalled();
  });

  it('rejects post for unowned community', async () => {
    communitiesService.assertCommunityStudioAccess.mockRejectedValue(
      new ForbiddenException('Insufficient permissions for community studio'),
    );
    await expect(
      service.createPost('creator-1', 'comm-1', 'creator-1', { body: 'x' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updates post', async () => {
    const result = await service.updatePost('creator-1', 'comm-1', 'post-1', { isPinned: true });
    expect(result.isPinned).toBe(true);
  });

  it('deletes post', async () => {
    const result = await service.deletePost('creator-1', 'comm-1', 'post-1');
    expect(result.deleted).toBe(true);
  });

  it('returns presigned upload URL for owned community', async () => {
    const result = await service.getMediaUploadUrl('creator-1', 'comm-1', 'image/jpeg');
    expect(result.uploadUrl).toBe('https://s3/upload');
    expect(result.publicUrl).toBe('https://cdn/img.jpg');
  });

  it('creates a comment after moderation passes and schedules the LLM tail', async () => {
    const result = await service.createComment('comm-1', 'post-1', 'member-1', {
      body: 'great post!',
    });
    expect(result.id).toBe('cmt-1');
    expect(moderationService.isBanned).toHaveBeenCalledWith('comm-1', 'member-1');
    expect(aiCommunityService.scoreContent).toHaveBeenCalledWith('great post!');
    expect(commentRepository.save).toHaveBeenCalled();
    expect(moderationQueueService.maybeQueueLlmTail).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'post_comment',
        surfaceId: 'post-1',
        userId: 'member-1',
        messageId: 'cmt-1',
      }),
    );
  });

  it('blocks banned members from commenting', async () => {
    moderationService.isBanned.mockResolvedValue(true);
    await expect(
      service.createComment('comm-1', 'post-1', 'member-1', { body: 'hi' }),
    ).rejects.toThrow(ForbiddenException);
    expect(commentRepository.save).not.toHaveBeenCalled();
  });

  it('returns an empty updates feed when the viewer has no active memberships', async () => {
    communitiesService.listActiveMemberCommunityIds.mockResolvedValue([]);
    const result = await service.getMemberUpdatesFeed('viewer-1');
    expect(result).toEqual({ data: [], meta: { cursor: null, hasMore: false } });
    expect(postRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('aggregates announcement posts across joined communities with community metadata', async () => {
    communitiesService.listActiveMemberCommunityIds.mockResolvedValue(['comm-1', 'comm-2']);
    const now = new Date();
    const qb = postRepository.createQueryBuilder();
    qb.getMany.mockResolvedValue([
      {
        id: 'post-a',
        communityId: 'comm-1',
        authorId: 'creator-1',
        author: { displayName: 'Creator One', username: 'c1' },
        title: 'Big news',
        body: 'We shipped',
        postType: CommunityPostType.ANNOUNCEMENT,
        mediaUrls: [],
        createdAt: now,
      },
    ]);
    communityRepository.find.mockResolvedValue([
      { id: 'comm-1', name: 'Comm One', slug: 'comm-one', creatorId: 'creator-1' },
    ]);

    const result = await service.getMemberUpdatesFeed('viewer-1', 20);

    expect(communitiesService.listActiveMemberCommunityIds).toHaveBeenCalledWith('viewer-1');
    expect(qb.andWhere).toHaveBeenCalledWith('p.post_type = :type', {
      type: CommunityPostType.ANNOUNCEMENT,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].community).toEqual({
      id: 'comm-1',
      name: 'Comm One',
      slug: 'comm-one',
      creatorId: 'creator-1',
    });
    expect(result.meta.hasMore).toBe(false);
  });

  it('blocks spam comments via the sync fast path and enqueues a fast_path flag', async () => {
    aiCommunityService.scoreContent.mockReturnValue({
      flagged: true,
      score: 0.9,
      reasons: ['pattern_match'],
      model: 'regex',
    });
    await expect(
      service.createComment('comm-1', 'post-1', 'member-1', {
        body: 'buy now click here free money',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(commentRepository.save).not.toHaveBeenCalled();
    expect(moderationQueueService.enqueueFlaggedMessage).toHaveBeenCalledWith(
      expect.objectContaining({ detectedBy: 'fast_path', surface: 'post_comment', channelId: 'post-1' }),
    );
  });
});
