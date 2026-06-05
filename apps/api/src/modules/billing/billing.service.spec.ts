import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SubscriptionTier } from '../entitlements/entities/subscription-tier.entity';
import {
  MemberSubscription,
  MemberSubscriptionSource,
  MemberSubscriptionStatus,
} from '../entitlements/entities/member-subscription.entity';
import { User } from '../users/entities/user.entity';

describe('BillingService', () => {
  let service: BillingService;
  let paymentProvider: {
    createCheckoutSession: jest.Mock;
    cancelSubscription: jest.Mock;
    verifyWebhook: jest.Mock;
  };
  let entitlementsService: {
    grantSubscription: jest.Mock;
    bustSubscriptionCacheForUser: jest.Mock;
  };
  let tierRepo: { findOne: jest.Mock };
  let subRepo: { findOne: jest.Mock; update: jest.Mock };
  let userRepo: { findOne: jest.Mock; update: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    paymentProvider = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        provider: 'stripe',
        sessionId: 'cs_1',
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
      }),
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
      verifyWebhook: jest.fn(),
    };
    entitlementsService = {
      grantSubscription: jest.fn().mockResolvedValue({ id: 'sub-new' }),
      bustSubscriptionCacheForUser: jest.fn().mockResolvedValue(undefined),
    };
    tierRepo = { findOne: jest.fn() };
    subRepo = { findOne: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com', stripeCustomerId: null }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    configGet = jest.fn((key: string) => {
      const map: Record<string, unknown> = {
        'stripe.enabled': true,
        'mail.webUrl': 'http://localhost:3000',
      };
      return map[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: getRepositoryToken(SubscriptionTier), useValue: tierRepo },
        { provide: getRepositoryToken(MemberSubscription), useValue: subRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  it('rejects checkout when Stripe is disabled', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'stripe.enabled' ? false : 'http://localhost:3000',
    );
    await expect(
      service.createCheckoutSession('u1', { creatorId: 'c1', tierId: 't1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects checkout when tier has no stripePriceId', async () => {
    tierRepo.findOne.mockResolvedValue({
      id: 't1',
      creatorId: 'c1',
      isActive: true,
      stripePriceId: null,
      priceCents: 9900,
    });
    await expect(
      service.createCheckoutSession('u1', { creatorId: 'c1', tierId: 't1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates checkout session for configured paid tier', async () => {
    tierRepo.findOne.mockResolvedValue({
      id: 't1',
      creatorId: 'c1',
      isActive: true,
      stripePriceId: 'price_abc',
      priceCents: 9900,
    });

    const result = await service.createCheckoutSession('u1', {
      creatorId: 'c1',
      tierId: 't1',
    });

    expect(result.checkoutUrl).toContain('stripe.com');
    expect(paymentProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ stripePriceId: 'price_abc', userId: 'u1' }),
    );
  });

  it('skips grantSubscription on duplicate webhook externalRef', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      action: 'activate',
      externalSubscriptionId: 'sub_existing',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
    });
    subRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      externalRef: 'sub_existing',
      status: MemberSubscriptionStatus.ACTIVE,
    });

    await service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(entitlementsService.grantSubscription).not.toHaveBeenCalled();
  });

  it('grants subscription and stores externalRef on first webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      action: 'activate',
      externalSubscriptionId: 'sub_new',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
      stripeCustomerId: 'cus_1',
    });
    subRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-new', status: MemberSubscriptionStatus.ACTIVE });

    await service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(entitlementsService.grantSubscription).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ creatorId: 'c1', tierId: 't1' }),
      MemberSubscriptionSource.PAYMENT,
    );
    expect(subRepo.update).toHaveBeenCalledWith('sub-new', { externalRef: 'sub_new' });
  });

  it('no-ops cancel webhook when subscription already canceled', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      action: 'cancel',
      externalSubscriptionId: 'sub_canceled',
      userId: 'u1',
      creatorId: 'c1',
      status: 'canceled',
    });
    subRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      status: MemberSubscriptionStatus.CANCELED,
      externalRef: 'sub_canceled',
    });

    await service.handleStripeWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(subRepo.update).not.toHaveBeenCalled();
    expect(entitlementsService.bustSubscriptionCacheForUser).not.toHaveBeenCalled();
  });

  it('cancels paid subscription via provider', async () => {
    subRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      externalRef: 'sub_live',
      status: MemberSubscriptionStatus.ACTIVE,
      source: MemberSubscriptionSource.PAYMENT,
    });

    await service.cancelMySubscription('u1', 'c1');

    expect(paymentProvider.cancelSubscription).toHaveBeenCalledWith('sub_live');
    expect(subRepo.update).toHaveBeenCalledWith('sub-1', {
      status: MemberSubscriptionStatus.CANCELED,
    });
    expect(entitlementsService.bustSubscriptionCacheForUser).toHaveBeenCalledWith('u1', 'c1');
  });
});
