/// Mirrors apps/web/src/lib/notification-href.ts for mobile deep links.
/// Returns null when there is nothing useful to open (caller should stay put
/// or fall back to `/notifications`).
String? notificationHref(String? type, Map<String, dynamic>? metadata) {
  final meta = metadata ?? const <String, dynamic>{};
  final videoId = meta['videoId'] as String?;
  final streamId = meta['streamId'] as String?;
  final username = meta['username'] as String?;
  final followerUsername = meta['followerUsername'] as String?;

  switch (type) {
    case 'video_ready':
    case 'premium_content_new':
    case 'video_liked':
    case 'super_thanks':
      return videoId != null ? '/watch/$videoId' : '/library';
    case 'comment_on_video':
    case 'comment_reply':
      if (videoId == null) return '/library';
      final commentId = meta['commentId'] as String?;
      if (commentId != null && commentId.isNotEmpty) {
        return '/watch/$videoId?lc=${Uri.encodeComponent(commentId)}';
      }
      return '/watch/$videoId';
    case 'stream_started':
    case 'stream_started_followed':
    case 'stream_reminder':
      return streamId != null ? '/live/$streamId' : '/live';
    case 'new_follower':
      if (followerUsername != null && followerUsername.isNotEmpty) {
        return '/profile/$followerUsername';
      }
      if (username != null && username.isNotEmpty) return '/profile/$username';
      return null;
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
    case 'community_post_new':
      final creatorId = meta['creatorId'] as String?;
      final slug = meta['slug'] as String?;
      if (creatorId != null && creatorId.isNotEmpty) {
        if (slug != null && slug.isNotEmpty) return '/community/$creatorId/c/$slug';
        return '/community/$creatorId';
      }
      return username != null ? '/profile/$username' : null;
    case 'achievement_unlocked':
    case 'xp_level_up':
      return null;
    default:
      return videoId != null ? '/watch/$videoId' : null;
  }
}
