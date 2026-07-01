import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { StubPaymentProvider } from './stub-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream } from '../streaming/entities/stream.entity';

const billingProviderLogger = new Logger('BillingProvider');

/**
 * Selects the active payment provider, failing fast on unsafe real-production config.
 *
 * The stub provider fakes successful payments (granting paid entitlements without
 * charging), so it must NEVER run in real production. The stub is only permitted
 * where mock subscriptions are enabled (`entitlements.mockSubscriptionsEnabled` —
 * true in dev and in staging via MOCK_SUBSCRIPTIONS_ENABLED=true). In real
 * production that flag is false, so we require BILLING_PROVIDER=stripe with a
 * secret key and refuse to boot otherwise rather than silently bypass billing.
 */
export function billingProviderFactory(
  config: ConfigService,
  stub: StubPaymentProvider,
  stripe: StripePaymentProvider,
): PaymentProvider {
  const provider = (config.get<string>('billing.provider') || 'stub').toLowerCase();
  // Stub billing is paired with mock subscriptions; both represent a non-real
  // money environment (dev/staging). Real production has this flag disabled.
  const stubAllowed = config.get<boolean>('entitlements.mockSubscriptionsEnabled') === true;

  if (!stubAllowed) {
    if (provider !== 'stripe') {
      throw new Error(
        `Unsafe billing configuration: BILLING_PROVIDER="${provider}" with real billing enabled. ` +
          'Set BILLING_PROVIDER=stripe — stub payments are not allowed in production.',
      );
    }
    const stripeKey = config.get<string>('billing.stripeSecretKey')?.trim();
    if (!stripeKey) {
      throw new Error(
        'Unsafe billing configuration: BILLING_PROVIDER=stripe but STRIPE_SECRET_KEY is not set.',
      );
    }
  }

  if (provider === 'stripe') {
    billingProviderLogger.log('Payment provider: stripe');
    return stripe;
  }
  billingProviderLogger.warn(
    'Payment provider: stub (no real charges) — permitted only where mock subscriptions are enabled',
  );
  return stub;
}

import { WebhookIdempotencyModule } from '../../common/webhooks/webhook-idempotency.module';
import { StreamingModule } from '../streaming/streaming.module';
import { StripeTierSyncService } from './stripe-tier-sync.service';
import { StripeConnectService } from './stripe-connect.service';
import { SubscriptionChangeService } from './subscription-change.service';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => EntitlementsModule),
    WebhookIdempotencyModule,
    forwardRef(() => StreamingModule),
    UsersModule,
    TypeOrmModule.forFeature([StreamEventPurchase, Stream, User]),
  ],
  controllers: [BillingController],
  providers: [
    StubPaymentProvider,
    StripePaymentProvider,
    StripeTierSyncService,
    StripeConnectService,
    SubscriptionChangeService,
    BillingService,
    CreatorApprovedGuard,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, StubPaymentProvider, StripePaymentProvider],
      useFactory: billingProviderFactory,
    },
  ],
  exports: [PAYMENT_PROVIDER, BillingService, StubPaymentProvider, StripePaymentProvider, StripeTierSyncService, StripeConnectService, SubscriptionChangeService],
})
export class BillingModule {}
