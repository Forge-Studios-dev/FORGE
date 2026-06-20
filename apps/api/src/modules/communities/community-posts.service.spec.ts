import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunityPostsService } from './community-posts.service';
import { CommunityPost, CommunityPostType } from './entities/community-post.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPostReaction } from './entities/community-post-reaction.entity';
import { Community } from './entities/community.entity';
import { CommunitiesService } from './communities.service';

describe('CommunityPostsService', () => {
  let service: CommunityPostsService;
  let postRepository: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let communityRepository: { findOne: jest.Mock };
  let communitiesService: { assertCommunityAccess: jest.Mock };

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
    };
    communitiesService = {
      assertCommunityAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPostsService,
        { provide: getRepositoryToken(CommunityPost), useValue: postRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        {
          provide: getRepositoryToken(CommunityPostComment),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(),
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
          },
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
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'other' });
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
});
