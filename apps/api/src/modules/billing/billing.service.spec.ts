import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ConfigService } from '@nestjs/config';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';
import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { StreamingService } from '../streaming/streaming.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { StripeConnectService } from './stripe-connect.service';
import { MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';

describe('BillingService', () => {
  let service: BillingService;
  const streamingService = {
    grantEventPurchase: jest.fn(),
  };
  const webhookIdempotency = {
    isDuplicate: jest.fn(),
    markProcessed: jest.fn(),
  };
  const paymentProvider = {
    name: 'stub',
    createCheckoutSession: jest.fn(),
    createEventCheckoutSession: jest.fn(),
    createSuperChatCheckoutSession: jest.fn(),
    cancelSubscription: jest.fn(),
    verifyWebhook: jest.fn(),
  };
  const entitlementsService = {
    grantSubscription: jest.fn(),
    getTierById: jest.fn(),
    updateTierStripeIds: jest.fn(),
    cancelByExternalRef: jest.fn(),
    markSubscriptionFailedPayment: jest.fn(),
    markSubscriptionRefunded: jest.fn(),
    updateSubscriptionStatusByExternalRef: jest.fn(),
    getSubscriptionByExternalRef: jest.fn().mockResolvedValue(null),
  };
  const stripeTierSync = {
    isEnabled: jest.fn().mockReturnValue(false),
    syncTier: jest.fn(),
    cancelSubscription: jest.fn(),
  };
  const stripeConnectService = {
    getConnectStatus: jest.fn().mockResolvedValue({
      chargesEnabled: true,
      accountId: 'acct_test',
    }),
  };
  const purchaseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto) => dto),
  };
  const streamRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    webhookIdempotency.isDuplicate.mockResolvedValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: WebhookIdempotencyService, useValue: webhookIdempotency },
        { provide: getRepositoryToken(StreamEventPurchase), useValue: purchaseRepository },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: StreamingService, useValue: streamingService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: StripeTierSyncService, useValue: stripeTierSync },
        { provide: StripeConnectService, useValue: stripeConnectService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'billing.provider') return 'stripe';
              if (key === 'billing.stripeSecretKey') return 'sk_test';
              return '';
            },
          },
        },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  it('deduplicates webhook processing', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_1',
      status: 'active',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
      sessionId: 'sess_1',
    });

    const payload = Buffer.from(
      JSON.stringify({
        data: { object: { metadata: { userId: 'u1', creatorId: 'c1', tierId: 't1' } } },
      }),
    );

    await service.handleWebhook(payload, { 'x-webhook-id': 'evt_1' });
    webhookIdempotency.isDuplicate.mockResolvedValue(true);
    await service.handleWebhook(payload, { 'x-webhook-id': 'evt_1' });

    expect(entitlementsService.grantSubscription).toHaveBeenCalledTimes(1);
  });

  it('grants event purchase on completed checkout webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'event',
      status: 'completed',
      userId: 'u1',
      streamId: 's1',
      sessionId: 'sess_evt',
      amountCents: 999,
      currency: 'usd',
    });
    purchaseRepository.findOne.mockResolvedValue(null);
    streamingService.grantEventPurchase.mockResolvedValue({
      streamId: 's1',
      userId: 'u1',
      amountCents: 999,
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(streamingService.grantEventPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        streamId: 's1',
        userId: 'u1',
        amountCents: 999,
        grantSource: 'purchase',
      }),
    );
  });

  it('rejects duplicate event purchase checkout', async () => {
    streamRepository.findOne.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      visibility: StreamVisibility.PAID_EVENT,
      ticketPriceCents: 500,
      title: 'Workshop',
    });
    purchaseRepository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createEventCheckout('u1', {
        streamId: 's1',
        successUrl: 'https://x/s',
        cancelUrl: 'https://x/c',
      }),
    ).rejects.toThrow('already have access');
  });

  it('marks subscription renewal_pending on invoice.upcoming webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_renewal',
      status: 'renewal_pending',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(entitlementsService.updateSubscriptionStatusByExternalRef).toHaveBeenCalledWith(
      'sub_renewal',
      MemberSubscriptionStatus.RENEWAL_PENDING,
    );
  });

  it('delegates subscription cancel webhook to entitlements', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_cancel',
      status: 'canceled',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(entitlementsService.cancelByExternalRef).toHaveBeenCalledWith('sub_cancel');
  });
});
