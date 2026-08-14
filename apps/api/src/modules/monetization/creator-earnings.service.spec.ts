import { CreatorEarningsService } from './creator-earnings.service';

function makeQb(raw: Record<string, string>) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
}

describe('CreatorEarningsService', () => {
  const superThanksRepository = { createQueryBuilder: jest.fn() };
  const streamMessageRepository = { createQueryBuilder: jest.fn() };
  const streamRepository = {};
  const entitlementsService = { getSubscriberAnalytics: jest.fn() };

  const service = new CreatorEarningsService(
    superThanksRepository as never,
    streamMessageRepository as never,
    streamRepository as never,
    entitlementsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlementsService.getSubscriberAnalytics.mockResolvedValue({
      active: 10,
      trial: 0,
      canceled: 0,
      total: 10,
      mrrCents: 9900,
      byStatus: {},
    });
    superThanksRepository.createQueryBuilder.mockReturnValue(
      makeQb({ gross: '1000', net: '900', count: '5' }),
    );
    streamMessageRepository.createQueryBuilder.mockReturnValue(
      makeQb({ gross: '2000', net: '1800', count: '3' }),
    );
  });

  it('rolls up subscriptions + Super Thanks + Super Chat into one summary', async () => {
    const summary = await service.getSummary('creator-1', { days: 30 });

    expect(summary).toEqual({
      periodDays: 30,
      subscriptions: { mrrCents: 9900, activeSubscribers: 10 },
      superThanks: { totalAmountCents: 1000, creatorNetCents: 900, tipCount: 5 },
      superChat: { totalAmountCents: 2000, creatorNetCents: 1800, tipCount: 3 },
      totalCreatorNetCents: 2700,
      adRevenueCents: 0,
    });
  });

  it('clamps the days window to [1, 365]', async () => {
    await service.getSummary('creator-1', { days: 9999 });
    const summary = await service.getSummary('creator-1', { days: -5 });
    expect(summary.periodDays).toBe(1);
  });

  it('exports the summary as CSV including the ad-revenue placeholder row', async () => {
    const csv = await service.exportSummaryCsv('creator-1', { days: 7 });
    expect(csv).toContain('ad_revenue,cents,0');
    expect(csv).toContain('subscriptions,mrr_cents,9900');
    expect(csv).toContain('total,creator_net_cents,2700');
  });
});
