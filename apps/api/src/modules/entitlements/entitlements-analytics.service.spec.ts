import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntitlementsAnalyticsService } from './entitlements-analytics.service';
import { MemberSubscription, MemberSubscriptionStatus } from './entities/member-subscription.entity';
import { BillingInterval } from './entities/subscription-tier.entity';

describe('EntitlementsAnalyticsService', () => {
  let service: EntitlementsAnalyticsService;
  let subscriptionRepository: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    subscriptionRepository = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsAnalyticsService,
        {
          provide: getRepositoryToken(MemberSubscription),
          useValue: subscriptionRepository,
        },
      ],
    }).compile();

    service = testingModule.get(EntitlementsAnalyticsService);
  });

  it('getSubscriberAnalytics normalizes MRR by billing interval', async () => {
    subscriptionRepository.createQueryBuilder
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ status: MemberSubscriptionStatus.ACTIVE, count: '2' }]),
      })
      .mockReturnValueOnce({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { tier: { priceCents: 1200, billingInterval: BillingInterval.YEARLY } },
          { tier: { priceCents: 999, billingInterval: BillingInterval.MONTHLY } },
          { tier: { priceCents: 5000, billingInterval: BillingInterval.LIFETIME } },
        ]),
      });

    const analytics = await service.getSubscriberAnalytics('creator-1');

    expect(analytics.mrrCents).toBe(1099);
    expect(analytics.active).toBe(2);
    expect(analytics.total).toBe(2);
  });

  it('exportSubscribersCsv returns CSV header + row per subscriber', async () => {
    subscriptionRepository.createQueryBuilder.mockReturnValueOnce({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          userId: 'user-1',
          user: { username: 'alice', displayName: 'Alice' },
          tier: { name: 'Gold' },
          status: MemberSubscriptionStatus.ACTIVE,
          source: 'stripe',
          startsAt: new Date('2025-01-01T00:00:00Z'),
          expiresAt: null,
          createdAt: new Date('2025-01-01T00:00:00Z'),
        },
      ]),
    });

    const csv = await service.exportSubscribersCsv('creator-1');

    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('userId,username,displayName,tier,status,source,startsAt,expiresAt');
    expect(lines[1]).toContain('user-1');
    expect(lines[1]).toContain('alice');
    expect(lines[1]).toContain('Gold');
  });
});
