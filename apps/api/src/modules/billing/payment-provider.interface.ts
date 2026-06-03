/** Provider-agnostic billing boundary (Phase 2: Stripe/Razorpay adapters). */

export type CheckoutSessionInput = {
  userId: string;
  creatorId: string;
  tierId: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = {
  provider: string;
  sessionId: string;
  checkoutUrl: string | null;
};

export type ProviderWebhookResult = {
  handled: boolean;
  subscriptionId?: string;
  status?: 'active' | 'canceled' | 'expired';
};

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  verifyWebhook(payload: Buffer, headers: Record<string, string>): ProviderWebhookResult | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
