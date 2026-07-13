import type { StatusTone } from '@forge/design-system';
import { NotificationType } from '@/types';

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

export type NotificationCategory = 'social' | 'live' | 'content' | 'community' | 'billing' | 'creator' | 'reward';

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
 * Icon + tone + category per notification type, grouped so a user can tell at
 * a glance whether something is social, live, creator/studio, billing, or a
 * reward — rather than every notification looking identical regardless of
 * category. `category` powers the filter chips on the notifications page.
 */
const NOTIFICATION_META: Record<NotificationType, { icon: string; tone: StatusTone; category: NotificationCategory }> = {
  creator_approved: { icon: 'verified', tone: 'success', category: 'creator' },
  creator_rejected: { icon: 'block', tone: 'critical', category: 'creator' },
  video_ready: { icon: 'video_library', tone: 'primary', category: 'content' },
  stream_started: { icon: 'sensors', tone: 'live', category: 'live' },
  stream_started_followed: { icon: 'sensors', tone: 'live', category: 'live' },
  premium_content_new: { icon: 'workspace_premium', tone: 'primary', category: 'content' },
  subscription_expiring: { icon: 'schedule', tone: 'warning', category: 'billing' },
  comment_on_video: { icon: 'forum', tone: 'neutral', category: 'social' },
  comment_reply: { icon: 'reply', tone: 'neutral', category: 'social' },
  new_follower: { icon: 'person_add', tone: 'neutral', category: 'social' },
  video_liked: { icon: 'favorite', tone: 'neutral', category: 'social' },
  direct_message: { icon: 'mail', tone: 'neutral', category: 'social' },
  community_role_assigned: { icon: 'shield', tone: 'primary', category: 'community' },
  community_banned: { icon: 'gavel', tone: 'critical', category: 'community' },
  community_post_new: { icon: 'campaign', tone: 'neutral', category: 'community' },
  achievement_unlocked: { icon: 'emoji_events', tone: 'reward', category: 'reward' },
  xp_level_up: { icon: 'trending_up', tone: 'reward', category: 'reward' },
};

const DEFAULT_META = { icon: 'notifications', tone: 'neutral' as StatusTone, category: 'social' as NotificationCategory };

export function notificationMeta(type: NotificationType | string): {
  icon: string;
  tone: StatusTone;
  category: NotificationCategory;
  className: string;
} {
  const meta =
    (NOTIFICATION_META as Record<string, { icon: string; tone: StatusTone; category: NotificationCategory }>)[type] ??
    DEFAULT_META;
  return { ...meta, className: TONE_CLASSES[meta.tone] };
}
