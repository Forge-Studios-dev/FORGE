import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CheckoutSessionInput,
  CheckoutSessionResult,
  EventCheckoutSessionInput,
  ProgramCheckoutSessionInput,
  SuperChatCheckoutInput,
  SuperThanksCheckoutInput,
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

  private subscriptionMetadata(
    input: CheckoutSessionInput,
    type: string,
  ): Stripe.MetadataParam {
    const meta: Stripe.MetadataParam = {
      userId: input.userId,
      creatorId: input.creatorId,
      tierId: input.tierId,
      type,
    };
    if (input.communityId) meta.communityId = input.communityId;
    return meta;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();
    const isLifetime = input.billingInterval === 'lifetime';

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = input.stripePriceId
      ? { price: input.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency,
            product_data: { name: input.tierName ?? 'FORGE membership' },
            unit_amount: input.priceCents ?? 0,
            ...(isLifetime ? {} : { recurring: { interval: 'month' } }),
          },
          quantity: 1,
        };

    if (isLifetime) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: [lineItem],
        metadata: this.subscriptionMetadata(input, 'lifetime_subscription'),
        ...(input.connectAccountId
          ? {
              payment_intent_data: {
                transfer_data: { destination: input.connectAccountId },
                ...(input.platformFeePercent && input.platformFeePercent > 0
                  ? {
                      application_fee_amount: Math.round(
                        ((input.priceCents ?? 0) * input.platformFeePercent) / 100,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      });
      return {
        provider: this.name,
        sessionId: session.id,
        checkoutUrl: session.url,
      };
    }

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: this.subscriptionMetadata(input, 'subscription'),
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
      metadata: this.subscriptionMetadata(input, 'subscription'),
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
    const feePercent = input.platformFeePercent ?? 0;
    const applicationFeeAmount =
      input.connectAccountId && feePercent > 0
        ? Math.round((input.amountCents * feePercent) / 100)
        : 0;
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
        platformFeePercent: String(feePercent),
        platformFeeCents: String(applicationFeeAmount),
      },
      payment_intent_data: {
        // Checkout Session metadata does not propagate to the charge — only
        // payment_intent_data.metadata does, and charge.refunded/dispute.created
        // webhooks only see the charge. Without this, a refunded Super Chat is
        // unmatchable and the creator's ledger is never reversed.
        metadata: {
          userId: input.userId,
          streamId: input.streamId,
          creatorId: input.creatorId,
          type: 'super_chat',
        },
        ...(input.connectAccountId
          ? {
              transfer_data: { destination: input.connectAccountId },
              ...(applicationFeeAmount > 0
                ? { application_fee_amount: applicationFeeAmount }
                : {}),
            }
          : {}),
      },
    });
    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async createSuperThanksCheckoutSession(input: SuperThanksCheckoutInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();
    const feePercent = input.platformFeePercent ?? 0;
    const applicationFeeAmount =
      input.connectAccountId && feePercent > 0
        ? Math.round((input.amountCents * feePercent) / 100)
        : 0;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Super Thanks' },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: input.userId,
        videoId: input.videoId,
        creatorId: input.creatorId,
        type: 'super_thanks',
        messageBody: input.body.slice(0, 200),
        platformFeePercent: String(feePercent),
        platformFeeCents: String(applicationFeeAmount),
      },
      payment_intent_data: {
        metadata: {
          userId: input.userId,
          videoId: input.videoId,
          creatorId: input.creatorId,
          type: 'super_thanks',
        },
        ...(input.connectAccountId
          ? {
              transfer_data: { destination: input.connectAccountId },
              ...(applicationFeeAmount > 0
                ? { application_fee_amount: applicationFeeAmount }
                : {}),
            }
          : {}),
      },
    });
    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async createProgramCheckoutSession(input: ProgramCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = this.client();
    const currency = (input.currency ?? 'usd').toLowerCase();
    const feePercent = input.platformFeePercent ?? 0;
    const applicationFeeAmount =
      input.connectAccountId && feePercent > 0
        ? Math.round((input.amountCents * feePercent) / 100)
        : 0;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: input.title || 'Learning program' },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: input.userId,
        programId: input.programId,
        creatorId: input.creatorId,
        type: 'program',
        platformFeePercent: String(feePercent),
        platformFeeCents: String(applicationFeeAmount),
      },
      payment_intent_data: {
        metadata: {
          userId: input.userId,
          programId: input.programId,
          creatorId: input.creatorId,
          type: 'program',
        },
        ...(input.connectAccountId
          ? {
              transfer_data: { destination: input.connectAccountId },
              ...(applicationFeeAmount > 0
                ? { application_fee_amount: applicationFeeAmount }
                : {}),
            }
          : {}),
      },
    });
    return {
      provider: this.name,
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async cancelSubscription(externalSubscriptionId: string, cancelAtPeriodEnd = false): Promise<void> {
    const stripe = this.client();
    if (cancelAtPeriodEnd) {
      await stripe.subscriptions.update(externalSubscriptionId, { cancel_at_period_end: true });
      return;
    }
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

  async verifyWebhook(payload: Buffer, headers: Record<string, string>): Promise<ProviderWebhookResult | null> {
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
      if (meta.type === 'program' && meta.userId && meta.programId) {
        return {
          handled: true,
          checkoutType: 'program',
          status: 'completed',
          sessionId: session.id,
          userId: meta.userId,
          programId: meta.programId,
          creatorId: meta.creatorId,
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
          // Reuse the fee split baked into the charge at checkout time (see the
          // comment on createSuperChatCheckoutSession) rather than re-deriving
          // from the live config, which may have changed by webhook time.
          platformFeePercent: meta.platformFeePercent ? Number(meta.platformFeePercent) : undefined,
          platformFeeCents: meta.platformFeeCents ? Number(meta.platformFeeCents) : undefined,
        };
      }
      if (meta.type === 'super_thanks' && meta.userId && meta.videoId && meta.creatorId) {
        return {
          handled: true,
          checkoutType: 'super_thanks',
          status: 'completed',
          sessionId: session.id,
          userId: meta.userId,
          videoId: meta.videoId,
          creatorId: meta.creatorId,
          amountCents: session.amount_total ?? undefined,
          currency: session.currency ?? 'usd',
          superChatBody: meta.messageBody || '',
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
          platformFeePercent: meta.platformFeePercent ? Number(meta.platformFeePercent) : undefined,
          platformFeeCents: meta.platformFeeCents ? Number(meta.platformFeeCents) : undefined,
        };
      }
      if (meta.type === 'lifetime_subscription' && meta.userId && meta.creatorId && meta.tierId) {
        return {
          handled: true,
          checkoutType: 'subscription',
          status: 'active',
          sessionId: session.id,
          userId: meta.userId,
          creatorId: meta.creatorId,
          tierId: meta.tierId,
          communityId: meta.communityId || undefined,
          subscriptionId:
            typeof session.payment_intent === 'string'
              ? `lifetime:${session.payment_intent}`
              : session.payment_intent?.id
                ? `lifetime:${session.payment_intent.id}`
                : `lifetime:${session.id}`,
        };
      }
      if (meta.type === 'subscription' && session.subscription) {
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        let status: ProviderWebhookResult['status'] = 'active';
        try {
          const sub = await this.client().subscriptions.retrieve(subId);
          if (sub.status === 'trialing') status = 'trial';
        } catch {
          /* default active */
        }
        return {
          handled: true,
          checkoutType: 'subscription',
          subscriptionId: subId,
          status,
          sessionId: session.id,
          userId: meta.userId,
          creatorId: meta.creatorId,
          tierId: meta.tierId,
          communityId: meta.communityId || undefined,
        };
      }
    }

    if (event.type === 'invoice.upcoming') {
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
        status: 'renewal_pending',
      };
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
        communityId: meta.communityId || undefined,
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
        communityId: meta.communityId || undefined,
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

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      return this.resolveChargeReversal(charge, 'refunded');
    }

    if (event.type === 'charge.dispute.created') {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
      if (!chargeId) return { handled: false };
      let charge: Stripe.Charge;
      try {
        charge = await this.client().charges.retrieve(chargeId);
      } catch {
        return { handled: false };
      }
      return this.resolveChargeReversal(charge, 'disputed');
    }

    return { handled: false };
  }

  /**
   * Shared refund/dispute resolution. Checkout Session metadata never reaches
   * the charge — only `payment_intent_data.metadata` does — so this depends on
   * `create{SuperChat,SuperThanks}CheckoutSession` setting it there. Without a
   * type-specific branch here, a refunded tip's `charge.metadata.userId` would
   * fall through to the generic subscription-refund case below and silently
   * mis-tag the reversal.
   */
  private async resolveChargeReversal(
    charge: Stripe.Charge,
    status: 'refunded' | 'disputed',
  ): Promise<ProviderWebhookResult> {
    const meta = charge.metadata ?? {};

    if (meta.type === 'stream_event') {
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      return {
        handled: true,
        checkoutType: 'event',
        status,
        paymentIntentId,
        userId: meta.userId,
        streamId: meta.streamId,
      };
    }

    if (meta.type === 'program') {
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      return {
        handled: true,
        checkoutType: 'program',
        status,
        paymentIntentId,
        userId: meta.userId,
        programId: meta.programId,
        creatorId: meta.creatorId,
      };
    }

    if (meta.type === 'super_chat' || meta.type === 'super_thanks') {
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      let sessionId: string | undefined;
      if (paymentIntentId) {
        try {
          const sessions = await this.client().checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          });
          sessionId = sessions.data[0]?.id;
        } catch {
          /* best-effort — ledger reversal falls back to unmatched if this fails */
        }
      }
      return {
        handled: true,
        checkoutType: meta.type,
        status,
        sessionId,
        userId: meta.userId,
        creatorId: meta.creatorId,
      };
    }

    let subId: string | undefined;
    const invoice = charge.invoice;
    if (typeof invoice === 'object' && invoice && 'subscription' in invoice) {
      const sub = (invoice as Stripe.Invoice).subscription;
      subId = typeof sub === 'string' ? sub : sub?.id;
    }
    if (subId || meta.userId) {
      return {
        handled: true,
        checkoutType: 'subscription',
        subscriptionId: subId,
        status,
        userId: meta.userId,
        creatorId: meta.creatorId,
        tierId: meta.tierId,
      };
    }
    return { handled: false };
  }
}
