import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  CheckoutSessionInput,
  EventCheckoutSessionInput,
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { MemberSubscriptionSource, MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';
import { Video, VideoStatus } from '../content/entities/video.entity';
import { StreamingService } from '../streaming/streaming.service';
import { SuperThanks } from './entities/super-thanks.entity';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';

import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { StripeConnectService } from './stripe-connect.service';
import { toCsv } from '../../common/utils/csv.util';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private static readonly WEBHOOK_PROVIDER = 'stripe';

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly entitlementsService: EntitlementsService,
    private readonly engagementService: EngagementService,
    private readonly configService: ConfigService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    @InjectRepository(StreamEventPurchase)
    private readonly purchaseRepository: Repository<StreamEventPurchase>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(SuperThanks)
    private readonly superThanksRepository: Repository<SuperThanks>,
    @InjectRepository(StreamMessage)
    private readonly streamMessageRepository: Repository<StreamMessage>,
    @Inject(forwardRef(() => StreamingService))
    private readonly streamingService: StreamingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stripeTierSync: StripeTierSyncService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  private async assertNotBlockedPeer(viewerId: string, creatorId: string): Promise<void> {
    if (await this.engagementService.isBlockedEitherWay(viewerId, creatorId)) {
      throw new ForbiddenException('This channel is not available');
    }
  }

  async createCheckout(userId: string, input: Omit<CheckoutSessionInput, 'userId'>) {
    await this.assertNotBlockedPeer(userId, input.creatorId);
    const tier = await this.entitlementsService.getTierById(input.tierId);
    if (tier.creatorId !== input.creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }

    if (tier.maxMembers != null) {
      const activeCount = await this.entitlementsService.countActiveMembersOnTier(tier.id);
      if (activeCount >= tier.maxMembers) {
        throw new BadRequestException(
          `This tier is full (${tier.maxMembers} seat limit reached)`,
        );
      }
    }

    let stripePriceId = tier.stripePriceId;
    if (this.isBillingEnabled() && !stripePriceId) {
      const synced = await this.stripeTierSync.syncTier(tier);
      if (synced) {
        await this.entitlementsService.updateTierStripeIds(tier.id, synced.productId, synced.priceId);
        stripePriceId = synced.priceId;
      }
    }

    let connectAccountId: string | null = null;
    const platformFeePercent =
      this.configService.get<number>('billing.stripePlatformFeePercent') ?? 10;

    if (this.isBillingEnabled()) {
      const connectStatus = await this.stripeConnectService.getConnectStatus(input.creatorId);
      if (!connectStatus.chargesEnabled) {
        throw new BadRequestException(
          'Creator must complete Stripe Connect onboarding before accepting paid memberships',
        );
      }
      connectAccountId = (connectStatus as { accountId?: string }).accountId ?? null;
    }

    return this.paymentProvider.createCheckoutSession({
      ...input,
      userId,
      tierName: tier.name,
      priceCents: tier.priceCents,
      currency: tier.currency,
      stripePriceId,
      billingInterval: tier.billingInterval,
      trialDays: tier.trialDays,
      connectAccountId,
      platformFeePercent,
    });
  }

  async createSuperChatCheckout(
    userId: string,
    input: {
      streamId: string;
      body: string;
      amountCents: number;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    const stream = await this.streamRepository.findOne({ where: { id: input.streamId } });
    if (!stream) throw new BadRequestException('Stream not found');

    await this.assertNotBlockedPeer(userId, stream.userId);

    if (!this.isBillingEnabled()) {
      throw new BadRequestException('Payments are not enabled');
    }

    const connectStatus = await this.stripeConnectService.getConnectStatus(stream.userId);
    if (!connectStatus.chargesEnabled) {
      throw new BadRequestException(
        'Creator must complete Stripe Connect onboarding before accepting Super Chat',
      );
    }
    const connectAccountId = (connectStatus as { accountId?: string }).accountId ?? null;
    if (!connectAccountId) {
      throw new BadRequestException(
        'Creator must complete Stripe Connect onboarding before accepting Super Chat',
      );
    }
    const platformFeePercent =
      this.configService.get<number>('billing.stripePlatformFeePercent') ?? 10;

    return this.paymentProvider.createSuperChatCheckoutSession({
      userId,
      streamId: input.streamId,
      creatorId: stream.userId,
      body: input.body,
      amountCents: input.amountCents,
      currency: 'usd',
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      connectAccountId,
      platformFeePercent,
    });
  }

  /** YouTube Super Thanks — tip a creator on a VOD. */
  async createSuperThanksCheckout(
    userId: string,
    input: {
      videoId: string;
      body?: string;
      amountCents: number;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const min = 100;
    const max = 100_000;
    if (input.amountCents < min || input.amountCents > max) {
      throw new BadRequestException(`Super Thanks amount must be between ${min} and ${max} cents`);
    }

    const video = await this.videoRepository.findOne({ where: { id: input.videoId } });
    if (!video) throw new NotFoundException('Video not found');
    await this.assertNotBlockedPeer(userId, video.userId);
    if (video.status !== VideoStatus.READY) {
      throw new BadRequestException('Super Thanks are only available on ready videos');
    }
    if (video.userId === userId) {
      throw new BadRequestException("You can't Super Thanks your own video");
    }

    const message = (input.body ?? '').trim().slice(0, 200);
    const platformFeePercent =
      this.configService.get<number>('billing.stripePlatformFeePercent') ?? 10;

    if (!this.isBillingEnabled() || !input.successUrl || !input.cancelUrl) {
      // Dev / stub: grant tip immediately without Stripe
      await this.recordSuperThanks({
        videoId: video.id,
        creatorId: video.userId,
        tipperId: userId,
        body: message,
        amountCents: input.amountCents,
        platformFeePercent,
      });
      return {
        ok: true,
        requiresCheckout: false,
        tipped: true,
        amountCents: input.amountCents,
      };
    }

    const connectStatus = await this.stripeConnectService.getConnectStatus(video.userId);
    if (!connectStatus.chargesEnabled) {
      throw new BadRequestException(
        'Creator must complete Stripe Connect onboarding before accepting Super Thanks',
      );
    }
    const connectAccountId = (connectStatus as { accountId?: string }).accountId ?? null;
    if (!connectAccountId) {
      throw new BadRequestException(
        'Creator must complete Stripe Connect onboarding before accepting Super Thanks',
      );
    }

    const session = await this.paymentProvider.createSuperThanksCheckoutSession({
      userId,
      videoId: video.id,
      creatorId: video.userId,
      body: message || 'Thanks!',
      amountCents: input.amountCents,
      currency: 'usd',
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      connectAccountId,
      platformFeePercent,
    });

    return {
      ok: true,
      requiresCheckout: true,
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    };
  }

  async createEventCheckout(
    userId: string,
    input: Pick<EventCheckoutSessionInput, 'streamId' | 'successUrl' | 'cancelUrl'>,
  ) {
    const stream = await this.streamRepository.findOne({ where: { id: input.streamId } });
    if (!stream) throw new BadRequestException('Stream not found');
    await this.assertNotBlockedPeer(userId, stream.userId);
    if (stream.visibility !== StreamVisibility.PAID_EVENT) {
      throw new BadRequestException('This stream is not a paid event');
    }
    if (!stream.ticketPriceCents || stream.ticketPriceCents < 100) {
      throw new BadRequestException('Ticket price is not configured');
    }

    const existing = await this.purchaseRepository.findOne({
      where: { streamId: input.streamId, userId, status: 'completed' },
    });
    if (existing) {
      throw new BadRequestException('You already have access to this event');
    }

    if (!this.isBillingEnabled()) {
      throw new BadRequestException('Payments are not enabled');
    }

    return this.paymentProvider.createEventCheckoutSession({
      ...input,
      userId,
      creatorId: stream.userId,
      title: stream.title,
      amountCents: stream.ticketPriceCents,
      currency: 'usd',
    });
  }

  async handleWebhook(payload: Buffer, headers: Record<string, string>) {
    const result = await this.paymentProvider.verifyWebhook(payload, headers);
    if (!result?.handled) return { handled: false };

    let stripeEventId: string | undefined;
    try {
      const parsed = JSON.parse(payload.toString('utf-8')) as { id?: string };
      stripeEventId = parsed.id;
    } catch {
      /* ignore */
    }

    const idempotencyKey =
      stripeEventId ||
      result.sessionId ||
      headers['stripe-idempotency-key'] ||
      headers['x-webhook-id'] ||
      `${result.subscriptionId}:${result.status}`;

    if (idempotencyKey) {
      const duplicate = await this.webhookIdempotency.isDuplicate(
        BillingService.WEBHOOK_PROVIDER,
        idempotencyKey,
      );
      if (duplicate) {
        this.logger.debug(`Webhook already processed: ${idempotencyKey}`);
        return { handled: true, duplicate: true };
      }
    }

    if (result.checkoutType === 'event' && result.status === 'completed') {
      if (result.userId && result.streamId && result.amountCents) {
        await this.grantEventPurchase({
          streamId: result.streamId,
          userId: result.userId,
          amountCents: result.amountCents,
          currency: result.currency ?? 'usd',
          stripeCheckoutSessionId: result.sessionId,
          stripePaymentIntentId: result.paymentIntentId,
        });
      }
    } else if (result.checkoutType === 'super_chat' && result.status === 'completed') {
      if (result.userId && result.streamId && result.amountCents && result.superChatBody) {
        this.eventEmitter.emit('stream.super-chat.paid', {
          streamId: result.streamId,
          userId: result.userId,
          body: result.superChatBody,
          amountCents: result.amountCents,
          stripeCheckoutSessionId: result.sessionId ?? null,
        });
      }
    } else if (
      (result.checkoutType === 'super_chat' || result.checkoutType === 'super_thanks') &&
      (result.status === 'refunded' || result.status === 'disputed')
    ) {
      await this.reverseTipLedger(result.checkoutType, result.sessionId);
    } else if (result.checkoutType === 'super_thanks' && result.status === 'completed') {
      if (result.userId && result.videoId && result.creatorId && result.amountCents != null) {
        await this.recordSuperThanks({
          videoId: result.videoId,
          creatorId: result.creatorId,
          tipperId: result.userId,
          body: result.superChatBody ?? '',
          amountCents: result.amountCents,
          currency: result.currency ?? 'usd',
          stripeCheckoutSessionId: result.sessionId ?? null,
        });
      }
    } else if (result.checkoutType === 'subscription') {
      if (result.status === 'active' && result.subscriptionId) {
        const userId = result.userId;
        const creatorId = result.creatorId;
        const tierId = result.tierId;
        if (userId && creatorId && tierId) {
          await this.entitlementsService.grantSubscription(
            userId,
            {
              creatorId,
              tierId,
              externalSubscriptionId: result.subscriptionId,
              ...(result.communityId ? { communityId: result.communityId } : {}),
            },
            MemberSubscriptionSource.STRIPE,
          );
          if (userId) this.eventEmitter.emit('billing.subscription.created', { userId });
        }
      } else if (result.status === 'trial' && result.subscriptionId) {
        const userId = result.userId;
        const creatorId = result.creatorId;
        const tierId = result.tierId;
        if (userId && creatorId && tierId) {
          await this.entitlementsService.grantSubscription(
            userId,
            {
              creatorId,
              tierId,
              externalSubscriptionId: result.subscriptionId,
              ...(result.communityId ? { communityId: result.communityId } : {}),
            },
            MemberSubscriptionSource.STRIPE,
          );
          await this.entitlementsService.updateSubscriptionStatusByExternalRef(
            result.subscriptionId,
            MemberSubscriptionStatus.TRIAL,
          );
        }
      } else if (result.status === 'renewal_pending' && result.subscriptionId) {
        await this.entitlementsService.updateSubscriptionStatusByExternalRef(
          result.subscriptionId,
          MemberSubscriptionStatus.RENEWAL_PENDING,
        );
      } else if (result.status === 'grace_period' && result.subscriptionId) {
        await this.entitlementsService.updateSubscriptionStatusByExternalRef(
          result.subscriptionId,
          MemberSubscriptionStatus.GRACE_PERIOD,
        );
      } else if (result.status === 'paused' && result.subscriptionId) {
        await this.entitlementsService.updateSubscriptionStatusByExternalRef(
          result.subscriptionId,
          MemberSubscriptionStatus.PAUSED,
        );
      } else if (result.status === 'canceled' && result.subscriptionId) {
        await this.entitlementsService.cancelByExternalRef(result.subscriptionId);
        if (result.userId) this.eventEmitter.emit('billing.subscription.cancelled', { userId: result.userId });
      } else if (result.status === 'failed_payment' && result.subscriptionId) {
        await this.entitlementsService.markSubscriptionFailedPayment(result.subscriptionId);
      } else if (
        (result.status === 'refunded' || result.status === 'disputed') &&
        result.subscriptionId
      ) {
        await this.entitlementsService.markSubscriptionRefunded(result.subscriptionId);
      }

      if (result.periodEndAt && result.subscriptionId) {
        await this.entitlementsService.updateSubscriptionExpiresByExternalRef(
          result.subscriptionId,
          result.periodEndAt,
        );
      }
    }

    if (idempotencyKey) {
      await this.webhookIdempotency.markProcessed(
        BillingService.WEBHOOK_PROVIDER,
        idempotencyKey,
        result.checkoutType ?? result.status,
      );
    }
    return { handled: true };
  }

  /**
   * Reverses a Super Chat/Super Thanks creator payout on refund or dispute.
   * Stripe's destination-charge transfer is not automatically clawed back on
   * refund unless the operator sets `reverse_transfer` — this only fixes
   * FORGE's own ledger (earnings totals/exports) so a refunded tip stops being
   * counted as creator revenue; it does not itself reverse the Stripe transfer.
   */
  private async reverseTipLedger(
    checkoutType: 'super_chat' | 'super_thanks',
    sessionId: string | undefined,
  ): Promise<void> {
    if (!sessionId) {
      this.logger.error(
        `Could not resolve the checkout session for a ${checkoutType} refund/dispute — creator ledger was not reversed`,
      );
      return;
    }
    const refundedAt = new Date();
    if (checkoutType === 'super_chat') {
      const res = await this.streamMessageRepository.update(
        { stripeCheckoutSessionId: sessionId, refundedAt: IsNull() },
        { refundedAt },
      );
      if (!res.affected) {
        this.logger.warn(`No stream_messages row found for refunded/disputed session ${sessionId}`);
      }
      return;
    }
    const res = await this.superThanksRepository.update(
      { stripeCheckoutSessionId: sessionId, refundedAt: IsNull() },
      { refundedAt },
    );
    if (!res.affected) {
      this.logger.warn(`No super_thanks row found for refunded/disputed session ${sessionId}`);
    }
  }

  /**
   * Persist Super Thanks and notify the creator.
   * Idempotent on stripeCheckoutSessionId when present.
   */
  async recordSuperThanks(input: {
    videoId: string;
    creatorId: string;
    tipperId: string;
    body?: string;
    amountCents: number;
    currency?: string;
    stripeCheckoutSessionId?: string | null;
    platformFeePercent?: number;
  }): Promise<SuperThanks> {
    if (input.stripeCheckoutSessionId) {
      const existing = await this.superThanksRepository.findOne({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      });
      if (existing) return existing;
    }

    const feePercent = Math.min(
      100,
      Math.max(
        0,
        input.platformFeePercent ??
          this.configService.get<number>('billing.stripePlatformFeePercent') ??
          10,
      ),
    );
    const platformFeeCents = Math.round((input.amountCents * feePercent) / 100);
    const creatorNetCents = Math.max(0, input.amountCents - platformFeeCents);

    const row = this.superThanksRepository.create({
      videoId: input.videoId,
      creatorId: input.creatorId,
      tipperId: input.tipperId,
      amountCents: input.amountCents,
      platformFeePercent: feePercent,
      platformFeeCents,
      creatorNetCents,
      currency: (input.currency ?? 'usd').slice(0, 3).toLowerCase(),
      body: (input.body ?? '').trim().slice(0, 200) || null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    });
    const saved = await this.superThanksRepository.save(row);

    this.eventEmitter.emit('video.super-thanks.paid', {
      videoId: saved.videoId,
      creatorId: saved.creatorId,
      userId: saved.tipperId,
      body: saved.body ?? '',
      amountCents: saved.amountCents,
      platformFeeCents: saved.platformFeeCents,
      creatorNetCents: saved.creatorNetCents,
      superThanksId: saved.id,
    });

    return saved;
  }

  /** Creator Studio — received Super Thanks ledger + totals. */
  async listReceivedSuperThanks(
    creatorId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const [rows, total] = await this.superThanksRepository.findAndCount({
      where: { creatorId, refundedAt: IsNull() },
      relations: ['tipper', 'video'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const sumRaw = await this.superThanksRepository
      .createQueryBuilder('st')
      .select('COALESCE(SUM(st.amount_cents), 0)', 'sum')
      .addSelect('COALESCE(SUM(st.creator_net_cents), 0)', 'net')
      .addSelect('COALESCE(SUM(st.platform_fee_cents), 0)', 'fee')
      .addSelect('COUNT(*)', 'count')
      .where('st.creator_id = :creatorId', { creatorId })
      .andWhere('st.refunded_at IS NULL')
      .getRawOne<{ sum: string; net: string; fee: string; count: string }>();

    return {
      data: rows.map((r) => ({
        id: r.id,
        videoId: r.videoId,
        videoTitle: r.video?.title ?? null,
        tipperId: r.tipperId,
        tipper: r.tipper
          ? {
              id: r.tipper.id,
              username: r.tipper.username,
              displayName: r.tipper.displayName,
              avatarUrl: r.tipper.avatarUrl ?? null,
            }
          : null,
        amountCents: r.amountCents,
        platformFeePercent: Number(r.platformFeePercent ?? 0),
        platformFeeCents: r.platformFeeCents ?? 0,
        creatorNetCents: r.creatorNetCents ?? r.amountCents,
        currency: r.currency,
        body: r.body,
        createdAt: r.createdAt,
      })),
      summary: {
        totalTips: Number(sumRaw?.count ?? total),
        totalAmountCents: Number(sumRaw?.sum ?? 0),
        totalPlatformFeeCents: Number(sumRaw?.fee ?? 0),
        totalCreatorNetCents: Number(sumRaw?.net ?? 0),
      },
      pagination: { page, limit, total, hasMore: page * limit < total },
    };
  }

  /** Daily Super Thanks totals for Studio payout reconciliation. */
  async summarizeReceivedSuperThanks(creatorId: string, opts: { days?: number } = {}) {
    const days = Math.min(90, Math.max(1, opts.days ?? 30));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const rows = await this.superThanksRepository
      .createQueryBuilder('st')
      .select(`DATE_TRUNC('day', st.created_at)`, 'day')
      .addSelect('COUNT(*)', 'tipCount')
      .addSelect('COALESCE(SUM(st.amount_cents), 0)', 'grossCents')
      .addSelect('COALESCE(SUM(st.platform_fee_cents), 0)', 'feeCents')
      .addSelect('COALESCE(SUM(st.creator_net_cents), 0)', 'netCents')
      .where('st.creator_id = :creatorId', { creatorId })
      .andWhere('st.created_at >= :since', { since })
      .andWhere('st.refunded_at IS NULL')
      .groupBy(`DATE_TRUNC('day', st.created_at)`)
      .orderBy('day', 'DESC')
      .getRawMany<{
        day: Date | string;
        tipCount: string;
        grossCents: string;
        feeCents: string;
        netCents: string;
      }>();

    return {
      days,
      since,
      daysBreakdown: rows.map((r) => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
        tipCount: Number(r.tipCount),
        grossCents: Number(r.grossCents),
        platformFeeCents: Number(r.feeCents),
        creatorNetCents: Number(r.netCents),
      })),
    };
  }

  /** Cap export size so a single download cannot scan unbounded tip history. */
  async exportReceivedSuperThanksCsv(creatorId: string): Promise<string> {
    const rows = await this.superThanksRepository.find({
      where: { creatorId },
      relations: ['tipper', 'video'],
      order: { createdAt: 'DESC' },
      take: 5000,
    });

    return toCsv(
      [
        'id',
        'createdAt',
        'amountCents',
        'platformFeePercent',
        'platformFeeCents',
        'creatorNetCents',
        'currency',
        'videoId',
        'videoTitle',
        'tipperId',
        'tipperUsername',
        'tipperDisplayName',
        'body',
        'stripeCheckoutSessionId',
        'refundedAt',
      ],
      rows.map((r) => [
        r.id,
        r.createdAt?.toISOString?.() ?? r.createdAt,
        r.amountCents,
        r.platformFeePercent ?? 0,
        r.platformFeeCents ?? 0,
        r.creatorNetCents ?? r.amountCents,
        r.currency,
        r.videoId,
        r.video?.title ?? '',
        r.tipperId,
        r.tipper?.username ?? '',
        r.tipper?.displayName ?? '',
        r.body ?? '',
        r.stripeCheckoutSessionId ?? '',
        r.refundedAt?.toISOString?.() ?? '',
      ]),
    );
  }

  async grantEventPurchase(input: {
    streamId: string;
    userId: string;
    amountCents: number;
    currency?: string;
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
  }): Promise<StreamEventPurchase> {
    return this.streamingService.grantEventPurchase({
      ...input,
      grantSource: 'purchase',
    });
  }

  getProviderName(): string {
    return this.paymentProvider.name;
  }

  isBillingEnabled(): boolean {
    const provider = (this.configService.get<string>('billing.provider') || 'stub').toLowerCase();
    return provider === 'stripe' && !!this.configService.get<string>('billing.stripeSecretKey');
  }

  async createBillingPortalSession(userId: string, returnUrl: string, creatorId?: string) {
    if (!this.isBillingEnabled()) {
      throw new BadRequestException('Billing portal requires Stripe billing to be enabled');
    }

    const sub = await this.entitlementsService.findStripeSubscriptionForUser(userId, creatorId);
    if (!sub?.externalRef) {
      throw new NotFoundException('No active Stripe subscription found');
    }

    const provider = this.paymentProvider as PaymentProvider & {
      createBillingPortalSession?: (customerId: string, returnUrl: string) => Promise<{ url: string }>;
    };
    if (!provider.createBillingPortalSession) {
      throw new BadRequestException('Billing portal is not supported by the current provider');
    }

    const customerId = await this.stripeTierSync.getSubscriptionCustomerId(sub.externalRef);
    if (!customerId) {
      throw new BadRequestException('Could not resolve Stripe customer for subscription');
    }

    const session = await provider.createBillingPortalSession(customerId, returnUrl);
    if (!session.url) {
      throw new BadRequestException('Billing portal session could not be created');
    }
    return { url: session.url };
  }
}
