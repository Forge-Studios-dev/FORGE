import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { EngagementService } from '../engagement/engagement.service';
import { ContentVisibility } from './content-access.types';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let engagementService: { isFollowing: jest.Mock; getFollowingIdsAmong: jest.Mock };
  let tierRepository: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    engagementService = {
      isFollowing: jest.fn(),
      getFollowingIdsAmong: jest.fn().mockResolvedValue(new Set()),
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        {
          provide: getRepositoryToken(SubscriptionTier),
          useValue: tierRepository,
        },
        {
          provide: getRepositoryToken(MemberSubscription),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
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
      ],
    }).compile();

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
});
