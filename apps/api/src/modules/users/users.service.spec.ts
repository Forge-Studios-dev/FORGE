import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { User, UserRole, CreatorStatus } from './entities/user.entity';
import { Video, VideoVisibility } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { VideosService } from '../content/videos.service';

describe('UsersService', () => {
  const userRepo = {
    findOne: jest.fn(),
    save: jest.fn((u) => Promise.resolve(u)),
  };

  // Records every andWhere clause so we can assert visibility enforcement.
  let qbCalls: Array<{ method: string; args: unknown[] }>;
  const videoRepo = {
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
      qb.take = chain('take');
      qb.getMany = jest.fn(async () => []);
      return qb;
    }),
  };

  const setup = async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Video), useValue: videoRepo },
        { provide: getRepositoryToken(WatchHistory), useValue: {} },
        {
          provide: VideosService,
          useValue: {
            listStudioVideos: jest.fn(),
            releaseAllStuckUploads: jest.fn(),
            mapToPublicVideo: jest.fn((v) => v),
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
    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { username: 'john_doe' } });
  });
});
