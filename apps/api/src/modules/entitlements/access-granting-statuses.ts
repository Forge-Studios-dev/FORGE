import { MemberSubscriptionStatus } from './entities/member-subscription.entity';

/**
 * Subscription statuses that grant content/community access. Shared between
 * `EntitlementsService` (hot-path checks + expiry) and
 * `EntitlementsAnalyticsService` (cold-path subscriber lists). Kept in its
 * own module so those services don't have to import each other just to see
 * this constant.
 */
export const ACCESS_GRANTING_STATUSES: MemberSubscriptionStatus[] = [
  MemberSubscriptionStatus.ACTIVE,
  MemberSubscriptionStatus.TRIAL,
  MemberSubscriptionStatus.GRACE_PERIOD,
  MemberSubscriptionStatus.RENEWAL_PENDING,
];
