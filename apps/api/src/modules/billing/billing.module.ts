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

@Module({
  imports: [
    ConfigModule,
    EntitlementsModule,
    WebhookIdempotencyModule,
    forwardRef(() => StreamingModule),
    TypeOrmModule.forFeature([StreamEventPurchase, Stream]),
  ],
  controllers: [BillingController],
  providers: [
    StubPaymentProvider,
    StripePaymentProvider,
    BillingService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, StubPaymentProvider, StripePaymentProvider],
      useFactory: billingProviderFactory,
    },
  ],
  exports: [PAYMENT_PROVIDER, BillingService, StubPaymentProvider, StripePaymentProvider],
})
export class BillingModule {}
