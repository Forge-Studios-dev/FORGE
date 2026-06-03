import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  ProviderWebhookResult,
} from './payment-provider.interface';

/** Dev/test provider — checkout is a no-op; use POST /subscriptions/mock instead. */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    return {
      provider: this.name,
      sessionId: `stub_${randomUUID()}`,
      checkoutUrl: null,
    };
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<void> {
    // no-op in stub mode
  }

  verifyWebhook(_payload: Buffer, _headers: Record<string, string>): ProviderWebhookResult | null {
    return null;
  }
}
