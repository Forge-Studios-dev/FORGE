import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CheckoutSessionInput,
  CheckoutSessionResult,
  EventCheckoutSessionInput,
  SuperChatCheckoutInput,
  PaymentProvider,
  ProviderWebhookResult,
  UpdateSubscriptionTierInput,
  UpdateSubscriptionTierResult,
} from './payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  private client(): Stripe {
    if (!this.stripe) {
      const key = this.secretKey();
      if (!key) {
        throw new NotImplementedException('Stripe is not configured. Set STRIPE_SECRET_KEY.');
      }
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  private secretKey(): string | null {
    const key = this.configService.get<string>('billing.stripeSecretKey')?.trim();
    return key || null;
  }

  private webhookSecret(): string | null {
    const key = this.configService.get<string>('billing.stripeWebhookSecret')?.trim();
    return key || null;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = input.stripePriceId
      ? { price: input.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency,
            product_data: { name: input.tierName ?? 'FORGE membership' },
            unit_amount: input.priceCents ?? 0,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        };

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        userId: input.userId,
        creatorId: input.creatorId,
        tierId: input.tierId,
        type: 'subscription',
      },
      ...(input.trialDays && input.trialDays > 0
        ? { trial_period_days: input.trialDays }
        : {}),
      ...(input.connectAccountId
        ? {
            transfer_data: { destination: input.connectAccountId },
            ...(input.platformFeePercent && input.platformFeePercent > 0
              ? { application_fee_percent: input.platformFeePercent }
              : {}),
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [lineItem],
      subscription_data: subscriptionData,
      metadata: {
        userId: input.userId,
        creatorId: input.creatorId,
        tierId: input.tierId,
        type: 'subscription',
      },
    });
    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async createEventCheckoutSession(input: EventCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: input.title || 'Live event ticket' },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: input.userId,
        streamId: input.streamId,
        creatorId: input.creatorId,
        type: 'stream_event',
      },
    });
    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async createSuperChatCheckoutSession(input: SuperChatCheckoutInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Super Chat' },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: input.userId,
        streamId: input.streamId,
        creatorId: input.creatorId,
        type: 'super_chat',
        messageBody: input.body.slice(0, 200),
      },
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

  async updateSubscriptionTier(
    input: UpdateSubscriptionTierInput,
  ): Promise<UpdateSubscriptionTierResult> {
    const stripe = this.client();
    const subscription = await stripe.subscriptions.retrieve(input.externalSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      throw new NotImplementedException('Subscription has no line items');
    }
    const updated = await stripe.subscriptions.update(input.externalSubscriptionId, {
      items: [{ id: itemId, price: input.stripePriceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...subscription.metadata, tierId: input.tierId },
    });
    return { subscriptionId: updated.id, prorationApplied: true };
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const stripe = this.client();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url ?? '' };
  }

  verifyWebhook(payload: Buffer, headers: Record<string, string>): ProviderWebhookResult | null {
    const secret = this.webhookSecret();
    if (!secret || !this.secretKey()) return null;

    const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
    if (!signature) return null;

    let event: Stripe.Event;
    try {
      event = this.client().webhooks.constructEvent(payload, signature, secret);
    } catch {
      return null;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata ?? {};
      if (meta.type === 'stream_event' && meta.userId && meta.streamId) {
        return {
          handled: true,
          checkoutType: 'event',
          status: 'completed',
          sessionId: session.id,
          userId: meta.userId,
          streamId: meta.streamId,
          amountCents: session.amount_total ?? undefined,
          currency: session.currency ?? 'usd',
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        };
      }
      if (meta.type === 'super_chat' && meta.userId && meta.streamId && meta.messageBody) {
        return {
          handled: true,
          checkoutType: 'super_chat',
          status: 'completed',
          sessionId: session.id,
          userId: meta.userId,
          streamId: meta.streamId,
          amountCents: session.amount_total ?? undefined,
          currency: session.currency ?? 'usd',
          superChatBody: meta.messageBody,
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        };
      }
      if (meta.type === 'subscription' && session.subscription) {
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        return {
          handled: true,
          checkoutType: 'subscription',
          subscriptionId: subId,
          status: 'active',
          sessionId: session.id,
          userId: meta.userId,
          creatorId: meta.creatorId,
          tierId: meta.tierId,
        };
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subId) return { handled: false };
      const periodEnd = invoice.lines?.data?.[0]?.period?.end;
      return {
        handled: true,
        checkoutType: 'subscription',
        subscriptionId: subId,
        status: 'active',
        periodEndAt: periodEnd ? new Date(periodEnd * 1000) : undefined,
      };
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata ?? {};
      return {
        handled: true,
        checkoutType: 'subscription',
        subscriptionId: sub.id,
        status: 'canceled',
        userId: meta.userId,
        creatorId: meta.creatorId,
        tierId: meta.tierId,
      };
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata ?? {};
      let status: ProviderWebhookResult['status'] = 'active';
      if (sub.status === 'trialing') status = 'trial';
      else if (sub.status === 'past_due') status = 'grace_period';
      else if (sub.status === 'paused') status = 'paused';
      else if (sub.status === 'canceled' || sub.status === 'unpaid') status = 'canceled';
      else if (sub.status === 'active') status = 'active';
      return {
        handled: true,
        checkoutType: 'subscription',
        subscriptionId: sub.id,
        status,
        userId: meta.userId,
        creatorId: meta.creatorId,
        tierId: meta.tierId,
        periodEndAt: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : undefined,
      };
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subId) return { handled: false };
      return {
        handled: true,
        checkoutType: 'subscription',
        subscriptionId: subId,
        status: 'failed_payment',
      };
    }

    return { handled: false };
  }
}
