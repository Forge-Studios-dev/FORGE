import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsAnalyticsService } from './entitlements-analytics.service';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { EngagementService } from '../engagement/engagement.service';
import { ContentVisibility } from './content-access.types';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { TierEntitlement } from './entities/tier-entitlement.entity';
import { MemberSubscriptionStatus, MemberSubscriptionSource } from './entities/member-subscription.entity';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let module: TestingModule;
  let engagementService: {
    isFollowing: jest.Mock;
    getFollowingIdsAmong: jest.Mock;
    isBlockedEitherWay: jest.Mock;
  };
  let tierRepository: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let subscriptionRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    engagementService = {
      isFollowing: jest.fn(),
      getFollowingIdsAmong: jest.fn().mockResolvedValue(new Set()),
      isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    };
    tierRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    eventEmitter = { emit: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (work) =>
        work({
          update: jest.fn(),
          save: jest.fn(),
          create: jest.fn((_e, x) => x),
        }),
      ),
    };
    subscriptionRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (x) => x),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        {
          provide: getRepositoryToken(SubscriptionTier),
          useValue: tierRepository,
        },
        {
          provide: getRepositoryToken(StreamEventPurchase),
          useValue: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(TierEntitlement),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(MemberSubscription),
          useValue: subscriptionRepository,
        },
        { provide: EngagementService, useValue: engagementService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => key === 'entitlements.mockSubscriptionsEnabled') },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: redis,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: EntitlementsAnalyticsService,
          useValue: {
            listSubscribersForCreator: jest.fn().mockResolvedValue([]),
            exportSubscribersCsv: jest.fn().mockResolvedValue(''),
            getSubscriberAnalytics: jest.fn().mockResolvedValue({
              active: 0,
              trial: 0,
              canceled: 0,
              total: 0,
              mrrCents: 0,
              byStatus: {},
            }),
          },
        },
      ],
    }).compile();

    module = testingModule;
    service = module.get(EntitlementsService);
  });

  it('allows public content without login', async () => {
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.PUBLIC,
    });
    expect(result.allowed).toBe(true);
  });

  it('requires login for followers-only content', async () => {
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.FOLLOWERS,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('login_required');
  });

  it('allows followers when following', async () => {
    engagementService.isFollowing.mockResolvedValue(true);
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.FOLLOWERS,
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(true);
  });

  it('allows owner on private content', async () => {
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.PRIVATE,
      viewerId: 'u1',
      isOwner: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('denies private content for non-owner viewers', async () => {
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.PRIVATE,
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('private');
  });

  it('requires active subscription for subscribers-only', async () => {
    jest.spyOn(service, 'hasActiveSubscription').mockResolvedValue(false);
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.SUBSCRIBERS,
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('subscription_required');
  });

  it('allows subscribers-only when membership is active', async () => {
    jest.spyOn(service, 'hasActiveSubscription').mockResolvedValue(true);
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.SUBSCRIBERS,
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(true);
  });

  it('requires tier rank for tier-gated content', async () => {
    jest.spyOn(service, 'meetsTierRequirement').mockResolvedValue(false);
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.TIER,
      requiredTierId: 'tier-gold',
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tier_required');
  });

  it('allows tier-gated content when tier requirement is met', async () => {
    jest.spyOn(service, 'meetsTierRequirement').mockResolvedValue(true);
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.TIER,
      requiredTierId: 'tier-gold',
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(true);
  });

  it('returns paid_event reason for paid event visibility', async () => {
    const result = await service.checkAccess({
      creatorId: 'c1',
      visibility: ContentVisibility.PAID_EVENT,
      viewerId: 'u1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('paid_event');
  });

  it('getTierById returns cached tier without DB lookup', async () => {
    const tier = {
      id: 'tier-gold',
      creatorId: 'c1',
      sortOrder: 2,
      slug: 'gold',
      name: 'Gold',
      priceCents: 999,
      currency: 'INR',
      benefits: [],
      isActive: true,
    };
    redis.get.mockResolvedValueOnce(JSON.stringify(tier));

    const result = await service.getTierById('tier-gold');

    expect(result.sortOrder).toBe(2);
    expect(tierRepository.findOne).not.toHaveBeenCalled();
  });

  it('getTierById loads tier from DB and caches for 300s', async () => {
    const tier = {
      id: 'tier-gold',
      creatorId: 'c1',
      sortOrder: 3,
      slug: 'gold',
      name: 'Gold',
      priceCents: 999,
      currency: 'INR',
      benefits: [],
      isActive: true,
    };
    tierRepository.findOne.mockResolvedValue(tier);

    const result = await service.getTierById('tier-gold');

    expect(result.sortOrder).toBe(3);
    expect(redis.setex).toHaveBeenCalledWith('ent:tier:tier-gold', 300, expect.any(String));
  });

  it('checkAccessMany batches follow lookup for multiple creators', async () => {
    engagementService.getFollowingIdsAmong.mockResolvedValue(new Set(['c1']));

    const results = await service.checkAccessMany('u1', null, [
      { creatorId: 'c1', visibility: ContentVisibility.FOLLOWERS },
      { creatorId: 'c2', visibility: ContentVisibility.FOLLOWERS },
    ]);

    expect(engagementService.getFollowingIdsAmong).toHaveBeenCalledWith('u1', ['c1', 'c2']);
    expect(engagementService.isFollowing).not.toHaveBeenCalled();
    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(false);
    expect(results[1].reason).toBe('follow_required');
  });

  it('expireDueSubscriptions revokes access and suspends scoped members', async () => {
    const expiredSub = {
      id: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
      status: MemberSubscriptionStatus.ACTIVE,
      expiresAt: new Date('2020-01-01'),
    };
    subscriptionRepository.find.mockResolvedValue([expiredSub]);

    const count = await service.expireDueSubscriptions();

    expect(count).toBe(1);
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      { id: 'sub-1' },
      { status: MemberSubscriptionStatus.EXPIRED },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('community.access.changed', {
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('community.member.suspend', {
      userId: 'user-1',
      communityId: 'comm-1',
    });
  });

  it('expireDueSubscriptions ends trials past their end date (safety net)', async () => {
    const expiredTrial = {
      id: 'sub-trial',
      userId: 'user-2',
      creatorId: 'creator-1',
      communityId: null,
      status: MemberSubscriptionStatus.TRIAL,
      expiresAt: new Date('2020-01-01'),
    };
    subscriptionRepository.find.mockResolvedValue([expiredTrial]);

    const count = await service.expireDueSubscriptions();

    expect(count).toBe(1);
    // Query must consider ACTIVE, TRIAL, and RENEWAL_PENDING subscriptions.
    const whereArg = subscriptionRepository.find.mock.calls[0][0].where;
    expect(whereArg.status.value).toEqual([
      MemberSubscriptionStatus.ACTIVE,
      MemberSubscriptionStatus.TRIAL,
      MemberSubscriptionStatus.RENEWAL_PENDING,
    ]);
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      { id: 'sub-trial' },
      { status: MemberSubscriptionStatus.EXPIRED },
    );
  });

  it('expireDueSubscriptions ends cancel-at-period-end (renewal_pending) subs at period end', async () => {
    subscriptionRepository.find.mockResolvedValue([
      {
        id: 'sub-renewal',
        userId: 'user-3',
        creatorId: 'creator-1',
        communityId: null,
        status: MemberSubscriptionStatus.RENEWAL_PENDING,
        expiresAt: new Date('2020-01-01'),
      },
    ]);

    const count = await service.expireDueSubscriptions();

    expect(count).toBe(1);
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      { id: 'sub-renewal' },
      { status: MemberSubscriptionStatus.EXPIRED },
    );
  });

  it('cancelByExternalRef suspends scoped community members', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
      status: MemberSubscriptionStatus.ACTIVE,
      externalRef: 'sub_stripe',
    });

    await service.cancelByExternalRef('sub_stripe');

    expect(eventEmitter.emit).toHaveBeenCalledWith('community.member.suspend', {
      userId: 'user-1',
      communityId: 'comm-1',
    });
  });

  it('grantSubscription emits member provision for scoped community grants', async () => {
    tierRepository.findOne.mockResolvedValue({
      id: 'tier-1',
      creatorId: 'creator-1',
    });
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-new',
      tier: { priceCents: 999 },
    });

    dataSource.transaction.mockImplementationOnce(async (work) =>
      work({
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        })),
        save: jest.fn().mockResolvedValue({
          id: 'sub-new',
          userId: 'user-1',
          creatorId: 'creator-1',
          tierId: 'tier-1',
          communityId: 'comm-1',
        }),
        create: jest.fn((_entity, payload) => payload),
      }),
    );

    await service.grantSubscription(
      'user-1',
      {
        creatorId: 'creator-1',
        tierId: 'tier-1',
        communityId: 'comm-1',
        expiresInDays: 30,
      },
      MemberSubscriptionSource.ADMIN_GRANT,
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith('community.access.changed', {
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('community.member.provision', {
      userId: 'user-1',
      communityId: 'comm-1',
      creatorId: 'creator-1',
    });
  });

  it('cancelSubscriptionsForAccountDeletion cancels Stripe then marks local rows canceled', async () => {
    const stripeTierSync = {
      isEnabled: jest.fn().mockReturnValue(true),
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(service, { stripeTierSync });

    subscriptionRepository.find.mockResolvedValueOnce([
      {
        id: 'sub-1',
        userId: 'user-1',
        creatorId: 'creator-1',
        communityId: null,
        status: MemberSubscriptionStatus.ACTIVE,
        source: MemberSubscriptionSource.STRIPE,
        externalRef: 'sub_stripe_1',
      },
      {
        id: 'sub-2',
        userId: 'fan-2',
        creatorId: 'user-1',
        communityId: 'comm-1',
        status: MemberSubscriptionStatus.TRIAL,
        source: MemberSubscriptionSource.MOCK,
        externalRef: null,
      },
    ]);

    const result = await service.cancelSubscriptionsForAccountDeletion('user-1');
    expect(result).toEqual({ canceled: 2 });
    expect(stripeTierSync.cancelSubscription).toHaveBeenCalledWith('sub_stripe_1', false);
    expect(subscriptionRepository.save).toHaveBeenCalledTimes(2);
  });

  it('cancelMySubscription suspends scoped community members on immediate cancel', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
      status: MemberSubscriptionStatus.ACTIVE,
      source: MemberSubscriptionSource.ADMIN_GRANT,
    });

    const result = await service.cancelMySubscription('user-1', 'creator-1');

    expect(result).toEqual({ canceled: true });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MemberSubscriptionStatus.CANCELED }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('community.member.suspend', {
      userId: 'user-1',
      communityId: 'comm-1',
    });
  });

  it('cancelMySubscription keeps scoped members active when canceling Stripe at period end', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
      status: MemberSubscriptionStatus.ACTIVE,
      source: MemberSubscriptionSource.STRIPE,
      externalRef: 'sub_stripe_1',
    });

    const result = await service.cancelMySubscription('user-1', 'creator-1', true);

    expect(result).toEqual({ canceled: false, cancelAtPeriodEnd: true });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MemberSubscriptionStatus.RENEWAL_PENDING }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('community.member.suspend', expect.anything());
  });

  it('busts the subscription-cache event on every access-changing write, including a tier downgrade — so other modules with their own short-lived entitlement caches (e.g. live-stream socket access) can invalidate too', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      creatorId: 'creator-1',
      tierId: 'tier-expensive',
    });
    tierRepository.findOne.mockResolvedValue({ id: 'tier-cheap', creatorId: 'creator-1' });

    await service.changeSubscriptionTier('sub-1', 'tier-cheap');

    expect(eventEmitter.emit).toHaveBeenCalledWith('entitlements.subscription-cache.busted', {
      userId: 'user-1',
      creatorId: 'creator-1',
    });
  });
});
