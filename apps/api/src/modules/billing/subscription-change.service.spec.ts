import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionChangeService } from './subscription-change.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { BillingService } from './billing.service';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MemberSubscriptionSource } from '../entitlements/entities/member-subscription.entity';

describe('SubscriptionChangeService', () => {
  let service: SubscriptionChangeService;

  const entitlementsService = {
    getTierById: jest.fn(),
    getActiveSubscription: jest.fn(),
    updateTierStripeIds: jest.fn(),
    changeSubscriptionTier: jest.fn(),
  };
  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
  };
  const billingService = {
    isBillingEnabled: jest.fn().mockReturnValue(true),
    createCheckout: jest.fn(),
  };
  const stripeTierSync = {
    syncTier: jest.fn(),
  };
  const paymentProvider = {
    updateSubscriptionTier: jest.fn().mockResolvedValue({
      subscriptionId: 'sub_123',
      prorationApplied: true,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    engagementService.isBlockedEitherWay.mockResolvedValue(false);
    entitlementsService.getTierById.mockResolvedValue({
      id: 'tier-new',
      creatorId: 'creator-1',
      stripePriceId: 'price_new',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionChangeService,
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: EngagementService, useValue: engagementService },
        { provide: BillingService, useValue: billingService },
        { provide: StripeTierSyncService, useValue: stripeTierSync },
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
      ],
    }).compile();

    service = module.get(SubscriptionChangeService);
  });

  it('updates subscription in-place when Stripe sub exists', async () => {
    entitlementsService.getActiveSubscription.mockResolvedValue({
      id: 'sub-local',
      externalRef: 'sub_stripe',
      source: MemberSubscriptionSource.STRIPE,
    });

    const result = await service.changeTier('user-1', 'creator-1', 'tier-new');

    expect(paymentProvider.updateSubscriptionTier).toHaveBeenCalledWith({
      externalSubscriptionId: 'sub_stripe',
      stripePriceId: 'price_new',
      tierId: 'tier-new',
    });
    expect(entitlementsService.changeSubscriptionTier).toHaveBeenCalledWith('sub-local', 'tier-new');
    expect(result).toMatchObject({ changed: true, tierId: 'tier-new' });
  });

  it('falls back to checkout when no active Stripe subscription', async () => {
    entitlementsService.getActiveSubscription.mockResolvedValue(null);
    billingService.createCheckout.mockResolvedValue({ checkoutUrl: 'https://stripe.test' });

    await service.changeTier('user-1', 'creator-1', 'tier-new');

    expect(billingService.createCheckout).toHaveBeenCalled();
    expect(paymentProvider.updateSubscriptionTier).not.toHaveBeenCalled();
  });
});
