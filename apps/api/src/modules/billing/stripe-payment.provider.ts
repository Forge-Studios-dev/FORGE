import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  ProviderWebhookResult,
} from './payment-provider.interface';

/** Stripe adapter skeleton — activate with STRIPE_SECRET_KEY (live payments not enabled by default). */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(private readonly configService: ConfigService) {}

  private secretKey(): string | null {
    const key = this.configService.get<string>('billing.stripeSecretKey')?.trim();
    return key || null;
  }

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!this.secretKey()) {
      throw new NotImplementedException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout.',
      );
    }
    throw new NotImplementedException('Stripe checkout integration pending activation.');
  }

  async cancelSubscription(_externalSubscriptionId: string): Promise<void> {
    if (!this.secretKey()) {
      throw new NotImplementedException('Stripe is not configured.');
    }
    throw new NotImplementedException('Stripe cancel integration pending activation.');
  }

  verifyWebhook(_payload: Buffer, headers: Record<string, string>): ProviderWebhookResult | null {
    if (!this.secretKey()) return null;
    const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
    if (!signature) return null;
    throw new NotImplementedException('Stripe webhook verification pending activation.');
  }
}
