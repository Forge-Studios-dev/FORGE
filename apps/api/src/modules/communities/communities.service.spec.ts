import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
  let entitlementsService: { checkChannelAccess: jest.Mock };

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

  beforeEach(async () => {
    entitlementsService = { checkChannelAccess: jest.fn() };

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
      ],
    }).compile();

    service = module.get(CommunitiesService);
    jest.clearAllMocks();
  });

  it('seeds default channels when community is created', async () => {
    communityRepository.findOne.mockResolvedValue(null);
    communityRepository.save.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' });
    channelRepository.save.mockImplementation(async (x) => x);

    await service.ensureCommunity('creator-1');

    expect(channelRepository.save).toHaveBeenCalledTimes(4);
    expect(channelRepository.save).toHaveBeenCalledWith(
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
    entitlementsService.checkChannelAccess
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, reason: 'subscription_required' });

    const result = await service.getCommunityByCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]?.slug).toBe('general');
  });
});
