import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from './stripe-payment.provider';

const constructEvent = jest.fn();
const sessionsList = jest.fn();
const chargesRetrieve = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent },
    checkout: { sessions: { list: sessionsList } },
    charges: { retrieve: chargesRetrieve },
  })),
);

describe('StripePaymentProvider — refund/dispute reversal', () => {
  let provider: StripePaymentProvider;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripePaymentProvider,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                'billing.stripeSecretKey': 'sk_test',
                'billing.stripeWebhookSecret': 'whsec_test',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();
    provider = module.get(StripePaymentProvider);
  });

  const headers = { 'stripe-signature': 'sig' };

  it('tags a refunded Super Chat charge by its payment_intent_data metadata, not the generic subscription branch', async () => {
    constructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: {
        object: {
          metadata: { type: 'super_chat', userId: 'u1', creatorId: 'c1', streamId: 's1' },
          payment_intent: 'pi_1',
          invoice: null,
        },
      },
    });
    sessionsList.mockResolvedValue({ data: [{ id: 'cs_1' }] });

    const result = await provider.verifyWebhook(Buffer.from('{}'), headers);

    expect(result).toMatchObject({
      handled: true,
      checkoutType: 'super_chat',
      status: 'refunded',
      sessionId: 'cs_1',
      userId: 'u1',
    });
    expect(sessionsList).toHaveBeenCalledWith({ payment_intent: 'pi_1', limit: 1 });
  });

  it('tags a disputed Super Thanks charge by retrieving the charge from the dispute', async () => {
    constructEvent.mockReturnValue({
      type: 'charge.dispute.created',
      data: {
        object: { charge: 'ch_1' },
      },
    });
    chargesRetrieve.mockResolvedValue({
      metadata: { type: 'super_thanks', userId: 'u2', creatorId: 'c2' },
      payment_intent: 'pi_2',
      invoice: null,
    });
    sessionsList.mockResolvedValue({ data: [{ id: 'cs_2' }] });

    const result = await provider.verifyWebhook(Buffer.from('{}'), headers);

    expect(chargesRetrieve).toHaveBeenCalledWith('ch_1');
    expect(result).toMatchObject({
      handled: true,
      checkoutType: 'super_thanks',
      status: 'disputed',
      sessionId: 'cs_2',
      userId: 'u2',
    });
  });

  it('still resolves a subscription refund when charge metadata has no tip type', async () => {
    constructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: {
        object: {
          metadata: { userId: 'u3', creatorId: 'c3', tierId: 't1' },
          payment_intent: 'pi_3',
          invoice: { subscription: 'sub_1' },
        },
      },
    });

    const result = await provider.verifyWebhook(Buffer.from('{}'), headers);

    expect(result).toMatchObject({
      handled: true,
      checkoutType: 'subscription',
      subscriptionId: 'sub_1',
      status: 'refunded',
    });
    expect(sessionsList).not.toHaveBeenCalled();
  });

  it('embeds tip metadata in payment_intent_data so refunds are matchable at the charge level', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cs_new', url: 'https://checkout.stripe.com/cs_new' });
    // @ts-expect-error — reach into the lazily-constructed Stripe client for this assertion
    provider['stripe'] = { checkout: { sessions: { create } } };

    await provider.createSuperChatCheckoutSession({
      userId: 'u1',
      streamId: 's1',
      creatorId: 'c1',
      body: 'hi',
      amountCents: 500,
      successUrl: 'https://x/success',
      cancelUrl: 'https://x/cancel',
      connectAccountId: 'acct_1',
      platformFeePercent: 10,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({ type: 'super_chat', userId: 'u1', streamId: 's1' }),
        }),
      }),
    );
  });
});
