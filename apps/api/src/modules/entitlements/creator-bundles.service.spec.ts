import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreatorBundlesService } from './creator-bundles.service';
import { CreatorBundle, CreatorBundleItem } from './entities/creator-bundle.entity';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import { TierEntitlement, TierEntitlementResourceType } from './entities/tier-entitlement.entity';
import { EngagementService } from '../engagement/engagement.service';

describe('CreatorBundlesService', () => {
  let service: CreatorBundlesService;

  const bundleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
  };
  const bundleItemRepository = {
    save: jest.fn(),
    create: jest.fn((input) => input),
    delete: jest.fn(),
  };
  const tierRepository = {
    findOne: jest.fn(),
  };
  const tierEntitlementRepository = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorBundlesService,
        { provide: getRepositoryToken(CreatorBundle), useValue: bundleRepository },
        { provide: getRepositoryToken(CreatorBundleItem), useValue: bundleItemRepository },
        { provide: getRepositoryToken(SubscriptionTier), useValue: tierRepository },
        { provide: getRepositoryToken(TierEntitlement), useValue: tierEntitlementRepository },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: EngagementService,
          useValue: { isBlockedEitherWay: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = module.get(CreatorBundlesService);
  });

  it('lists public bundles for creator', async () => {
    bundleRepository.find.mockResolvedValue([
      {
        id: 'b1',
        creatorId: 'c1',
        tierId: 't1',
        name: 'All Access',
        slug: 'all-access',
        description: null,
        isActive: true,
        sortOrder: 0,
        items: [{ id: 'i1', resourceType: 'course', resourceId: 'course-1', sortOrder: 0 }],
        tier: { id: 't1', name: 'Pro', priceCents: 9900, currency: 'INR', billingInterval: 'monthly', isActive: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listPublic('c1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('All Access');
  });

  it('creates bundle and syncs tier entitlements', async () => {
    const tier = { id: 't1', creatorId: 'c1', name: 'Pro', priceCents: 9900, currency: 'INR', billingInterval: 'monthly', isActive: true };
    tierRepository.findOne.mockResolvedValue(tier);
    bundleRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'b1',
        creatorId: 'c1',
        tierId: 't1',
        name: 'Bundle',
        slug: 'bundle',
        description: null,
        isActive: true,
        sortOrder: 0,
        items: [{ id: 'i1', resourceType: 'course', resourceId: 'course-1', sortOrder: 0 }],
        tier,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    bundleRepository.save.mockResolvedValue({
      id: 'b1',
      creatorId: 'c1',
      tierId: 't1',
      name: 'Bundle',
      slug: 'bundle',
      description: null,
      isActive: true,
      sortOrder: 0,
    });
    bundleItemRepository.save.mockResolvedValue([
      { id: 'i1', bundleId: 'b1', resourceType: 'course', resourceId: 'course-1', sortOrder: 0 },
    ]);
    tierEntitlementRepository.find.mockResolvedValue([]);
    tierEntitlementRepository.save.mockResolvedValue({ id: 'e1' });

    const result = await service.create('c1', {
      name: 'Bundle',
      tierId: 't1',
      items: [{ resourceType: TierEntitlementResourceType.COURSE, resourceId: 'course-1' }],
    });

    expect(result.data.slug).toBe('bundle');
    expect(tierEntitlementRepository.save).toHaveBeenCalled();
  });
});
