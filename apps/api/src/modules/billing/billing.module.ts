import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StubPaymentProvider } from './stub-payment.provider';

@Module({
  providers: [
    StubPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: StubPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER, StubPaymentProvider],
})
export class BillingModule {}
