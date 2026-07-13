import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  'video_liked': _NotificationMeta(Icons.favorite, ForgeTokens.outline),
  'direct_message': _NotificationMeta(Icons.mail, ForgeTokens.outline),
  'community_role_assigned': _NotificationMeta(Icons.shield, ForgeTokens.primary),
  'community_banned': _NotificationMeta(Icons.gavel, ForgeTokens.critical),
  'community_post_new': _NotificationMeta(Icons.campaign, ForgeTokens.outline),
  'achievement_unlocked': _NotificationMeta(Icons.emoji_events, ForgeTokens.tertiary),
  'xp_level_up': _NotificationMeta(Icons.trending_up, ForgeTokens.tertiary),
};

_NotificationMeta _metaFor(String? type) =>
    _notificationMetaByType[type] ?? _defaultNotificationMeta;

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
      await _load();
    } catch (_) {}
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
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
          : _items.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.notifications_none, size: 48, color: ForgeTokens.outline),
                      const SizedBox(height: 12),
                      const Text('No notifications yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
                      const SizedBox(height: 12),
                      TextButton(onPressed: () => _load(), child: const Text('Refresh')),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length + (_hasMore ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == _items.length) {
                      return TextButton(onPressed: () => _load(cursor: _nextCursor), child: const Text('Load more'));
                    }
                    final n = _items[i] as Map<String, dynamic>;
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
                          onTap: read ? null : () => _markRead(n['id'] as String),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
