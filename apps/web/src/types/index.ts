/**
 * App-local types — re-export canonical domain contracts from shared-types.
 * Prefer importing from `@forge/shared-types` for new code.
 *
 * `SubscriptionTier` stays local: shared entitlements shape differs (createdAt vs billingInterval).
 */
export type {
  User,
  Video,
  Stream,
  Category,
  Subcategory,
  SkillTag,
  Comment,
  NotificationType,
  Notification,
  Playlist,
  PaginatedResponse,
  AuthTokens,
} from '@forge/shared-types';

export interface SubscriptionTier {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  billingInterval?: string;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
  maxConcurrentDevices?: number;
}
