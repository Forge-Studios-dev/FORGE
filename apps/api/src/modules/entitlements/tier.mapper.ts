import { SubscriptionTier } from './entities/subscription-tier.entity';
import { MemberSubscription } from './entities/member-subscription.entity';

export function toPublicTier(tier: SubscriptionTier) {
  return {
    id: tier.id,
    creatorId: tier.creatorId,
    name: tier.name,
    slug: tier.slug,
    priceCents: tier.priceCents,
    currency: tier.currency,
    benefits: tier.benefits ?? [],
    sortOrder: tier.sortOrder,
    isActive: tier.isActive,
    hasStripePrice: Boolean(tier.stripePriceId),
    createdAt: tier.createdAt,
  };
}

export function toPublicSubscription(sub: MemberSubscription) {
  return {
    id: sub.id,
    userId: sub.userId,
    creatorId: sub.creatorId,
    tierId: sub.tierId,
    tier: sub.tier ? toPublicTier(sub.tier) : undefined,
    status: sub.status,
    source: sub.source,
    startsAt: sub.startsAt,
    expiresAt: sub.expiresAt,
    createdAt: sub.createdAt,
  };
}
