import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunitiesService } from './communities.service';
import { Community, CommunityVisibility } from './entities/community.entity';
import { CommunityCategory } from './entities/community-category.entity';
import { CommunityRole } from './entities/community-role.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { CommunityModerationService } from './community-moderation.service';
import { AiModerationService } from './ai-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { Stream } from '../streaming/entities/stream.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityMember } from './entities/community-member.entity';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { UserRole } from '../users/entities/user.entity';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let entitlementsService: {
    checkChannelAccess: jest.Mock;
    checkChannelAccessMany: jest.Mock;
    getMembershipForViewer: jest.Mock;
    listActiveSubscriptionsForCreator: jest.Mock;
    subscriptionCoversCommunity: jest.Mock;
  };
  let accessSessionsService: { requirePremiumSession: jest.Mock };
  let moderationService: { isBanned: jest.Mock };
  let aiModerationService: { scoreSpam: jest.Mock };
  let aiCommunityService: { scoreContent: jest.Mock };

  const communityRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };

  const categoryRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const roleRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
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

  const communityMemberRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  };

  const roomRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const streamRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const moderationQueueService = {
    enqueueMessageModeration: jest.fn(),
    enqueueFlaggedMessage: jest.fn(),
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
      getMembershipForViewer: jest.fn().mockResolvedValue({ active: false }),
      listActiveSubscriptionsForCreator: jest.fn().mockResolvedValue([]),
      subscriptionCoversCommunity: jest.fn().mockReturnValue(false),
    };
    accessSessionsService = { requirePremiumSession: jest.fn().mockResolvedValue(undefined) };
    moderationService = { isBanned: jest.fn().mockResolvedValue(false) };
    aiModerationService = { scoreSpam: jest.fn().mockReturnValue({ flagged: false, score: 0, reasons: [] }) };
    aiCommunityService = { scoreContent: jest.fn().mockReturnValue({ flagged: false, score: 0, reasons: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(CommunityCategory), useValue: categoryRepository },
        { provide: getRepositoryToken(CommunityRole), useValue: roleRepository },
        { provide: getRepositoryToken(Channel), useValue: channelRepository },
        { provide: getRepositoryToken(ChannelMember), useValue: memberRepository },
        { provide: getRepositoryToken(CommunityMember), useValue: communityMemberRepository },
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: getRepositoryToken(ChannelMessage), useValue: messageRepository },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: AccessSessionsService, useValue: accessSessionsService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: AiModerationService, useValue: aiModerationService },
        { provide: AiCommunityService, useValue: aiCommunityService },
        { provide: CommunityModerationQueueService, useValue: moderationQueueService },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
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

  it('returns all channels with access metadata for viewer', async () => {
    communityRepository.findOne.mockResolvedValue({
      id: 'comm-1',
      creatorId: 'creator-1',
      name: 'Community',
      visibility: CommunityVisibility.PUBLIC,
    });
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

    expect(result.channels).toHaveLength(2);
    expect(result.channels[0]?.slug).toBe('general');
    expect(result.channels[0]?.access?.allowed).toBe(true);
    expect(result.channels[1]?.access).toEqual({
      allowed: false,
      reason: 'subscription_required',
    });
    expect(entitlementsService.checkChannelAccessMany).toHaveBeenCalledTimes(1);
    expect(memberRepository.findOne).not.toHaveBeenCalled();
  });

  it('batch-loads invite memberships with one query', async () => {
    communityRepository.findOne.mockResolvedValue({
      id: 'comm-1',
      creatorId: 'creator-1',
      name: 'Community',
      visibility: CommunityVisibility.PUBLIC,
    });
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

  it('hides private communities from non-members', async () => {
    communityRepository.find.mockResolvedValue([
      { id: 'comm-1', creatorId: 'creator-1', slug: 'public', visibility: CommunityVisibility.PUBLIC },
      { id: 'comm-2', creatorId: 'creator-1', slug: 'private', visibility: CommunityVisibility.PRIVATE },
    ]);
    communityMemberRepository.find.mockResolvedValue([]);

    const result = await service.listCommunitiesForCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('public');
  });

  it('shows private communities to active community members', async () => {
    communityRepository.find.mockResolvedValue([
      { id: 'comm-2', creatorId: 'creator-1', slug: 'private', visibility: CommunityVisibility.PRIVATE },
    ]);
    roleRepository.find.mockResolvedValue([]);
    communityMemberRepository.find.mockResolvedValue([{ communityId: 'comm-2' }]);
    entitlementsService.listActiveSubscriptionsForCreator.mockResolvedValue([]);
    entitlementsService.subscriptionCoversCommunity.mockReturnValue(false);

    const result = await service.listCommunitiesForCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('private');
  });

  it('batches subscription lookup when listing multiple communities', async () => {
    communityRepository.find.mockResolvedValue([
      { id: 'comm-1', creatorId: 'creator-1', slug: 'public', visibility: CommunityVisibility.PUBLIC },
      { id: 'comm-2', creatorId: 'creator-1', slug: 'paid', visibility: CommunityVisibility.PAID },
    ]);
    roleRepository.find.mockResolvedValue([]);
    communityMemberRepository.find.mockResolvedValue([]);
    entitlementsService.listActiveSubscriptionsForCreator.mockResolvedValue([{ communityId: null }]);
    entitlementsService.subscriptionCoversCommunity.mockReturnValue(true);

    const result = await service.listCommunitiesForCreator('creator-1', 'viewer-1', UserRole.USER);

    expect(entitlementsService.listActiveSubscriptionsForCreator).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });

  it('requires active membership for paid communities', async () => {
    communityRepository.findOne.mockResolvedValue({
      id: 'comm-paid',
      creatorId: 'creator-1',
      name: 'Paid',
      slug: 'paid',
      visibility: CommunityVisibility.PAID,
    });
    entitlementsService.getMembershipForViewer.mockResolvedValue({ active: false });

    await expect(
      service.getCommunityBySlug('creator-1', 'paid', 'viewer-1', UserRole.USER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks banned users from sending messages', async () => {
    channelRepository.findOne.mockResolvedValue({
      id: 'ch-1',
      type: ChannelType.PUBLIC,
      community: { id: 'comm-1', creatorId: 'creator-1' },
    });
    entitlementsService.checkChannelAccess.mockResolvedValue({ allowed: true });
    moderationService.isBanned.mockResolvedValue(true);

    await expect(
      service.sendChannelMessage('ch-1', 'banned-user', { body: 'hello' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns join metadata for private communities without access', async () => {
    communityRepository.findOne.mockResolvedValue({
      id: 'comm-private',
      creatorId: 'creator-1',
      slug: 'private-club',
      name: 'Private Club',
      visibility: CommunityVisibility.PRIVATE,
    });
    communityMemberRepository.findOne.mockResolvedValue(null);
    entitlementsService.getMembershipForViewer.mockResolvedValue({ active: false });
    roleRepository.findOne.mockResolvedValue(null);

    const meta = await service.getCommunityAccessMeta(
      'creator-1',
      'private-club',
      'viewer-1',
      UserRole.USER,
    );

    expect(meta.canRequestJoin).toBe(true);
    expect(meta.communityId).toBe('comm-private');
  });
});
