/** Content access levels for videos, streams, and community channels. */
export const ContentVisibility = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  TIER: 'tier',
  PRIVATE: 'private',
  PAID_EVENT: 'paid_event',
  /** Video-only: unlisted link access */
  UNLISTED: 'unlisted',
} as const;

export type ContentVisibilityValue = (typeof ContentVisibility)[keyof typeof ContentVisibility];

export const StreamVisibility = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  TIER: 'tier',
  PRIVATE: 'private',
  PAID_EVENT: 'paid_event',
} as const;

export type StreamVisibilityValue = (typeof StreamVisibility)[keyof typeof StreamVisibility];

export const ChannelType = {
  PUBLIC: 'public',
  SUBSCRIBERS: 'subscribers',
  TIER: 'tier',
  INVITE: 'invite',
} as const;

export type ChannelTypeValue = (typeof ChannelType)[keyof typeof ChannelType];

export const SubscriptionStatus = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  TRIAL: 'trial',
  GRACE_PERIOD: 'grace_period',
  PAUSED: 'paused',
  RENEWAL_PENDING: 'renewal_pending',
  FAILED_PAYMENT: 'failed_payment',
  SUSPENDED: 'suspended',
  REFUNDED: 'refunded',
} as const;

export type SubscriptionStatusValue = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubscriptionSource = {
  MOCK: 'mock',
  ADMIN_GRANT: 'admin_grant',
  PAYMENT: 'payment',
  STRIPE: 'stripe',
} as const;

export type SubscriptionSourceValue = (typeof SubscriptionSource)[keyof typeof SubscriptionSource];

export const BillingInterval = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

export type BillingIntervalValue = (typeof BillingInterval)[keyof typeof BillingInterval];

export const CommunityVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  PAID: 'paid',
  INVITE: 'invite',
} as const;

export type CommunityVisibilityValue = (typeof CommunityVisibility)[keyof typeof CommunityVisibility];
