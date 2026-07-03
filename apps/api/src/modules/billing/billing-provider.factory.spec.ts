import { ConfigService } from '@nestjs/config';
import { billingProviderFactory } from './billing.module';
import { StubPaymentProvider } from './stub-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';

describe('billingProviderFactory', () => {
  const stub = { name: 'stub' } as StubPaymentProvider;
  const stripe = { name: 'stripe' } as StripePaymentProvider;

  const makeConfig = (values: Record<string, unknown>): ConfigService =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('defaults to stub when mock subscriptions are enabled (dev)', () => {
    const provider = billingProviderFactory(
      makeConfig({ 'entitlements.mockSubscriptionsEnabled': true }),
      stub,
      stripe,
    );
    expect(provider).toBe(stub);
  });

  it('allows stub in staging (NODE_ENV=production but mock subscriptions enabled)', () => {
    const provider = billingProviderFactory(
      makeConfig({
        nodeEnv: 'production',
        'entitlements.mockSubscriptionsEnabled': true,
      }),
      stub,
      stripe,
    );
    expect(provider).toBe(stub);
  });

  it('returns stripe when explicitly selected', () => {
    const provider = billingProviderFactory(
      makeConfig({
        'entitlements.mockSubscriptionsEnabled': true,
        'billing.provider': 'stripe',
      }),
      stub,
      stripe,
    );
    expect(provider).toBe(stripe);
  });

  it('refuses to boot with stub provider in real production (default)', () => {
    expect(() =>
      billingProviderFactory(
        makeConfig({ nodeEnv: 'production', 'entitlements.mockSubscriptionsEnabled': false }),
        stub,
        stripe,
      ),
    ).toThrow(/stub payments are not allowed in production/i);
  });

  it('refuses to boot with explicit stub provider in real production', () => {
    expect(() =>
      billingProviderFactory(
        makeConfig({
          nodeEnv: 'production',
          'entitlements.mockSubscriptionsEnabled': false,
          'billing.provider': 'stub',
        }),
        stub,
        stripe,
      ),
    ).toThrow(/not allowed in production/i);
  });

  it('boots with stripe provider but missing secret key — warns, does not throw', () => {
    // Factory warns instead of throwing; StripePaymentProvider.client() throws at call time.
    const provider = billingProviderFactory(
      makeConfig({
        nodeEnv: 'production',
        'entitlements.mockSubscriptionsEnabled': false,
        'billing.provider': 'stripe',
        'billing.stripeSecretKey': '   ',
      }),
      stub,
      stripe,
    );
    expect(provider).toBe(stripe);
  });

  it('boots with stripe provider and secret key in real production', () => {
    const provider = billingProviderFactory(
      makeConfig({
        nodeEnv: 'production',
        'entitlements.mockSubscriptionsEnabled': false,
        'billing.provider': 'stripe',
        'billing.stripeSecretKey': 'sk_live_123',
      }),
      stub,
      stripe,
    );
    expect(provider).toBe(stripe);
  });
});
