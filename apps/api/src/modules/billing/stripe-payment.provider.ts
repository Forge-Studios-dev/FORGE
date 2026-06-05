import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  ProviderWebhookResult,
} from './payment-provider.interface';

type StripeClient = InstanceType<typeof Stripe>;
type StripeWebhookEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: StripeClient | null;

  constructor(private readonly configService: ConfigService) {
    const secretKey = configService.get<string>('stripe.secretKey') || '';
    this.stripe = secretKey.length > 0 ? new Stripe(secretKey) : null;
  }

  private client(): StripeClient {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
    return this.stripe;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const priceId = input.stripePriceId;
    if (!priceId) {
      throw new BadRequestException('Tier is not linked to a Stripe price');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      metadata: {
        userId: input.userId,
        creatorId: input.creatorId,
        tierId: input.tierId,
      },
      subscription_data: {
        metadata: {
          userId: input.userId,
          creatorId: input.creatorId,
          tierId: input.tierId,
        },
      },
      ...(input.stripeCustomerId
        ? { customer: input.stripeCustomerId }
        : { customer_email: input.customerEmail }),
    });

    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    const stripe = this.client();
    await stripe.subscriptions.cancel(externalSubscriptionId);
  }

  verifyWebhook(payload: Buffer, headers: Record<string, string>): ProviderWebhookResult | null {
    const stripe = this.client();
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret') || '';
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — rejecting webhook');
      return null;
    }

    const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
    if (!signature) return null;

    let event: StripeWebhookEvent;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature invalid: ${(err as Error).message}`);
      return null;
    }

    return this.mapEvent(event);
  }

  private mapEvent(event: StripeWebhookEvent): ProviderWebhookResult | null {
    const payload = event.data.object as unknown;
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = payload as {
          mode?: string;
          subscription?: string | { id?: string };
          metadata?: Record<string, string>;
          customer?: string | { id?: string };
        };
        if (session.mode !== 'subscription') return { handled: true };
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        return {
          handled: true,
          action: 'activate',
          externalSubscriptionId: subId ?? undefined,
          userId: session.metadata?.userId,
          creatorId: session.metadata?.creatorId,
          tierId: session.metadata?.tierId,
          stripeCustomerId:
            typeof session.customer === 'string' ? session.customer : session.customer?.id,
        };
      }
      case 'customer.subscription.updated': {
        const sub = payload as {
          id: string;
          status: string;
          metadata?: Record<string, string>;
          customer?: string | { id?: string };
          current_period_end?: number;
        };
        const status = this.mapStripeStatus(sub.status);
        return {
          handled: true,
          action: status === 'active' ? 'activate' : 'cancel',
          externalSubscriptionId: sub.id,
          userId: sub.metadata?.userId,
          creatorId: sub.metadata?.creatorId,
          tierId: sub.metadata?.tierId,
          status,
          stripeCustomerId:
            typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : undefined,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = payload as {
          id: string;
          metadata?: Record<string, string>;
        };
        return {
          handled: true,
          action: 'cancel',
          externalSubscriptionId: sub.id,
          userId: sub.metadata?.userId,
          creatorId: sub.metadata?.creatorId,
          status: 'canceled',
        };
      }
      default:
        return { handled: true };
    }
  }

  private mapStripeStatus(status: string): 'active' | 'canceled' | 'expired' | undefined {
    if (status === 'active' || status === 'trialing') return 'active';
    if (status === 'canceled') return 'canceled';
    if (status === 'unpaid' || status === 'past_due' || status === 'incomplete_expired') {
      return 'expired';
    }
    return undefined;
  }
}
