import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StubPaymentProvider } from './stub-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';

function billingProviderFactory(
  config: ConfigService,
  stub: StubPaymentProvider,
  stripe: StripePaymentProvider,
) {
  const provider = (config.get<string>('billing.provider') || 'stub').toLowerCase();
  return provider === 'stripe' ? stripe : stub;
}

@Module({
  imports: [ConfigModule, EntitlementsModule],
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
