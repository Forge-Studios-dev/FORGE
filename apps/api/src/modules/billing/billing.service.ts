import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CheckoutSessionInput,
  EventCheckoutSessionInput,
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MemberSubscriptionSource, MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';
import { StreamingService } from '../streaming/streaming.service';

import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private static readonly WEBHOOK_PROVIDER = 'stripe';

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly entitlementsService: EntitlementsService,
    private readonly configService: ConfigService,
    private readonly webhookIdempotency: WebhookIdempotencyService,
    @InjectRepository(StreamEventPurchase)
    private readonly purchaseRepository: Repository<StreamEventPurchase>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @Inject(forwardRef(() => StreamingService))
    private readonly streamingService: StreamingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stripeTierSync: StripeTierSyncService,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  async createCheckout(userId: string, input: Omit<CheckoutSessionInput, 'userId'>) {
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

    if (!this.isBillingEnabled()) {
      throw new BadRequestException('Payments are not enabled');
    }

    return this.paymentProvider.createSuperChatCheckoutSession({
      userId,
      streamId: input.streamId,
      creatorId: stream.userId,
      body: input.body,
      amountCents: input.amountCents,
      currency: 'usd',
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
  }

  async createEventCheckout(
    userId: string,
    input: Pick<EventCheckoutSessionInput, 'streamId' | 'successUrl' | 'cancelUrl'>,
  ) {
    const stream = await this.streamRepository.findOne({ where: { id: input.streamId } });
    if (!stream) throw new BadRequestException('Stream not found');
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
      } else if (result.status === 'refunded' && result.subscriptionId) {
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
