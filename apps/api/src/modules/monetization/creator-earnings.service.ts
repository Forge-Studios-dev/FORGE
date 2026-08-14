import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toCsv } from '../../common/utils/csv.util';
import { SuperThanks } from '../billing/entities/super-thanks.entity';
import { StreamMessage, StreamMessageType } from '../stream-chat/entities/stream-message.entity';
import { Stream } from '../streaming/entities/stream.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';

export interface CreatorEarningsSummary {
  periodDays: number;
  subscriptions: { mrrCents: number; activeSubscribers: number };
  superThanks: { totalAmountCents: number; creatorNetCents: number; tipCount: number };
  superChat: { totalAmountCents: number; creatorNetCents: number; tipCount: number };
  totalCreatorNetCents: number;
  /**
   * No ad network is integrated (see docs/MONETIZATION.md) — this is not a
   * live figure, it's a placeholder so the summary shape doesn't need to
   * change again once one is. Always 0 today.
   */
  adRevenueCents: 0;
}

/**
 * Unifies the three revenue streams that actually move money today —
 * subscriptions (Stripe Connect recurring), Super Chat, Super Thanks — into
 * one creator-facing summary. Each stream already has its own ledger
 * (MemberSubscription, StreamMessage, SuperThanks); this doesn't replace
 * those, it rolls them up for a single "how much did I make" view, same
 * as YouTube Studio's revenue tab combines ads/memberships/Super Chat/Thanks.
 */
@Injectable()
export class CreatorEarningsService {
  constructor(
    @InjectRepository(SuperThanks)
    private readonly superThanksRepository: Repository<SuperThanks>,
    @InjectRepository(StreamMessage)
    private readonly streamMessageRepository: Repository<StreamMessage>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getSummary(creatorId: string, opts: { days?: number } = {}): Promise<CreatorEarningsSummary> {
    const days = Math.min(365, Math.max(1, opts.days ?? 30));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const [subscriberAnalytics, superThanksRow, superChatRow] = await Promise.all([
      this.entitlementsService.getSubscriberAnalytics(creatorId),
      this.superThanksTotals(creatorId, since),
      this.superChatTotals(creatorId, since),
    ]);

    const totalCreatorNetCents = superThanksRow.creatorNetCents + superChatRow.creatorNetCents;

    return {
      periodDays: days,
      subscriptions: {
        mrrCents: subscriberAnalytics.mrrCents,
        activeSubscribers: subscriberAnalytics.active,
      },
      superThanks: superThanksRow,
      superChat: superChatRow,
      totalCreatorNetCents,
      adRevenueCents: 0,
    };
  }

  async exportSummaryCsv(creatorId: string, opts: { days?: number } = {}): Promise<string> {
    const s = await this.getSummary(creatorId, opts);
    return toCsv(
      ['stream', 'metric', 'value'],
      [
        ['subscriptions', 'mrr_cents', s.subscriptions.mrrCents],
        ['subscriptions', 'active_subscribers', s.subscriptions.activeSubscribers],
        ['super_thanks', 'gross_cents', s.superThanks.totalAmountCents],
        ['super_thanks', 'creator_net_cents', s.superThanks.creatorNetCents],
        ['super_thanks', 'tip_count', s.superThanks.tipCount],
        ['super_chat', 'gross_cents', s.superChat.totalAmountCents],
        ['super_chat', 'creator_net_cents', s.superChat.creatorNetCents],
        ['super_chat', 'tip_count', s.superChat.tipCount],
        ['ad_revenue', 'cents', s.adRevenueCents],
        ['total', 'creator_net_cents', s.totalCreatorNetCents],
      ],
    );
  }

  private async superThanksTotals(creatorId: string, since: Date) {
    const row = await this.superThanksRepository
      .createQueryBuilder('st')
      .select('COALESCE(SUM(st.amount_cents), 0)', 'gross')
      .addSelect('COALESCE(SUM(st.creator_net_cents), 0)', 'net')
      .addSelect('COUNT(*)', 'count')
      .where('st.creator_id = :creatorId', { creatorId })
      .andWhere('st.created_at >= :since', { since })
      .andWhere('st.refunded_at IS NULL')
      .getRawOne<{ gross: string; net: string; count: string }>();
    return {
      totalAmountCents: Number(row?.gross ?? 0),
      creatorNetCents: Number(row?.net ?? 0),
      tipCount: Number(row?.count ?? 0),
    };
  }

  private async superChatTotals(creatorId: string, since: Date) {
    const row = await this.streamMessageRepository
      .createQueryBuilder('m')
      .innerJoin(Stream, 's', 's.id = m.stream_id')
      .select('COALESCE(SUM(m.amount_cents), 0)', 'gross')
      .addSelect('COALESCE(SUM(m.creator_net_cents), 0)', 'net')
      .addSelect('COUNT(*)', 'count')
      .where('s.user_id = :creatorId', { creatorId })
      .andWhere('m.message_type = :type', { type: StreamMessageType.SUPER_CHAT })
      .andWhere('m.created_at >= :since', { since })
      .andWhere('m.refunded_at IS NULL')
      .getRawOne<{ gross: string; net: string; count: string }>();
    return {
      totalAmountCents: Number(row?.gross ?? 0),
      creatorNetCents: Number(row?.net ?? 0),
      tipCount: Number(row?.count ?? 0),
    };
  }
}
