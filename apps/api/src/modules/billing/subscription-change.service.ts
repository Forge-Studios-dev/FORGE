import { BadRequestException, Injectable } from '@nestjs/common';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { BillingService } from './billing.service';

@Injectable()
export class SubscriptionChangeService {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly billingService: BillingService,
  ) {}

  async changeTier(
    userId: string,
    creatorId: string,
    newTierId: string,
  ) {
    if (!this.billingService.isBillingEnabled()) {
      throw new BadRequestException('Tier changes require Stripe billing to be enabled');
    }
    const tier = await this.entitlementsService.getTierById(newTierId);
    if (tier.creatorId !== creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }
    return this.billingService.createCheckout(userId, {
      creatorId,
      tierId: newTierId,
      successUrl: `${process.env.WEB_URL ?? 'http://localhost:3000'}/settings/memberships`,
      cancelUrl: `${process.env.WEB_URL ?? 'http://localhost:3000'}/settings/memberships`,
    });
  }
}
