import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StubPaymentProvider } from './stub-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { SubscriptionTier } from '../entitlements/entities/subscription-tier.entity';
import { MemberSubscription } from '../entitlements/entities/member-subscription.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    EntitlementsModule,
    TypeOrmModule.forFeature([SubscriptionTier, MemberSubscription, User]),
  ],
  controllers: [BillingController],
  providers: [
    StubPaymentProvider,
    StripePaymentProvider,
    BillingService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, StubPaymentProvider, StripePaymentProvider],
      useFactory: (
        config: ConfigService,
        stub: StubPaymentProvider,
        stripe: StripePaymentProvider,
      ) => (config.get<boolean>('stripe.enabled') ? stripe : stub),
    },
  ],
  exports: [PAYMENT_PROVIDER, BillingService],
})
export class BillingModule {}
