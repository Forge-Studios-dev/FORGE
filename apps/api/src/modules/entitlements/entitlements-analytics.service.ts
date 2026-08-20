import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toCsv } from '../../common/utils/csv.util';
import {
  MemberSubscription,
  MemberSubscriptionStatus,
} from './entities/member-subscription.entity';
import { BillingInterval } from './entities/subscription-tier.entity';
import { ACCESS_GRANTING_STATUSES } from './access-granting-statuses';

/**
 * Cold-path subscriber list/export/analytics reads.
 *
 * Extracted from `EntitlementsService` for H-A1 in
 * `docs/audits/IMPLEMENTATION_TRACKER_2026-07-26.md` — mirrors the
 * CommunitiesService split (C2). Hot-path access checks
 * (`checkAccess`, `getActiveSubscription`, cache management, grant/cancel
 * webhooks) stay in `EntitlementsService`; this service only serves
 * dashboards and CSV exports, which run at human/cron cadence and don't
 * touch the entitlement Redis cache.
 *
 * `EntitlementsService` remains a facade that forwards its previous public
 * analytics methods here so existing callers (controllers, notify jobs,
 * community analytics) do not have to migrate.
 */
@Injectable()
export class EntitlementsAnalyticsService {
  constructor(
    @InjectRepository(MemberSubscription)
    private readonly subscriptionRepository: Repository<MemberSubscription>,
  ) {}

  async listSubscribersForCreator(
    creatorId: string,
    opts?: { status?: MemberSubscriptionStatus; limit?: number; offset?: number },
  ) {
    const qb = this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.creator_id = :creatorId', { creatorId })
      .orderBy('s.created_at', 'DESC')
      .take(opts?.limit ?? 50)
      .skip(opts?.offset ?? 0);

    if (opts?.status) {
      qb.andWhere('s.status = :status', { status: opts.status });
    } else {
      qb.andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES });
    }

    const subs = await qb.getMany();
    return subs.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.user?.username,
      displayName: s.user?.displayName,
      tierName: s.tier?.name,
      status: s.status,
      source: s.source,
      startsAt: s.startsAt,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  async exportSubscribersCsv(creatorId: string): Promise<string> {
    const subs = await this.listSubscribersForCreator(creatorId, { limit: 5000 });
    return toCsv(
      ['userId', 'username', 'displayName', 'tier', 'status', 'source', 'startsAt', 'expiresAt'],
      subs.map((s) => [
        s.userId,
        s.username ?? '',
        s.displayName ?? '',
        s.tierName ?? '',
        s.status,
        s.source,
        s.startsAt?.toISOString() ?? '',
        s.expiresAt?.toISOString() ?? '',
      ]),
    );
  }

  async getSubscriberAnalytics(creatorId: string) {
    const rows = await this.subscriptionRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.creator_id = :creatorId', { creatorId })
      .groupBy('s.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    const active = byStatus[MemberSubscriptionStatus.ACTIVE] ?? 0;
    const trial = byStatus[MemberSubscriptionStatus.TRIAL] ?? 0;
    const canceled = byStatus[MemberSubscriptionStatus.CANCELED] ?? 0;

    // MRR is active-paying revenue only (see docs/CREATOR_KPI_DEFINITIONS.md)
    // — a trialing member generates $0 today, so counting their tier price
    // overstates recurring revenue until they actually convert.
    const payingSubs = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .getMany();
    const mrrCents = payingSubs.reduce(
      (sum, sub) =>
        sum + this.normalizedMonthlyMrrCents(sub.tier?.priceCents ?? 0, sub.tier?.billingInterval),
      0,
    );

    return {
      active,
      trial,
      canceled,
      total: rows.reduce((sum, r) => sum + Number(r.count), 0),
      mrrCents,
      byStatus,
    };
  }

  private normalizedMonthlyMrrCents(
    priceCents: number,
    interval?: BillingInterval | null,
  ): number {
    switch (interval) {
      case BillingInterval.YEARLY:
        return Math.round(priceCents / 12);
      case BillingInterval.QUARTERLY:
        return Math.round(priceCents / 3);
      case BillingInterval.LIFETIME:
        return 0;
      case BillingInterval.MONTHLY:
      default:
        return priceCents;
    }
  }
}
