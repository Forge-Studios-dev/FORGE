import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingInterval, SubscriptionTier } from '../entitlements/entities/subscription-tier.entity';
import { StripeTierSyncService } from './stripe-tier-sync.service';

const productsCreate = jest.fn();
const productsUpdate = jest.fn();
const pricesCreate = jest.fn();
const pricesUpdate = jest.fn();
const subscriptionsUpdate = jest.fn();
const subscriptionsCancel = jest.fn();
const subscriptionsRetrieve = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    products: { create: productsCreate, update: productsUpdate },
    prices: { create: pricesCreate, update: pricesUpdate },
    subscriptions: {
      update: subscriptionsUpdate,
      cancel: subscriptionsCancel,
      retrieve: subscriptionsRetrieve,
    },
  })),
);

describe('StripeTierSyncService', () => {
  let service: StripeTierSyncService;
  let configGet: jest.Mock;

  const baseTier = (): SubscriptionTier =>
    ({
      id: 'tier-1',
      creatorId: 'creator-1',
      name: 'Pro',
      slug: 'pro',
      priceCents: 999,
      currency: 'usd',
      isActive: true,
      stripeProductId: null,
      stripePriceId: null,
      billingInterval: BillingInterval.MONTHLY,
    }) as SubscriptionTier;

  async function createService(provider = 'stripe', stripeKey = 'sk_test') {
    configGet = jest.fn((key: string) => {
      if (key === 'billing.provider') return provider;
      if (key === 'billing.stripeSecretKey') return stripeKey;
      return undefined;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeTierSyncService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();
    return module.get(StripeTierSyncService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    productsCreate.mockResolvedValue({ id: 'prod_new' });
    productsUpdate.mockResolvedValue({ id: 'prod_existing' });
    pricesCreate.mockResolvedValue({ id: 'price_new' });
    pricesUpdate.mockResolvedValue({ id: 'price_old', active: false });
    subscriptionsRetrieve.mockResolvedValue({ customer: 'cus_123' });
    service = await createService();
  });

  describe('isEnabled', () => {
    it('is disabled for stub billing provider', async () => {
      const stubService = await createService('stub', 'sk_test');
      expect(stubService.isEnabled()).toBe(false);
    });

    it('is disabled without stripe secret key', async () => {
      const noKeyService = await createService('stripe', '');
      expect(noKeyService.isEnabled()).toBe(false);
    });

    it('is enabled for stripe provider with secret key', () => {
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('syncTier', () => {
    it('returns null when stripe is disabled', async () => {
      const stubService = await createService('stub');
      await expect(stubService.syncTier(baseTier())).resolves.toBeNull();
      expect(productsCreate).not.toHaveBeenCalled();
    });

    it('creates a Stripe product when tier has no product id', async () => {
      const tier = baseTier();
      const result = await service.syncTier(tier);
      expect(productsCreate).toHaveBeenCalledWith({
        name: 'Pro',
        metadata: { tierId: 'tier-1', creatorId: 'creator-1' },
      });
      expect(result).toEqual({ productId: 'prod_new', priceId: 'price_new' });
    });

    it('updates existing Stripe product when product id is present', async () => {
      const tier = { ...baseTier(), stripeProductId: 'prod_existing' };
      await service.syncTier(tier);
      expect(productsUpdate).toHaveBeenCalledWith('prod_existing', {
        name: 'Pro',
        active: true,
      });
      expect(productsCreate).not.toHaveBeenCalled();
    });

    it('creates monthly recurring price', async () => {
      await service.syncTier(baseTier());
      expect(pricesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'prod_new',
          currency: 'usd',
          unit_amount: 999,
          recurring: { interval: 'month', interval_count: 1 },
        }),
      );
    });

    it('creates quarterly recurring price with 3-month interval', async () => {
      const tier = { ...baseTier(), billingInterval: BillingInterval.QUARTERLY };
      await service.syncTier(tier);
      expect(pricesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: { interval: 'month', interval_count: 3 },
        }),
      );
    });

    it('creates yearly recurring price', async () => {
      const tier = { ...baseTier(), billingInterval: BillingInterval.YEARLY };
      await service.syncTier(tier);
      expect(pricesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: { interval: 'year', interval_count: 1 },
        }),
      );
    });

    it('creates one-time price for lifetime tiers', async () => {
      const tier = { ...baseTier(), billingInterval: BillingInterval.LIFETIME };
      await service.syncTier(tier);
      expect(pricesCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          recurring: expect.anything(),
        }),
      );
    });

    it('deactivates previous Stripe price when price id changes', async () => {
      const tier = { ...baseTier(), stripeProductId: 'prod_existing', stripePriceId: 'price_old' };
      await service.syncTier(tier);
      expect(pricesUpdate).toHaveBeenCalledWith('price_old', { active: false });
    });

    it('still returns new price when old price deactivation fails', async () => {
      pricesUpdate.mockRejectedValueOnce(new Error('price not found'));
      const tier = { ...baseTier(), stripeProductId: 'prod_existing', stripePriceId: 'price_old' };
      const result = await service.syncTier(tier);
      expect(result).toEqual({ productId: 'prod_existing', priceId: 'price_new' });
    });
  });

  describe('cancelSubscription', () => {
    it('no-ops when stripe is disabled', async () => {
      const stubService = await createService('stub');
      await stubService.cancelSubscription('sub_1');
      expect(subscriptionsCancel).not.toHaveBeenCalled();
    });

    it('schedules cancel at period end', async () => {
      await service.cancelSubscription('sub_1', true);
      expect(subscriptionsUpdate).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true });
      expect(subscriptionsCancel).not.toHaveBeenCalled();
    });

    it('cancels immediately by default', async () => {
      await service.cancelSubscription('sub_1');
      expect(subscriptionsCancel).toHaveBeenCalledWith('sub_1');
    });
  });

  describe('getSubscriptionCustomerId', () => {
    it('returns null when stripe is disabled', async () => {
      const stubService = await createService('stub');
      await expect(stubService.getSubscriptionCustomerId('sub_1')).resolves.toBeNull();
    });

    it('returns customer id from subscription', async () => {
      await expect(service.getSubscriptionCustomerId('sub_1')).resolves.toBe('cus_123');
    });

    it('returns null when subscription lookup fails', async () => {
      subscriptionsRetrieve.mockRejectedValueOnce(new Error('not found'));
      await expect(service.getSubscriptionCustomerId('sub_missing')).resolves.toBeNull();
    });
  });
});
