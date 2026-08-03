/**
 * HIGH-01: proves the checkout webhook -> entitlement-grant seam actually works.
 * Real BillingController -> BillingService -> EntitlementsService chain; only
 * Stripe verification and TypeORM repositories are mocked (per forge-testing.md,
 * no live DB/Redis). A regression that breaks the webhook-to-access-grant path
 * fails this test, unlike the existing per-service specs which test each side
 * of the seam in isolation.
 */
import {
  ClassSerializerInterceptor,
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ClsService } from 'nestjs-cls';
import request from 'supertest';
import { UsersService } from '../src/modules/users/users.service';
import { BillingController } from '../src/modules/billing/billing.controller';
import { BillingService } from '../src/modules/billing/billing.service';
import { StripeConnectService } from '../src/modules/billing/stripe-connect.service';
import { StripeTierSyncService } from '../src/modules/billing/stripe-tier-sync.service';
import { SubscriptionChangeService } from '../src/modules/billing/subscription-change.service';
import { PAYMENT_PROVIDER } from '../src/modules/billing/payment-provider.interface';
import { WebhookIdempotencyService } from '../src/common/webhooks/webhook-idempotency.service';
import { EntitlementsService } from '../src/modules/entitlements/entitlements.service';
import { EntitlementsAnalyticsService } from '../src/modules/entitlements/entitlements-analytics.service';
import { SubscriptionTier } from '../src/modules/entitlements/entities/subscription-tier.entity';
import {
  MemberSubscription,
  MemberSubscriptionSource,
  MemberSubscriptionStatus,
} from '../src/modules/entitlements/entities/member-subscription.entity';
import { TierEntitlement } from '../src/modules/entitlements/entities/tier-entitlement.entity';
import { StreamEventPurchase } from '../src/modules/streaming/entities/stream-event-purchase.entity';
import { Stream } from '../src/modules/streaming/entities/stream.entity';
import { StreamingService } from '../src/modules/streaming/streaming.service';
import { EngagementService } from '../src/modules/engagement/engagement.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Video } from '../src/modules/content/entities/video.entity';
import { SuperThanks } from '../src/modules/billing/entities/super-thanks.entity';
import { DataSource } from 'typeorm';

const USER_ID = 'user-1';
const CREATOR_ID = 'creator-1';
const TIER_ID = 'tier-1';
const SUBSCRIPTION_ID = 'stripe-sub-1';

describe('POST /billing/webhook -> entitlement grant (HIGH-01)', () => {
  let app: INestApplication;
  let verifyWebhook: jest.Mock;
  let savedSubscription: Record<string, unknown> | undefined;

  const tierRepository = {
    findOne: jest.fn().mockResolvedValue({ id: TIER_ID, creatorId: CREATOR_ID, sortOrder: 1 }),
  };

  const subscriptionRepository = {
    findOne: jest.fn(
      async ({
        where,
      }: {
        where: { id: string };
      }): Promise<Record<string, unknown> | null> =>
        savedSubscription && where.id === savedSubscription.id
          ? { ...savedSubscription, tier: undefined }
          : null,
    ),
    save: jest.fn(),
  };

  const chainableQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };

  const fakeManager = {
    createQueryBuilder: jest.fn(() => chainableQueryBuilder),
    create: jest.fn((_entity: unknown, obj: Record<string, unknown>) => obj),
    save: jest.fn(async (obj: Record<string, unknown>) => {
      savedSubscription = { id: 'sub-1', createdAt: new Date(), ...obj };
      return savedSubscription;
    }),
  };

  const dataSource = {
    transaction: jest.fn(async (work: (manager: typeof fakeManager) => Promise<unknown>) =>
      work(fakeManager),
    ),
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn(),
    del: jest.fn(),
  };

  beforeAll(async () => {
    verifyWebhook = jest.fn();
    savedSubscription = undefined;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        EntitlementsService,
        { provide: PAYMENT_PROVIDER, useValue: { verifyWebhook } },
        { provide: getRepositoryToken(SubscriptionTier), useValue: tierRepository },
        { provide: getRepositoryToken(MemberSubscription), useValue: subscriptionRepository },
        { provide: getRepositoryToken(StreamEventPurchase), useValue: {} },
        { provide: getRepositoryToken(TierEntitlement), useValue: {} },
        { provide: getRepositoryToken(Stream), useValue: {} },
        { provide: getRepositoryToken(Video), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(SuperThanks), useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: getRedisConnectionToken(), useValue: redis },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: WebhookIdempotencyService, useValue: { isDuplicate: jest.fn().mockResolvedValue(false), markProcessed: jest.fn() } },
        { provide: StreamingService, useValue: {} },
        { provide: StripeTierSyncService, useValue: {} },
        { provide: StripeConnectService, useValue: {} },
        { provide: SubscriptionChangeService, useValue: {} },
        { provide: EngagementService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: EntitlementsAnalyticsService,
          useValue: {
            listSubscribersForCreator: jest.fn().mockResolvedValue([]),
            exportSubscribersCsv: jest.fn().mockResolvedValue(''),
            getSubscriberAnalytics: jest.fn().mockResolvedValue({
              active: 0,
              trial: 0,
              canceled: 0,
              total: 0,
              mrrCents: 0,
              byStatus: {},
            }),
          },
        },
        // Webhook route isn't guarded, but CreatorApprovedGuard is referenced via
        // @UseGuards on other controller routes, so Nest still constructs it at module
        // init — it's never invoked for /billing/webhook, so stub constructor deps.
        { provide: UsersService, useValue: {} },
        { provide: ClsService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'metrics', method: RequestMethod.ALL }] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformInterceptor(),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('grants an active subscription (real entitlement-unlock) when Stripe reports checkout.session.completed -> active subscription', async () => {
    verifyWebhook.mockResolvedValue({
      handled: true,
      checkoutType: 'subscription',
      status: 'active',
      userId: USER_ID,
      creatorId: CREATOR_ID,
      tierId: TIER_ID,
      subscriptionId: SUBSCRIPTION_ID,
      sessionId: 'cs_test_1',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .send({ id: 'evt_test_1', type: 'checkout.session.completed' })
      .expect(201);

    expect(res.body.data).toEqual({ handled: true });

    // The seam: a webhook hitting the real controller/service chain must leave
    // behind an ACTIVE subscription record — that's what "entitlement unlock" means.
    expect(savedSubscription).toMatchObject({
      userId: USER_ID,
      creatorId: CREATOR_ID,
      tierId: TIER_ID,
      status: MemberSubscriptionStatus.ACTIVE,
      source: MemberSubscriptionSource.STRIPE,
      externalRef: SUBSCRIPTION_ID,
    });

    // And it's readable back through the same path an access-check would use.
    const stored = await subscriptionRepository.findOne({ where: { id: 'sub-1' } });
    expect(stored?.status).toBe(MemberSubscriptionStatus.ACTIVE);
  });

  it('does not grant a subscription when Stripe reports an unhandled/irrelevant event', async () => {
    savedSubscription = undefined;
    verifyWebhook.mockResolvedValue({ handled: false });

    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .send({ id: 'evt_test_2', type: 'ping' })
      .expect(201);

    expect(res.body.data).toEqual({ handled: false });
    expect(savedSubscription).toBeUndefined();
  });
});
