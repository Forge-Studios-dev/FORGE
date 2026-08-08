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
import { Video } from '../content/entities/video.entity';
import { SuperThanks } from './entities/super-thanks.entity';

const billingProviderLogger = new Logger('BillingProvider');

/**
 * Selects the active payment provider.
 *
 * The stub provider fakes successful payments and must NEVER run in real production.
 * It is only permitted where mock subscriptions are enabled (dev/staging). In
 * production (MOCK_SUBSCRIPTIONS_ENABLED absent/false), BILLING_PROVIDER=stripe is
 * required. If STRIPE_SECRET_KEY is missing the app still boots but billing calls
 * fail at runtime (StripePaymentProvider.client() throws NotImplementedException).
 * Configure via scripts/set-stripe-secrets-fly.sh.
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
      // StripePaymentProvider.client() throws NotImplementedException at call time
      // when the key is absent — no need to crash at startup. Log loudly so ops can act on it.
      billingProviderLogger.warn(
        'BILLING_PROVIDER=stripe but STRIPE_SECRET_KEY is not set. ' +
          'Billing calls will fail until configured. Run scripts/set-stripe-secrets-fly.sh.',
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
import { StripeTierSyncModule } from './stripe-tier-sync.module';
import { StripeConnectService } from './stripe-connect.service';
import { SubscriptionChangeService } from './subscription-change.service';
import { UsersModule } from '../users/users.module';
import { EngagementModule } from '../engagement/engagement.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    // EntitlementsModule no longer imports BillingModule back (see
    // stripe-tier-sync.module.ts) — this is now a genuine one-way edge, so
    // no forwardRef is needed on either side.
    EntitlementsModule,
    EngagementModule,
    WebhookIdempotencyModule,
    forwardRef(() => StreamingModule),
    UsersModule,
    StripeTierSyncModule,
    TypeOrmModule.forFeature([StreamEventPurchase, Stream, User, Video, SuperThanks]),
  ],
  controllers: [BillingController],
  providers: [
    StubPaymentProvider,
    StripePaymentProvider,
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
  exports: [PAYMENT_PROVIDER, BillingService, StubPaymentProvider, StripePaymentProvider, StripeConnectService, SubscriptionChangeService],
})
export class BillingModule {}
