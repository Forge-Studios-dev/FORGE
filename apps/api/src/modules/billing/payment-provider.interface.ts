/** Provider-agnostic billing boundary (Stripe adapters). */

export type CheckoutSessionInput = {
  userId: string;
  creatorId: string;
  tierId: string;
  successUrl: string;
  cancelUrl: string;
  tierName?: string;
  priceCents?: number;
  currency?: string;
  stripePriceId?: string | null;
  billingInterval?: string;
  trialDays?: number;
};

export type EventCheckoutSessionInput = {
  userId: string;
  streamId: string;
  creatorId: string;
  title: string;
  amountCents: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
};

export type SuperChatCheckoutInput = {
  userId: string;
  streamId: string;
  creatorId: string;
  body: string;
  amountCents: number;
  currency?: string;
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
  checkoutType?: 'subscription' | 'event' | 'super_chat';
  subscriptionId?: string;
  status?: 'active' | 'canceled' | 'expired' | 'completed' | 'failed_payment' | 'trial' | 'grace_period' | 'paused';
  sessionId?: string;
  userId?: string;
  creatorId?: string;
  tierId?: string;
  streamId?: string;
  amountCents?: number;
  currency?: string;
  paymentIntentId?: string;
  superChatBody?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  createEventCheckoutSession(input: EventCheckoutSessionInput): Promise<CheckoutSessionResult>;
  createSuperChatCheckoutSession(input: SuperChatCheckoutInput): Promise<CheckoutSessionResult>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  verifyWebhook(payload: Buffer, headers: Record<string, string>): ProviderWebhookResult | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
