import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { User, UserRole, CreatorStatus } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';

describe('UsersService', () => {
  const userRepo = {
    findOne: jest.fn(),
    save: jest.fn((u) => Promise.resolve(u)),
  };

  const setup = async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Video), useValue: {} },
        { provide: getRepositoryToken(WatchHistory), useValue: {} },
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
      ],
    }).compile();
    return module.get(UsersService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
});
