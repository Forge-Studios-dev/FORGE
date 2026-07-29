import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunitiesService } from './communities.service';
import { CommunityAccessService } from './community-access.service';
import { CommunityAnalyticsService } from './community-analytics.service';
import { ChannelLegacyService } from './channel-legacy.service';
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
import { ChannelMigrationService } from './channel-migration.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { FeatureFlagsService } from '../platform/feature-flags.service';
import { Stream } from '../streaming/entities/stream.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityMember } from './entities/community-member.entity';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { UserRole } from '../users/entities/user.entity';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let analyticsService: CommunityAnalyticsService;
  let entitlementsService: {
    checkChannelAccess: jest.Mock;
    checkChannelAccessMany: jest.Mock;
    getMembershipForViewer: jest.Mock;
    listActiveSubscriptionsForCreator: jest.Mock;
    subscriptionCoversCommunity: jest.Mock;
    getSubscriberAnalytics: jest.Mock;
  };
  let accessSessionsService: { requirePremiumSession: jest.Mock };
  let moderationService: { isBanned: jest.Mock; listUnifiedReportsForCreator: jest.Mock };
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
      const insert = jest.fn();
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        save,
        insert,
        create: jest.fn((_entity, x) => x),
      };
      const result = await work(manager);
      (dataSource as { lastSave?: jest.Mock; lastInsert?: jest.Mock }).lastSave = save;
      (dataSource as { lastSave?: jest.Mock; lastInsert?: jest.Mock }).lastInsert = insert;
      return result;
    }),
    query: jest.fn().mockResolvedValue([]),
  } as { transaction: jest.Mock; query: jest.Mock; lastSave?: jest.Mock; lastInsert?: jest.Mock };

  beforeEach(async () => {
    entitlementsService = {
      checkChannelAccess: jest.fn(),
      checkChannelAccessMany: jest.fn(),
      getMembershipForViewer: jest.fn().mockResolvedValue({ active: false }),
      listActiveSubscriptionsForCreator: jest.fn().mockResolvedValue([]),
      subscriptionCoversCommunity: jest.fn().mockReturnValue(false),
      getSubscriberAnalytics: jest.fn().mockResolvedValue({
        active: 0,
        trial: 0,
        canceled: 0,
        total: 0,
        mrrCents: 0,
        byStatus: {},
      }),
    };
    accessSessionsService = { requirePremiumSession: jest.fn().mockResolvedValue(undefined) };
    moderationService = {
      isBanned: jest.fn().mockResolvedValue(false),
      listUnifiedReportsForCreator: jest.fn().mockResolvedValue({ data: [] }),
    };
    aiModerationService = { scoreSpam: jest.fn().mockReturnValue({ flagged: false, score: 0, reasons: [] }) };
    aiCommunityService = { scoreContent: jest.fn().mockReturnValue({ flagged: false, score: 0, reasons: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        CommunityAccessService,
        CommunityAnalyticsService,
        ChannelLegacyService,
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
        {
          provide: ChannelMigrationService,
          useValue: {
            resolveRoomIdForChannel: jest.fn().mockResolvedValue(null),
            resolveChannelIdForRoom: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CommunityRoomMessagesService,
          useValue: { listMessages: jest.fn(), sendMessage: jest.fn() },
        },
        {
          provide: FeatureFlagsService,
          useValue: { isEnabled: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = module.get(CommunitiesService);
    analyticsService = module.get(CommunityAnalyticsService);
    jest.clearAllMocks();
  });

  it('seeds default channels when community is created', async () => {
    communityRepository.findOne.mockResolvedValue(null);

    await service.ensureCommunity('creator-1');

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(dataSource.lastSave).toHaveBeenCalledTimes(1);
    expect(dataSource.lastInsert).toHaveBeenCalledTimes(1);
    expect(dataSource.lastInsert).toHaveBeenCalledWith(
      Channel,
      expect.arrayContaining([expect.objectContaining({ slug: 'premium-content', type: ChannelType.SUBSCRIBERS })]),
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

  it('exports business analytics as injection-safe long-format CSV', async () => {
    jest.spyOn(analyticsService, 'getCreatorBusinessAnalytics').mockResolvedValue({
      periodDays: 30,
      membership: { active: 12, trial: 3, canceled: 5, mrrCents: 49900 },
      kpis: { churnRate30d: 2.5, canceledLast30Days: 5, engagementScore: 0.72, arrCents: 598800 },
      engagement: {
        engagedMembers: 8,
        activeChatters: 6,
        postAuthors: 2,
        courseEnrollments: 4,
      },
      funnel: [
        { stage: 'paying_members', label: 'Paying members', count: 15, rateFromTop: 100 },
        { stage: 'engaged_xp', label: 'Engaged (XP)', count: 8, rateFromTop: 53 },
      ],
      cohortRetention: {
        weekly: [{ period: '2026-W24', cohortSize: 10, retained: 7, engagedRetained: 5, retentionRate: 70 }],
        monthly: [],
      },
      communities: [
        { id: 'c1', name: 'Main', slug: 'main', activeMembersLast7Days: 9 },
      ],
    } as never);

    const csv = await service.getCreatorBusinessAnalyticsCsv('creator-1');
    const lines = csv.split('\n');

    expect(lines[0]).toBe('section,key,value');
    expect(csv).toContain('membership,active,12');
    expect(csv).toContain('membership,mrr_cents,49900');
    expect(csv).toContain('funnel,paying_members.count,15');
    expect(csv).toContain('funnel,engaged_xp.rate_from_top,53');
    expect(csv).toContain('community,main.active_members_7d,9');
    expect(csv).toContain('retention_weekly,2026-W24.retention_rate,70');
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

  describe('getCreatorAttention', () => {
    it('returns empty items and zero counts when nothing needs action', async () => {
      dataSource.query
        .mockResolvedValueOnce([]) // unreplied comments
        .mockResolvedValueOnce([]); // failed videos

      const result = await service.getCreatorAttention('creator-1');

      expect(result.counts).toEqual({
        commentsNeedingReply: 0,
        pendingModeration: 0,
        failedPayments: 0,
        processingFailures: 0,
      });
      expect(result.items).toEqual([]);
    });

    it('surfaces unreplied comments with the total count from the window function', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'comment-1',
            video_id: 'video-1',
            video_title: 'Intro to FORGE',
            content: 'Great lesson!',
            created_at: '2026-07-01T00:00:00.000Z',
            total_count: '3',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getCreatorAttention('creator-1');

      expect(result.counts.commentsNeedingReply).toBe(3);
      expect(result.items[0]).toMatchObject({
        id: 'comment-comment-1',
        kind: 'comment',
        href: '/studio/comments',
        tone: 'primary',
      });
    });

    it('includes open moderation reports scoped to the creator', async () => {
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      moderationService.listUnifiedReportsForCreator.mockResolvedValue({
        data: [
          { id: 'report-1', reason: 'Spam', communityName: 'Main', createdAt: new Date('2026-07-02') },
        ],
      });

      const result = await service.getCreatorAttention('creator-1');

      expect(result.counts.pendingModeration).toBe(1);
      expect(result.items).toContainEqual(
        expect.objectContaining({ id: 'moderation-report-1', kind: 'moderation', tone: 'warning' }),
      );
    });

    it('ranks failed payments above moderation and comments, and omits the item when there are none', async () => {
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      entitlementsService.getSubscriberAnalytics.mockResolvedValue({
        active: 10,
        trial: 0,
        canceled: 0,
        total: 12,
        mrrCents: 50000,
        byStatus: { failed_payment: 2 },
      });
      moderationService.listUnifiedReportsForCreator.mockResolvedValue({
        data: [{ id: 'report-1', reason: 'Spam', communityName: 'Main', createdAt: new Date('2026-07-02') }],
      });

      const result = await service.getCreatorAttention('creator-1');

      expect(result.counts.failedPayments).toBe(2);
      expect(result.items[0]).toMatchObject({ id: 'billing-failed-payments', kind: 'billing', tone: 'critical' });
    });

    it('surfaces failed video processing in the attention queue', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'video-fail-1',
            title: 'Broken upload',
            status: 'failed',
            failure_reason: 'Transcode timed out',
            updated_at: '2026-07-03T00:00:00.000Z',
            total_count: '1',
          },
        ]);

      const result = await service.getCreatorAttention('creator-1');

      expect(result.counts.processingFailures).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'processing-video-fail-1',
        kind: 'processing',
        href: '/studio/videos/video-fail-1',
        tone: 'critical',
      });
    });
  });
});
