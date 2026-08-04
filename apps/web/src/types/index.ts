/**
 * App-local types — re-export canonical domain contracts from shared-types.
 * Prefer importing from `@forge/shared-types` for new code.
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
  SubscriptionTier,
} from '@forge/shared-types';
