import type { ContentVisibilityValue, SubscriptionSourceValue, SubscriptionStatusValue } from './content-visibility';

export interface SubscriptionTier {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface MemberSubscription {
  id: string;
  userId: string;
  creatorId: string;
  tierId: string;
  tier?: SubscriptionTier;
  status: SubscriptionStatusValue;
  source: SubscriptionSourceValue;
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ContentAccessRequest {
  creatorId: string;
  visibility: ContentVisibilityValue;
  requiredTierId?: string | null;
  viewerId?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
}

export interface ContentAccessResult {
  allowed: boolean;
  reason?: 'login_required' | 'follow_required' | 'subscription_required' | 'tier_required' | 'invite_required' | 'paid_event' | 'private' | 'not_available' | 'age_confirmation_required';
}
