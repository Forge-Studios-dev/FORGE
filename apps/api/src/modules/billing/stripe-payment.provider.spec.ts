import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from './stripe-payment.provider';

const constructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn() } },
    subscriptions: { cancel: jest.fn() },
    webhooks: { constructEvent },
  }));
});

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(async () => {
    constructEvent.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripePaymentProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                'stripe.secretKey': 'sk_test_abc',
                'stripe.webhookSecret': 'whsec_test',
              };
              return map[key] ?? '';
            }),
          },
        },
      ],
    }).compile();

    provider = module.get(StripePaymentProvider);
  });

  it('verifyWebhook returns null without stripe-signature header', () => {
    expect(provider.verifyWebhook(Buffer.from('{}'), {})).toBeNull();
  });

  it('verifyWebhook returns null on invalid signature', () => {
    constructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    expect(
      provider.verifyWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' }),
    ).toBeNull();
  });

  it('maps checkout.session.completed to activate action', () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_123',
          metadata: { userId: 'u1', creatorId: 'c1', tierId: 't1' },
          customer: 'cus_123',
        },
      },
    });

    const result = provider.verifyWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });
    expect(result).toMatchObject({
      handled: true,
      action: 'activate',
      externalSubscriptionId: 'sub_123',
      userId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
      stripeCustomerId: 'cus_123',
    });
  });

  it('maps customer.subscription.deleted to cancel action', () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_456',
          metadata: { userId: 'u1', creatorId: 'c1' },
        },
      },
    });

    const result = provider.verifyWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });
    expect(result).toMatchObject({
      handled: true,
      action: 'cancel',
      externalSubscriptionId: 'sub_456',
      status: 'canceled',
    });
  });

  it('maps customer.subscription.updated active status to activate', () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_789',
          status: 'active',
          metadata: { userId: 'u1', creatorId: 'c1', tierId: 't1' },
          customer: 'cus_789',
          current_period_end: 1_700_000_000,
        },
      },
    });

    const result = provider.verifyWebhook(Buffer.from('{}'), { 'stripe-signature': 'sig' });
    expect(result).toMatchObject({
      action: 'activate',
      externalSubscriptionId: 'sub_789',
      status: 'active',
    });
  });
});
