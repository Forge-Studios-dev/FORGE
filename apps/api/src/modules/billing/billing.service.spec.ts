import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ConfigService } from '@nestjs/config';

describe('BillingService', () => {
  let service: BillingService;
  const paymentProvider = {
    name: 'stub',
    createCheckoutSession: jest.fn(),
    cancelSubscription: jest.fn(),
    verifyWebhook: jest.fn(),
  };
  const entitlementsService = {
    grantSubscription: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PAYMENT_PROVIDER, useValue: paymentProvider },
        { provide: EntitlementsService, useValue: entitlementsService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'billing.provider' ? 'stub' : '') },
        },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  it('deduplicates webhook processing', async () => {
    paymentProvider.verifyWebhook.mockReturnValue({
      handled: true,
      subscriptionId: 'sub_1',
      status: 'active',
    });

    const payload = Buffer.from(
      JSON.stringify({
        metadata: { userId: 'u1', creatorId: 'c1', tierId: 't1' },
      }),
    );

    await service.handleWebhook(payload, { 'x-webhook-id': 'evt_1' });
    await service.handleWebhook(payload, { 'x-webhook-id': 'evt_1' });

    expect(entitlementsService.grantSubscription).toHaveBeenCalledTimes(1);
  });
});
