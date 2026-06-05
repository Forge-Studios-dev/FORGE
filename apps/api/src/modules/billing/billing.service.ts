import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CheckoutSessionInput,
  PAYMENT_PROVIDER,
  PaymentProvider,
  ProviderWebhookResult,
} from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MemberSubscriptionSource } from '../entitlements/entities/member-subscription.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly processedWebhooks = new Set<string>();

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly entitlementsService: EntitlementsService,
    private readonly configService: ConfigService,
  ) {}

  async createCheckout(userId: string, input: Omit<CheckoutSessionInput, 'userId'>) {
    return this.paymentProvider.createCheckoutSession({ ...input, userId });
  }

  async handleWebhook(payload: Buffer, headers: Record<string, string>) {
    const result = this.paymentProvider.verifyWebhook(payload, headers);
    if (!result?.handled) return { handled: false };

    const idempotencyKey =
      headers['stripe-idempotency-key'] ||
      headers['x-webhook-id'] ||
      `${result.subscriptionId}:${result.status}`;
    if (this.processedWebhooks.has(idempotencyKey)) {
      this.logger.debug(`Webhook already processed: ${idempotencyKey}`);
      return { handled: true, duplicate: true };
    }

    if (result.subscriptionId && result.status === 'active') {
      const meta = JSON.parse(payload.toString('utf8') || '{}') as {
        metadata?: { userId?: string; creatorId?: string; tierId?: string };
      };
      const userId = meta.metadata?.userId;
      const creatorId = meta.metadata?.creatorId;
      const tierId = meta.metadata?.tierId;
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

    this.processedWebhooks.add(idempotencyKey);
    return { handled: true };
  }

  getProviderName(): string {
    return this.paymentProvider.name;
  }

  isBillingEnabled(): boolean {
    const provider = (this.configService.get<string>('billing.provider') || 'stub').toLowerCase();
    return provider === 'stripe' && !!this.configService.get<string>('billing.stripeSecretKey');
  }
}
