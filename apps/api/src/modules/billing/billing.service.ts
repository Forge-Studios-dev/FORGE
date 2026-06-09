import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
import { MemberSubscriptionSource } from '../entitlements/entities/member-subscription.entity';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';
import { StreamingService } from '../streaming/streaming.service';

import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';

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
  ) {}

  async createCheckout(userId: string, input: Omit<CheckoutSessionInput, 'userId'>) {
    return this.paymentProvider.createCheckoutSession({ ...input, userId });
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
    const result = this.paymentProvider.verifyWebhook(payload, headers);
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
    } else if (result.subscriptionId && result.status === 'active') {
      const meta = JSON.parse(payload.toString('utf8') || '{}') as {
        data?: { object?: { metadata?: { userId?: string; creatorId?: string; tierId?: string } } };
      };
      const sessionMeta = meta.data?.object?.metadata;
      const userId = result.userId ?? sessionMeta?.userId;
      const creatorId = sessionMeta?.creatorId;
      const tierId = sessionMeta?.tierId;
      if (userId && creatorId && tierId) {
        await this.entitlementsService.grantSubscription(
          userId,
          {
            creatorId,
            tierId,
            externalSubscriptionId: result.subscriptionId,
          },
          MemberSubscriptionSource.STRIPE,
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
}
