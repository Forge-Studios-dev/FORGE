import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { ConfigService } from '@nestjs/config';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';
import { Video, VideoStatus } from '../content/entities/video.entity';
import { SuperThanks } from './entities/super-thanks.entity';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';
import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { StreamingService } from '../streaming/streaming.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { StripeConnectService } from './stripe-connect.service';
import { MemberSubscriptionStatus } from '../entitlements/entities/member-subscription.entity';

describe('BillingService', () => {
  let service: BillingService;
  const eventEmitter = { emit: jest.fn() };
  const streamingService = {
    grantEventPurchase: jest.fn(),
    revokeEventPurchaseByPaymentIntent: jest.fn(),
  };
  const webhookIdempotency = {
    isDuplicate: jest.fn(),
    tryAcquire: jest.fn(),
    release: jest.fn(),
    markProcessed: jest.fn(),
  };
  const paymentProvider = {
    name: 'stub',
    createCheckoutSession: jest.fn(),
    createEventCheckoutSession: jest.fn(),
    createSuperChatCheckoutSession: jest.fn(),
    createSuperThanksCheckoutSession: jest.fn(),
    createProgramCheckoutSession: jest.fn(),
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
    changeSubscriptionTier: jest.fn(),
  };
  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
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
  const videoRepository = {
    findOne: jest.fn(),
  };
  const superThanksRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (row) => ({ id: 'st1', ...row, createdAt: new Date() })),
    create: jest.fn((dto) => dto),
    findAndCount: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  };
  const streamMessageRepository = {
    update: jest.fn(),
  };

  const baseProviders = () => [
    BillingService,
    { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
    { provide: EntitlementsService, useValue: entitlementsService },
    { provide: EngagementService, useValue: engagementService },
    { provide: WebhookIdempotencyService, useValue: webhookIdempotency },
    { provide: getRepositoryToken(StreamEventPurchase), useValue: purchaseRepository },
    { provide: getRepositoryToken(Stream), useValue: streamRepository },
    { provide: getRepositoryToken(Video), useValue: videoRepository },
    { provide: getRepositoryToken(SuperThanks), useValue: superThanksRepository },
    { provide: getRepositoryToken(StreamMessage), useValue: streamMessageRepository },
    { provide: StreamingService, useValue: streamingService },
    { provide: EventEmitter2, useValue: eventEmitter },
    { provide: StripeTierSyncService, useValue: stripeTierSync },
    { provide: StripeConnectService, useValue: stripeConnectService },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    engagementService.isBlockedEitherWay.mockResolvedValue(false);
    webhookIdempotency.isDuplicate.mockResolvedValue(false);
    webhookIdempotency.tryAcquire.mockResolvedValue(true);
    webhookIdempotency.release.mockResolvedValue(undefined);
    entitlementsService.getSubscriptionByExternalRef.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
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
    webhookIdempotency.tryAcquire.mockResolvedValue(false);
    await service.handleWebhook(payload, { 'x-webhook-id': 'evt_1' });

    expect(entitlementsService.grantSubscription).toHaveBeenCalledTimes(1);
  });

  it('does not re-grant (duplicate row) on a routine renewal webhook for an already-active subscription', async () => {
    entitlementsService.getSubscriptionByExternalRef.mockResolvedValue({
      id: 'sub-row-1',
      tierId: 't1',
      userId: 'u1',
      creatorId: 'c1',
    });
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_1',
      status: 'active',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'x-webhook-id': 'evt_renewal' });

    expect(entitlementsService.grantSubscription).not.toHaveBeenCalled();
    expect(entitlementsService.changeSubscriptionTier).not.toHaveBeenCalled();
  });

  it('updates the existing row in place (no new row) when a webhook reports a tier change', async () => {
    entitlementsService.getSubscriptionByExternalRef.mockResolvedValue({
      id: 'sub-row-1',
      tierId: 't1',
      userId: 'u1',
      creatorId: 'c1',
    });
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_1',
      status: 'active',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't2',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'x-webhook-id': 'evt_tier_change' });

    expect(entitlementsService.changeSubscriptionTier).toHaveBeenCalledWith('sub-row-1', 't2');
    expect(entitlementsService.grantSubscription).not.toHaveBeenCalled();
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

  it('emits program.purchase.completed on paid program checkout webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'program',
      status: 'completed',
      userId: 'u1',
      programId: 'prog-1',
      sessionId: 'sess_prog',
      amountCents: 2500,
      currency: 'usd',
    });
    webhookIdempotency.isDuplicate.mockResolvedValue(false);

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'program.purchase.completed',
      expect.objectContaining({
        userId: 'u1',
        programId: 'prog-1',
        amountCents: 2500,
        stripeCheckoutSessionId: 'sess_prog',
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

  it('revokes ticket access on a refunded paid-event charge webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'event',
      status: 'refunded',
      paymentIntentId: 'pi_4',
      userId: 'u4',
      streamId: 's4',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(streamingService.revokeEventPurchaseByPaymentIntent).toHaveBeenCalledWith('pi_4');
  });

  it('emits program.purchase.revoked on refunded program charge webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'program',
      status: 'refunded',
      paymentIntentId: 'pi_prog',
      userId: 'u1',
      programId: 'prog-1',
    });
    webhookIdempotency.isDuplicate.mockResolvedValue(false);

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'program.purchase.revoked',
      expect.objectContaining({
        paymentIntentId: 'pi_prog',
        programId: 'prog-1',
        userId: 'u1',
      }),
    );
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

  it('reverses the Super Chat ledger on a refunded webhook by checkout session id', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'super_chat',
      status: 'refunded',
      sessionId: 'cs_1',
      userId: 'u1',
      creatorId: 'c1',
    });
    streamMessageRepository.update.mockResolvedValue({ affected: 1 });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(streamMessageRepository.update).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: 'cs_1', refundedAt: expect.anything() },
      { refundedAt: expect.any(Date) },
    );
  });

  it('reverses the Super Thanks ledger on a disputed webhook by checkout session id', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'super_thanks',
      status: 'disputed',
      sessionId: 'cs_2',
      userId: 'u2',
      creatorId: 'c2',
    });
    superThanksRepository.update.mockResolvedValue({ affected: 1 });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(superThanksRepository.update).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: 'cs_2', refundedAt: expect.anything() },
      { refundedAt: expect.any(Date) },
    );
  });

  it('logs and skips the ledger reversal when no checkout session could be resolved', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'super_chat',
      status: 'refunded',
      sessionId: undefined,
      userId: 'u1',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(streamMessageRepository.update).not.toHaveBeenCalled();
  });

  it('emits Super Thanks immediately when Stripe billing is off', async () => {
    const stubModule = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'billing.provider') return 'stub';
              return '';
            },
          },
        },
      ],
    }).compile();
    const stubService = stubModule.get(BillingService);
    videoRepository.findOne.mockResolvedValue({
      id: 'v1',
      userId: 'creator1',
      status: VideoStatus.READY,
    });

    const result = await stubService.createSuperThanksCheckout('fan1', {
      videoId: 'v1',
      amountCents: 200,
      body: 'Great video',
    });

    expect(result).toEqual(
      expect.objectContaining({ tipped: true, requiresCheckout: false, amountCents: 200 }),
    );
    expect(superThanksRepository.save).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'video.super-thanks.paid',
      expect.objectContaining({
        videoId: 'v1',
        creatorId: 'creator1',
        userId: 'fan1',
        amountCents: 200,
        body: 'Great video',
      }),
    );
  });

  it('rejects Super Thanks when tipper is blocked either way', async () => {
    videoRepository.findOne.mockResolvedValue({
      id: 'v1',
      userId: 'creator1',
      status: VideoStatus.READY,
    });
    engagementService.isBlockedEitherWay.mockResolvedValueOnce(true);

    await expect(
      service.createSuperThanksCheckout('fan1', {
        videoId: 'v1',
        amountCents: 200,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(superThanksRepository.save).not.toHaveBeenCalled();
  });

  it('routes Super Chat through the creator Stripe Connect account with a platform fee', async () => {
    streamRepository.findOne.mockResolvedValue({ id: 's1', userId: 'creator1' });
    paymentProvider.createSuperChatCheckoutSession.mockResolvedValue({
      provider: 'stripe',
      sessionId: 'cs_sc1',
      checkoutUrl: 'https://checkout.stripe.com/cs_sc1',
    });

    await service.createSuperChatCheckout('fan1', {
      streamId: 's1',
      body: 'Great stream',
      amountCents: 500,
      successUrl: 'https://x/success',
      cancelUrl: 'https://x/cancel',
    });

    expect(stripeConnectService.getConnectStatus).toHaveBeenCalledWith('creator1');
    expect(paymentProvider.createSuperChatCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'fan1',
        streamId: 's1',
        creatorId: 'creator1',
        amountCents: 500,
        connectAccountId: 'acct_test',
      }),
    );
  });

  it('rejects Super Chat when the creator has not completed Stripe Connect onboarding', async () => {
    streamRepository.findOne.mockResolvedValue({ id: 's1', userId: 'creator1' });
    stripeConnectService.getConnectStatus.mockResolvedValueOnce({ chargesEnabled: false });

    await expect(
      service.createSuperChatCheckout('fan1', {
        streamId: 's1',
        body: 'Great stream',
        amountCents: 500,
        successUrl: 'https://x/success',
        cancelUrl: 'https://x/cancel',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentProvider.createSuperChatCheckoutSession).not.toHaveBeenCalled();
  });

  it('emits Super Thanks from completed Stripe webhook', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'super_thanks',
      status: 'completed',
      userId: 'fan1',
      videoId: 'v1',
      creatorId: 'creator1',
      amountCents: 500,
      superChatBody: 'Thanks!',
      sessionId: 'cs_thanks',
    });

    await service.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(superThanksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCheckoutSessionId: 'cs_thanks',
        amountCents: 500,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'video.super-thanks.paid',
      expect.objectContaining({
        videoId: 'v1',
        creatorId: 'creator1',
        userId: 'fan1',
        amountCents: 500,
        body: 'Thanks!',
      }),
    );
  });

  it('skips duplicate Super Thanks when Stripe session already recorded', async () => {
    superThanksRepository.findOne.mockResolvedValue({
      id: 'existing',
      stripeCheckoutSessionId: 'cs_thanks',
    });

    const row = await service.recordSuperThanks({
      videoId: 'v1',
      creatorId: 'creator1',
      tipperId: 'fan1',
      amountCents: 500,
      stripeCheckoutSessionId: 'cs_thanks',
    });

    expect(row.id).toBe('existing');
    expect(superThanksRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('exports Super Thanks CSV for the creator', async () => {
    superThanksRepository.find.mockResolvedValue([
      {
        id: 'st1',
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
        amountCents: 200,
        platformFeePercent: 10,
        platformFeeCents: 20,
        creatorNetCents: 180,
        currency: 'usd',
        videoId: 'v1',
        video: { title: 'Demo' },
        tipperId: 'fan1',
        tipper: { username: 'fan', displayName: 'Fan' },
        body: 'Nice!',
        stripeCheckoutSessionId: null,
      },
    ]);

    const csv = await service.exportReceivedSuperThanksCsv('creator1');

    expect(csv.split('\n')[0]).toContain('creatorNetCents');
    expect(csv).toContain('Demo');
    expect(csv).toContain('180');
    expect(superThanksRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { creatorId: 'creator1' }, take: 5000 }),
    );
  });

  it('summarizes Super Thanks by day for reconciliation', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          day: new Date('2026-08-01T00:00:00.000Z'),
          tipCount: '2',
          grossCents: '700',
          feeCents: '70',
          netCents: '630',
        },
      ]),
    };
    superThanksRepository.createQueryBuilder.mockReturnValue(qb);

    const summary = await service.summarizeReceivedSuperThanks('creator1', { days: 30 });

    expect(summary.days).toBe(30);
    expect(summary.daysBreakdown).toEqual([
      {
        day: '2026-08-01',
        tipCount: 2,
        grossCents: 700,
        platformFeeCents: 70,
        creatorNetCents: 630,
      },
    ]);
    expect(superThanksRepository.createQueryBuilder).toHaveBeenCalledWith('st');
  });

  it('snapshots platform fee when recording Super Thanks', async () => {
    const stubModule = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'billing.provider') return 'stub';
              if (key === 'billing.stripePlatformFeePercent') return 10;
              return '';
            },
          },
        },
      ],
    }).compile();
    const stubService = stubModule.get(BillingService);

    await stubService.recordSuperThanks({
      videoId: 'v1',
      creatorId: 'creator1',
      tipperId: 'fan1',
      amountCents: 1000,
      body: 'tip',
    });

    expect(superThanksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1000,
        platformFeePercent: 10,
        platformFeeCents: 100,
        creatorNetCents: 900,
      }),
    );
  });

  it('uses the fee percent baked into the webhook payload over a since-changed live config', async () => {
    // Live config now says 25%, but the webhook result carries the 10% that
    // was actually applied to the Stripe charge at checkout time — the ledger
    // must match what Stripe transferred, not whatever the config drifted to.
    const stubModule = await Test.createTestingModule({
      providers: [
        ...baseProviders(),
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'billing.provider') return 'stub';
              if (key === 'billing.stripePlatformFeePercent') return 25;
              return '';
            },
          },
        },
      ],
    }).compile();
    const stubService = stubModule.get(BillingService);
    superThanksRepository.findOne.mockResolvedValue(null);
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      checkoutType: 'super_thanks',
      status: 'completed',
      userId: 'fan1',
      videoId: 'v1',
      creatorId: 'creator1',
      amountCents: 1000,
      superChatBody: 'Thanks!',
      sessionId: 'cs_drift',
      platformFeePercent: 10,
    });

    await stubService.handleWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });

    expect(superThanksRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 1000,
        platformFeePercent: 10,
        platformFeeCents: 100,
        creatorNetCents: 900,
      }),
    );
  });
});
