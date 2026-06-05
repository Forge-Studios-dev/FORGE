import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunitiesService } from './communities.service';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { UserRole } from '../users/entities/user.entity';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let entitlementsService: { checkChannelAccess: jest.Mock; checkChannelAccessMany: jest.Mock };

  const communityRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };

  const channelRepository = {
    find: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
  };

  const memberRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };

  const messageRepository = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => {
      const save = jest.fn(async (x) => {
        if (x?.name === 'Community') {
          return { id: 'comm-1', creatorId: 'creator-1', ...x };
        }
        return x;
      });
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        save,
        create: jest.fn((_entity, x) => x),
      };
      const result = await work(manager);
      (dataSource as { lastSave?: jest.Mock }).lastSave = save;
      return result;
    }),
  } as { transaction: jest.Mock; lastSave?: jest.Mock };

  beforeEach(async () => {
    entitlementsService = {
      checkChannelAccess: jest.fn(),
      checkChannelAccessMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(Channel), useValue: channelRepository },
        { provide: getRepositoryToken(ChannelMember), useValue: memberRepository },
        { provide: getRepositoryToken(ChannelMessage), useValue: messageRepository },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(CommunitiesService);
    jest.clearAllMocks();
  });

  it('seeds default channels when community is created', async () => {
    communityRepository.findOne.mockResolvedValue(null);

    await service.ensureCommunity('creator-1');

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(dataSource.lastSave).toHaveBeenCalledTimes(5);
    expect(dataSource.lastSave).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'premium-content', type: ChannelType.SUBSCRIBERS }),
    );
  });

  it('filters channels by entitlements for viewer', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1', name: 'Community' });
    channelRepository.find.mockResolvedValue([
      { id: 'ch-1', communityId: 'comm-1', name: 'General', slug: 'general', type: ChannelType.PUBLIC, sortOrder: 0 },
      {
        id: 'ch-2',
        communityId: 'comm-1',
        name: 'Premium',
        slug: 'premium',
        type: ChannelType.SUBSCRIBERS,
        sortOrder: 1,
        requiredTierId: null,
      },
    ]);
    entitlementsService.checkChannelAccessMany.mockResolvedValue([
      { allowed: true },
      { allowed: false, reason: 'subscription_required' },
    ]);

    const result = await service.getCommunityByCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]?.slug).toBe('general');
    expect(entitlementsService.checkChannelAccessMany).toHaveBeenCalledTimes(1);
    expect(memberRepository.findOne).not.toHaveBeenCalled();
  });

  it('batch-loads invite memberships with one query', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1', name: 'Community' });
    channelRepository.find.mockResolvedValue([
      {
        id: 'ch-invite',
        communityId: 'comm-1',
        name: 'VIP',
        slug: 'vip',
        type: ChannelType.INVITE,
        sortOrder: 0,
        requiredTierId: null,
      },
      {
        id: 'ch-pub',
        communityId: 'comm-1',
        name: 'General',
        slug: 'general',
        type: ChannelType.PUBLIC,
        sortOrder: 1,
        requiredTierId: null,
      },
    ]);
    memberRepository.find.mockResolvedValue([{ channelId: 'ch-invite' }]);
    entitlementsService.checkChannelAccessMany.mockResolvedValue([
      { allowed: true },
      { allowed: true },
    ]);

    await service.getCommunityByCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(memberRepository.find).toHaveBeenCalledTimes(1);
    expect(memberRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'viewer-1', channelId: expect.anything() },
      }),
    );
  });
});
