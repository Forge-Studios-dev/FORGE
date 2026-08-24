import type { Notification, NotificationType } from '@/types';
import { publicVideoPath } from '@/lib/watch-url';

type NotificationMeta = Notification['metadata'];

/**
 * Resolve a YouTube-style deep link from notification type + metadata.
 * Returns null when there is nothing useful to open.
 */
export function notificationHref(
  type: NotificationType,
  metadata?: NotificationMeta,
): string | null {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const videoId = typeof meta.videoId === 'string' ? meta.videoId : null;
  const videoType = typeof meta.videoType === 'string' ? meta.videoType : null;
  const streamId = typeof meta.streamId === 'string' ? meta.streamId : null;
  const username = typeof meta.username === 'string' ? meta.username : null;
  const followerUsername =
    typeof meta.followerUsername === 'string' ? meta.followerUsername : null;

  const videoHref = (id: string) => publicVideoPath({ id, videoType });

  switch (type) {
    case 'video_ready':
    case 'premium_content_new':
    case 'video_liked':
    case 'super_thanks':
      return videoId ? videoHref(videoId) : '/library';
    case 'comment_on_video':
    case 'comment_reply': {
      if (!videoId) return '/library';
      const commentId = typeof meta.commentId === 'string' ? meta.commentId : null;
      // Comments live on the watch page even for Shorts.
      return commentId
        ? `/watch/${videoId}?lc=${encodeURIComponent(commentId)}`
        : `/watch/${videoId}`;
    }
    case 'stream_started':
    case 'stream_started_followed':
      return streamId ? `/live/${streamId}` : '/live';
    case 'new_follower':
      return followerUsername ? `/${followerUsername}` : username ? `/${username}` : null;
    case 'creator_approved':
      return '/studio';
    case 'creator_rejected':
      return '/approval-rejected';
    case 'subscription_expiring':
      return '/settings/memberships';
    case 'direct_message':
      return '/messages';
    case 'community_role_assigned':
    case 'community_banned':
    case 'community_post_new': {
      if (username) {
        const slug = typeof meta.slug === 'string' ? meta.slug : null;
        return slug ? `/${username}/c/${slug}` : `/${username}/community`;
      }
      const communityId = typeof meta.communityId === 'string' ? meta.communityId : null;
      return communityId ? `/communities/id/${communityId}` : null;
    }
    case 'achievement_unlocked':
    case 'xp_level_up':
      // LMS soft-retired: no dedicated rewards surface in YouTube mode
      return null;
    case 'copyright_takedown':
    case 'copyright_video_reinstated':
    case 'strike_issued':
    case 'strike_rescinded':
    case 'strike_appeal_resolved':
      return '/settings/strikes';
    default:
      return videoId ? videoHref(videoId) : null;
  }
}
