import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StubPaymentProvider } from './stub-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { Stream } from '../streaming/entities/stream.entity';

function billingProviderFactory(
  config: ConfigService,
  stub: StubPaymentProvider,
  stripe: StripePaymentProvider,
) {
  const provider = (config.get<string>('billing.provider') || 'stub').toLowerCase();
  return provider === 'stripe' ? stripe : stub;
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
