import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingInterval, SubscriptionTier } from '../entitlements/entities/subscription-tier.entity';

@Injectable()
export class StripeTierSyncService {
  private readonly logger = new Logger(StripeTierSyncService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    const provider = (this.configService.get<string>('billing.provider') || 'stub').toLowerCase();
    return provider === 'stripe' && !!this.configService.get<string>('billing.stripeSecretKey');
  }

  private client(): Stripe | null {
    if (!this.isEnabled()) return null;
    if (!this.stripe) {
      const key = this.configService.get<string>('billing.stripeSecretKey')?.trim();
      if (!key) return null;
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  private intervalToStripe(interval: BillingInterval): Stripe.Price.Recurring.Interval {
    if (interval === BillingInterval.YEARLY) return 'year';
    if (interval === BillingInterval.QUARTERLY) return 'month';
    return 'month';
  }

  private intervalCount(interval: BillingInterval): number {
    if (interval === BillingInterval.QUARTERLY) return 3;
    return 1;
  }

  async syncTier(tier: SubscriptionTier): Promise<{ productId: string; priceId: string } | null> {
    const stripe = this.client();
    if (!stripe) return null;

    let productId = tier.stripeProductId;
    if (!productId) {
      const product = await stripe.products.create({
        name: tier.name,
        metadata: { tierId: tier.id, creatorId: tier.creatorId },
      });
      productId = product.id;
    } else {
      await stripe.products.update(productId, { name: tier.name, active: tier.isActive });
    }

    const currency = (tier.currency || 'usd').toLowerCase();
    const recurring =
      tier.billingInterval === BillingInterval.LIFETIME
        ? undefined
        : {
            interval: this.intervalToStripe(tier.billingInterval),
            interval_count: this.intervalCount(tier.billingInterval),
          };

    const price = await stripe.prices.create({
      product: productId,
      currency,
      unit_amount: tier.priceCents,
      ...(recurring ? { recurring } : {}),
      metadata: { tierId: tier.id, creatorId: tier.creatorId },
    });

    if (tier.stripePriceId && tier.stripePriceId !== price.id) {
      try {
        await stripe.prices.update(tier.stripePriceId, { active: false });
      } catch (err) {
        this.logger.warn(`Could not deactivate old Stripe price ${tier.stripePriceId}: ${err}`);
      }
    }

    return { productId, priceId: price.id };
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    const stripe = this.client();
    if (!stripe) return;
    await stripe.subscriptions.cancel(externalSubscriptionId);
  }
}
