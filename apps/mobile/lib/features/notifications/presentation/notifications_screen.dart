import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

/// Icon + color per notification type — mirrors
/// apps/web/src/lib/notification-category.ts and
/// apps/api/.../notification.entity.ts NotificationType, so a member can tell
/// social vs. live vs. billing vs. reward notifications apart at a glance
/// instead of every row looking identical.
class _NotificationMeta {
  final IconData icon;
  final Color color;
  const _NotificationMeta(this.icon, this.color);
}

const _defaultNotificationMeta = _NotificationMeta(Icons.notifications, ForgeTokens.outline);

const Map<String, _NotificationMeta> _notificationMetaByType = {
  'creator_approved': _NotificationMeta(Icons.verified, ForgeTokens.success),
  'creator_rejected': _NotificationMeta(Icons.block, ForgeTokens.critical),
  'video_ready': _NotificationMeta(Icons.video_library, ForgeTokens.primary),
  'stream_started': _NotificationMeta(Icons.sensors, ForgeTokens.live),
  'stream_started_followed': _NotificationMeta(Icons.sensors, ForgeTokens.live),
  'premium_content_new': _NotificationMeta(Icons.workspace_premium, ForgeTokens.primary),
  'subscription_expiring': _NotificationMeta(Icons.schedule, ForgeTokens.warning),
  'comment_on_video': _NotificationMeta(Icons.forum, ForgeTokens.outline),
  'comment_reply': _NotificationMeta(Icons.reply, ForgeTokens.outline),
  'new_follower': _NotificationMeta(Icons.person_add, ForgeTokens.outline),
  'video_liked': _NotificationMeta(Icons.thumb_up, ForgeTokens.outline),
  'super_thanks': _NotificationMeta(Icons.volunteer_activism, ForgeTokens.warning),
  'direct_message': _NotificationMeta(Icons.mail, ForgeTokens.outline),
  'community_role_assigned': _NotificationMeta(Icons.shield, ForgeTokens.primary),
  'community_banned': _NotificationMeta(Icons.gavel, ForgeTokens.critical),
  'community_post_new': _NotificationMeta(Icons.campaign, ForgeTokens.outline),
  'achievement_unlocked': _NotificationMeta(Icons.emoji_events, ForgeTokens.tertiary),
  'xp_level_up': _NotificationMeta(Icons.trending_up, ForgeTokens.tertiary),
};

_NotificationMeta _metaFor(String? type) =>
    _notificationMetaByType[type] ?? _defaultNotificationMeta;

/// Mirrors apps/web/src/lib/notification-href.ts for mobile deep links.
String? _notificationHref(String? type, Map<String, dynamic>? metadata) {
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
      final creatorId = meta['creatorId'] as String? ?? meta['communityId'] as String?;
      if (creatorId != null && creatorId.isNotEmpty) return '/community/$creatorId';
      return username != null ? '/profile/$username' : null;
    case 'achievement_unlocked':
    case 'xp_level_up':
      return '/library';
    default:
      return videoId != null ? '/watch/$videoId' : null;
  }
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _nextCursor;
  bool _hasMore = false;
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? cursor}) async {
    try {
      final api = ref.read(apiClientProvider);
      final params = <String, dynamic>{'limit': 30};
      if (cursor != null) params['cursor'] = cursor;
      final res = await api.dio.get('/notifications', queryParameters: params);
      final payload = res.data['data'] as Map<String, dynamic>;
      final data = payload['data'] as List<dynamic>? ?? [];
      final meta = payload['meta'] as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        _items = cursor != null ? [..._items, ...data] : data;
        _nextCursor = meta['cursor'] as String?;
        _hasMore = meta['hasMore'] == true;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(String id) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/notifications/$id/read');
      if (!mounted) return;
      setState(() {
        _items = _items.map((raw) {
          final n = Map<String, dynamic>.from(raw as Map);
          if (n['id'] == id) n['readAt'] = DateTime.now().toIso8601String();
          return n;
        }).toList();
      });
    } catch (_) {}
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    final id = n['id'] as String?;
    final read = n['readAt'] != null;
    if (id != null && !read) await _markRead(id);
    final metaRaw = n['metadata'];
    final metadata = metaRaw is Map
        ? Map<String, dynamic>.from(metaRaw)
        : null;
    final href = _notificationHref(n['type']?.toString(), metadata);
    if (href != null && mounted) context.push(href);
  }

  Future<void> _markAllRead() async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/notifications/read-all');
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _items.any((n) => (n as Map)['readAt'] == null);
    final visible = _unreadOnly
        ? _items.where((n) => (n as Map)['readAt'] == null).toList()
        : _items;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          FilterChip(
            label: const Text('Unread'),
            selected: _unreadOnly,
            onSelected: (v) => setState(() => _unreadOnly = v),
            visualDensity: VisualDensity.compact,
          ),
          const SizedBox(width: 4),
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: _loading
          ? ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: 4,
              itemBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ForgeCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(height: 12, width: 120, color: ForgeTokens.surfaceContainerHigh),
                      const SizedBox(height: 8),
                      Container(height: 10, width: double.infinity, color: ForgeTokens.surfaceContainerHigh),
                    ],
                  ),
                ),
              ),
            )
          : visible.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.notifications_none, size: 48, color: ForgeTokens.outline),
                      const SizedBox(height: 12),
                      Text(
                        _unreadOnly ? 'No unread notifications' : 'No notifications yet',
                        style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      TextButton(onPressed: () => _load(), child: const Text('Refresh')),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: visible.length + (_hasMore && !_unreadOnly ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == visible.length) {
                      return TextButton(onPressed: () => _load(cursor: _nextCursor), child: const Text('Load more'));
                    }
                    final n = visible[i] as Map<String, dynamic>;
                    final read = n['readAt'] != null;
                    final meta = _metaFor(n['type']?.toString());
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: meta.color.withValues(alpha: 0.12),
                            child: Icon(meta.icon, color: meta.color, size: 20),
                          ),
                          title: Text(
                            n['title']?.toString() ?? 'Notification',
                            style: TextStyle(fontWeight: read ? FontWeight.normal : FontWeight.bold),
                          ),
                          subtitle: n['body'] != null ? Text(n['body'].toString()) : null,
                          onTap: () => _openNotification(n),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
