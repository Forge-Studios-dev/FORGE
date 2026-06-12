import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EngagementService } from './engagement.service';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Follow } from './entities/follow.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';

describe('EngagementService', () => {
  let service: EngagementService;

  const mockRepo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
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
        { provide: getRepositoryToken(Video), useValue: mockRepo() },
        { provide: getRepositoryToken(User), useValue: mockRepo() },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(EngagementService);
  });

  it('returns paginated comments with empty data', async () => {
    const result = await service.getComments('video-1', 20, undefined, 'viewer-1');
    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.total).toBe(0);
  });
});
