/// Mirrors apps/web/src/lib/notification-href.ts for mobile deep links.
/// Returns null when there is nothing useful to open (caller should stay put
/// or fall back to `/notifications`).
String? notificationHref(
  String? type,
  Map<String, dynamic>? metadata, {
  String adminBaseUrl = 'https://admin.forgestudios.net',
}) {
  final meta = metadata ?? const <String, dynamic>{};
  final videoId = meta['videoId'] as String?;
  final videoType = meta['videoType'] as String?;
  final streamId = meta['streamId'] as String?;
  final username = meta['username'] as String?;
  final followerUsername = meta['followerUsername'] as String?;

  String videoPath(String id) =>
      videoType == 'short' ? '/shorts?v=$id' : '/watch/$id';

  switch (type) {
    case 'video_ready':
    case 'premium_content_new':
    case 'video_liked':
    case 'super_thanks':
      return videoId != null ? videoPath(videoId) : '/library';
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
    case 'copyright_takedown':
    case 'copyright_video_reinstated':
    case 'strike_issued':
    case 'strike_rescinded':
    case 'strike_appeal_resolved':
      return '/settings/strikes';
    case 'content_scan_held':
      // Uploader → Studio; admins → admin held queue (never open consumer watch).
      if (meta['audience'] == 'uploader') {
        return videoId != null && videoId.isNotEmpty
            ? '/studio/videos/$videoId'
            : '/studio/videos';
      }
      final q = <String, String>{'moderationStatus': 'held'};
      if (videoId != null && videoId.isNotEmpty) q['videoId'] = videoId;
      final query = q.entries.map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}').join('&');
      final base = adminBaseUrl.replaceAll(RegExp(r'/+$'), '');
      return '$base/content?$query';
    default:
      return videoId != null ? videoPath(videoId) : null;
  }
}
