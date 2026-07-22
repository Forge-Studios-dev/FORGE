import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { MemberSubscriptionSource } from '../entitlements/entities/member-subscription.entity';

@Injectable()
export class SubscriptionChangeService {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly billingService: BillingService,
    private readonly stripeTierSync: StripeTierSyncService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async changeTier(userId: string, creatorId: string, newTierId: string) {
    if (!this.billingService.isBillingEnabled()) {
      throw new BadRequestException('Tier changes require Stripe billing to be enabled');
    }
    const tier = await this.entitlementsService.getTierById(newTierId);
    if (tier.creatorId !== creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }

    const existing = await this.entitlementsService.getActiveSubscription(userId, creatorId);
    if (
      existing?.externalRef &&
      existing.source === MemberSubscriptionSource.STRIPE &&
      this.paymentProvider.updateSubscriptionTier
    ) {
      let stripePriceId = tier.stripePriceId;
      if (!stripePriceId) {
        const synced = await this.stripeTierSync.syncTier(tier);
        if (synced) {
          await this.entitlementsService.updateTierStripeIds(tier.id, synced.productId, synced.priceId);
          stripePriceId = synced.priceId;
        }
      }
      if (!stripePriceId) {
        throw new BadRequestException('Tier is not synced to Stripe');
      }

      const result = await this.paymentProvider.updateSubscriptionTier({
        externalSubscriptionId: existing.externalRef,
        stripePriceId,
        tierId: newTierId,
      });

      await this.entitlementsService.changeSubscriptionTier(existing.id, newTierId);

      return {
        changed: true,
        subscriptionId: result.subscriptionId,
        tierId: newTierId,
        prorationApplied: result.prorationApplied,
      };
    }

    return this.billingService.createCheckout(userId, {
      creatorId,
      tierId: newTierId,
      // billing_return marker lets the client fire billing.checkout_returned
      // on the way back in, instead of having no signal that this was a
      // Stripe redirect round-trip at all.
      successUrl: `${process.env.WEB_URL ?? 'http://localhost:3000'}/settings/memberships?billing_return=1`,
      cancelUrl: `${process.env.WEB_URL ?? 'http://localhost:3000'}/settings/memberships`,
    });
  }
}
