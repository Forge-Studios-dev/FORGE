import type { NotificationType } from './domain';

export type NotificationCategory =
  | 'social'
  | 'live'
  | 'content'
  | 'community'
  | 'billing'
  | 'creator'
  | 'reward';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'social',
  'live',
  'content',
  'community',
  'billing',
  'creator',
  'reward',
];

/**
 * Single source of truth for type -> category, shared by the API's mute gate
 * and the web notifications-page filter chips so the two can't drift apart.
 */
export const NOTIFICATION_CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  creator_approved: 'creator',
  creator_rejected: 'creator',
  video_ready: 'content',
  stream_started: 'live',
  stream_started_followed: 'live',
  premium_content_new: 'content',
  subscription_expiring: 'billing',
  comment_on_video: 'social',
  comment_reply: 'social',
  new_follower: 'social',
  video_liked: 'social',
  direct_message: 'social',
  community_role_assigned: 'community',
  community_banned: 'community',
  community_post_new: 'community',
  achievement_unlocked: 'reward',
  xp_level_up: 'reward',
  super_thanks: 'billing',
};

export function categoryForNotificationType(type: NotificationType | string): NotificationCategory {
  return (NOTIFICATION_CATEGORY_BY_TYPE as Record<string, NotificationCategory>)[type] ?? 'social';
}

export interface NotificationPreferences {
  /** Categories the user has muted — no notification row, unread bump, or live push for these. */
  mutedCategories: NotificationCategory[];
  /** Opt-in for a periodic email digest — sent by the `email-digest` BullMQ cron job. */
  emailDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  mutedCategories: [],
  emailDigest: false,
};

export function isCategoryMuted(
  prefs: NotificationPreferences | null | undefined,
  category: NotificationCategory,
): boolean {
  return !!prefs?.mutedCategories?.includes(category);
}
