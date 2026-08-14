/** Provider-agnostic billing boundary (Stripe adapters). */

export type CheckoutSessionInput = {
  userId: string;
  creatorId: string;
  tierId: string;
  /** Optional community scope for per-community subscriptions. */
  communityId?: string | null;
  successUrl: string;
  cancelUrl: string;
  tierName?: string;
  priceCents?: number;
  currency?: string;
  stripePriceId?: string | null;
  billingInterval?: string;
  trialDays?: number;
  /** Stripe Connect Express account — enables destination charges. */
  connectAccountId?: string | null;
  /** Platform fee percentage (0–100) retained on Connect transfers. */
  platformFeePercent?: number;
};

export type UpdateSubscriptionTierInput = {
  externalSubscriptionId: string;
  stripePriceId: string;
  tierId: string;
};

export type UpdateSubscriptionTierResult = {
  subscriptionId: string;
  prorationApplied: boolean;
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
  /** Stripe Connect Express account for destination charges. */
  connectAccountId?: string | null;
  /** Platform fee percentage (0–100) retained on Connect transfers. */
  platformFeePercent?: number;
};

/** YouTube Super Thanks — one-time tip on a VOD. */
export type SuperThanksCheckoutInput = {
  userId: string;
  videoId: string;
  creatorId: string;
  body: string;
  amountCents: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  /** Stripe Connect Express account for destination charges. */
  connectAccountId?: string | null;
  /** Platform fee percentage (0–100) retained on Connect transfers. */
  platformFeePercent?: number;
};

export type CheckoutSessionResult = {
  provider: string;
  sessionId: string;
  checkoutUrl: string | null;
};

export type ProviderWebhookResult = {
  handled: boolean;
  checkoutType?: 'subscription' | 'event' | 'super_chat' | 'super_thanks';
  subscriptionId?: string;
  status?: 'active' | 'canceled' | 'expired' | 'completed' | 'failed_payment' | 'trial' | 'grace_period' | 'paused' | 'refunded' | 'disputed' | 'renewal_pending';
  sessionId?: string;
  userId?: string;
  creatorId?: string;
  tierId?: string;
  communityId?: string;
  streamId?: string;
  videoId?: string;
  amountCents?: number;
  currency?: string;
  paymentIntentId?: string;
  superChatBody?: string;
  periodEndAt?: Date;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  createEventCheckoutSession(input: EventCheckoutSessionInput): Promise<CheckoutSessionResult>;
  createSuperChatCheckoutSession(input: SuperChatCheckoutInput): Promise<CheckoutSessionResult>;
  createSuperThanksCheckoutSession(input: SuperThanksCheckoutInput): Promise<CheckoutSessionResult>;
  cancelSubscription(externalSubscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<void>;
  updateSubscriptionTier?(input: UpdateSubscriptionTierInput): Promise<UpdateSubscriptionTierResult>;
  verifyWebhook(payload: Buffer, headers: Record<string, string>): Promise<ProviderWebhookResult | null>;
  createBillingPortalSession?(customerId: string, returnUrl: string): Promise<{ url: string }>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
