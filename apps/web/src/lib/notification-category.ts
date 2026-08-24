import type { StatusTone } from '@forge/design-system';
import { NOTIFICATION_CATEGORY_BY_TYPE, type NotificationCategory } from '@forge/shared-types';
import { NotificationType } from '@/types';

export type { NotificationCategory };

/** @deprecated use StatusTone from @forge/design-system directly. */
export type NotificationTone = StatusTone;

// Icon-avatar circle, not a StatusPill — its own class map (opacity-10 vs
// StatusPill's opacity-15), but shares the canonical StatusTone vocabulary.
const TONE_CLASSES: Record<StatusTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-critical/10 text-critical',
  live: 'bg-live/10 text-live',
  reward: 'bg-tertiary/10 text-tertiary',
  neutral: 'bg-surface-container-high text-outline',
};

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  social: 'Social',
  live: 'Live',
  content: 'Content',
  community: 'Community',
  billing: 'Billing',
  creator: 'Creator status',
  reward: 'Rewards',
};

/**
 * Icon + tone per notification type — category comes from the shared
 * `NOTIFICATION_CATEGORY_BY_TYPE` map so this file and the API's mute gate
 * can't drift apart. Grouped so a user can tell at a glance whether
 * something is social, live, creator/studio, billing, or a reward.
 */
const NOTIFICATION_META: Record<NotificationType, { icon: string; tone: StatusTone }> = {
  creator_approved: { icon: 'verified', tone: 'success' },
  creator_rejected: { icon: 'block', tone: 'critical' },
  video_ready: { icon: 'video_library', tone: 'primary' },
  stream_started: { icon: 'sensors', tone: 'live' },
  stream_started_followed: { icon: 'sensors', tone: 'live' },
  premium_content_new: { icon: 'workspace_premium', tone: 'primary' },
  subscription_expiring: { icon: 'schedule', tone: 'warning' },
  comment_on_video: { icon: 'forum', tone: 'neutral' },
  comment_reply: { icon: 'reply', tone: 'neutral' },
  new_follower: { icon: 'person_add', tone: 'neutral' },
  video_liked: { icon: 'thumb_up', tone: 'neutral' },
  direct_message: { icon: 'mail', tone: 'neutral' },
  community_role_assigned: { icon: 'shield', tone: 'primary' },
  community_banned: { icon: 'gavel', tone: 'critical' },
  community_post_new: { icon: 'campaign', tone: 'neutral' },
  achievement_unlocked: { icon: 'emoji_events', tone: 'reward' },
  xp_level_up: { icon: 'trending_up', tone: 'reward' },
  super_thanks: { icon: 'volunteer_activism', tone: 'reward' },
  copyright_takedown: { icon: 'gavel', tone: 'critical' },
  copyright_video_reinstated: { icon: 'verified', tone: 'success' },
  strike_issued: { icon: 'warning', tone: 'critical' },
  strike_rescinded: { icon: 'verified', tone: 'success' },
  strike_appeal_resolved: { icon: 'gavel', tone: 'primary' },
};

const DEFAULT_META = { icon: 'notifications', tone: 'neutral' as StatusTone };

/** LMS soft-retire: hide XP/achievement noise in YouTube-mode notification UIs. */
export function isRetiredLmsNotification(type: NotificationType | string): boolean {
  return type === 'achievement_unlocked' || type === 'xp_level_up';
}

export function notificationMeta(type: NotificationType | string): {
  icon: string;
  tone: StatusTone;
  category: NotificationCategory;
  className: string;
} {
  const meta = (NOTIFICATION_META as Record<string, { icon: string; tone: StatusTone }>)[type] ?? DEFAULT_META;
  const category = (NOTIFICATION_CATEGORY_BY_TYPE as Record<string, NotificationCategory>)[type] ?? 'social';
  return { ...meta, category, className: TONE_CLASSES[meta.tone] };
}
