import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/notifications/notification_href.dart';
import '../../../core/theme/forge_palette.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../library/presentation/library_screen.dart';
import '../data/notifications_repository.dart';

/// Icon + tone + category per notification type — mirrors
/// apps/web/src/lib/notification-category.ts.
enum _NotifTone { outline, primary, success, critical, live, warning, tertiary }

enum _NotifCategory { social, live, content, community, billing, creator, reward }

const _categoryLabels = <_NotifCategory, String>{
  _NotifCategory.social: 'Social',
  _NotifCategory.live: 'Live',
  _NotifCategory.content: 'Content',
  _NotifCategory.community: 'Community',
  _NotifCategory.billing: 'Billing',
  _NotifCategory.creator: 'Creator status',
  _NotifCategory.reward: 'Rewards',
};

class _NotificationMeta {
  final IconData icon;
  final _NotifTone tone;
  final _NotifCategory category;
  const _NotificationMeta(this.icon, this.tone, this.category);

  Color color(ForgePalette t) => switch (tone) {
        _NotifTone.outline => t.outline,
        _NotifTone.primary => t.primary,
        _NotifTone.success => t.success,
        _NotifTone.critical => t.critical,
        _NotifTone.live => t.live,
        _NotifTone.warning => t.warning,
        _NotifTone.tertiary => t.tertiary,
      };
}

const _defaultNotificationMeta =
    _NotificationMeta(Icons.notifications, _NotifTone.outline, _NotifCategory.social);

const Map<String, _NotificationMeta> _notificationMetaByType = {
  'creator_approved': _NotificationMeta(Icons.verified, _NotifTone.success, _NotifCategory.creator),
  'creator_rejected': _NotificationMeta(Icons.block, _NotifTone.critical, _NotifCategory.creator),
  'video_ready': _NotificationMeta(Icons.video_library, _NotifTone.primary, _NotifCategory.content),
  'stream_started': _NotificationMeta(Icons.sensors, _NotifTone.live, _NotifCategory.live),
  'stream_started_followed': _NotificationMeta(Icons.sensors, _NotifTone.live, _NotifCategory.live),
  'premium_content_new':
      _NotificationMeta(Icons.workspace_premium, _NotifTone.primary, _NotifCategory.content),
  'subscription_expiring':
      _NotificationMeta(Icons.schedule, _NotifTone.warning, _NotifCategory.billing),
  'comment_on_video': _NotificationMeta(Icons.forum, _NotifTone.outline, _NotifCategory.social),
  'comment_reply': _NotificationMeta(Icons.reply, _NotifTone.outline, _NotifCategory.social),
  'new_follower': _NotificationMeta(Icons.person_add, _NotifTone.outline, _NotifCategory.social),
  'video_liked': _NotificationMeta(Icons.thumb_up, _NotifTone.outline, _NotifCategory.social),
  'super_thanks':
      _NotificationMeta(Icons.volunteer_activism, _NotifTone.warning, _NotifCategory.billing),
  'direct_message': _NotificationMeta(Icons.mail, _NotifTone.outline, _NotifCategory.social),
  'community_role_assigned':
      _NotificationMeta(Icons.shield, _NotifTone.primary, _NotifCategory.community),
  'community_banned': _NotificationMeta(Icons.gavel, _NotifTone.critical, _NotifCategory.community),
  'community_post_new':
      _NotificationMeta(Icons.campaign, _NotifTone.outline, _NotifCategory.community),
  'achievement_unlocked':
      _NotificationMeta(Icons.emoji_events, _NotifTone.tertiary, _NotifCategory.reward),
  'xp_level_up': _NotificationMeta(Icons.trending_up, _NotifTone.tertiary, _NotifCategory.reward),
  'copyright_takedown': _NotificationMeta(Icons.gavel, _NotifTone.critical, _NotifCategory.creator),
  'copyright_video_reinstated':
      _NotificationMeta(Icons.verified, _NotifTone.success, _NotifCategory.creator),
  'strike_issued': _NotificationMeta(Icons.warning, _NotifTone.critical, _NotifCategory.creator),
  'strike_rescinded': _NotificationMeta(Icons.verified, _NotifTone.success, _NotifCategory.creator),
  'strike_appeal_resolved':
      _NotificationMeta(Icons.gavel, _NotifTone.primary, _NotifCategory.creator),
  'content_scan_held':
      _NotificationMeta(Icons.shield, _NotifTone.critical, _NotifCategory.creator),
};

_NotificationMeta _metaFor(String? type) =>
    _notificationMetaByType[type] ?? _defaultNotificationMeta;

bool _isRetiredLms(String? type) =>
    type == 'achievement_unlocked' || type == 'xp_level_up';

/// Relative time for notification rows (web NotificationsMenu `timeAgo` spirit).
String _timeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
  return '${dt.month}/${dt.day}/${dt.year}';
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  bool _loadError = false;
  String? _nextCursor;
  bool _hasMore = false;
  bool _unreadOnly = false;
  _NotifCategory? _categoryFilter; // null = all

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? cursor}) async {
    if (cursor == null) {
      setState(() {
        _loading = true;
        _loadError = false;
      });
    }
    try {
      final page = await ref
          .read(notificationsRepositoryProvider)
          .list(cursor: cursor);
      final data = page.items
          .where((raw) => !_isRetiredLms((raw as Map)['type']?.toString()))
          .toList();
      if (!mounted) return;
      setState(() {
        _items = cursor != null ? [..._items, ...data] : data;
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
        _loadError = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          if (cursor == null) _loadError = true;
        });
      }
    }
  }

  void _invalidateUnreadBadge() {
    ref.invalidate(libraryUnreadCountProvider);
  }

  Future<void> _markRead(String id) async {
    try {
      await ref.read(notificationsRepositoryProvider).markRead(id);
      if (!mounted) return;
      setState(() {
        _items = _items.map((raw) {
          final n = Map<String, dynamic>.from(raw as Map);
          if (n['id'] == id) n['readAt'] = DateTime.now().toIso8601String();
          return n;
        }).toList();
      });
      _invalidateUnreadBadge();
    } catch (_) {}
  }

  Future<void> _openNotification(Map<String, dynamic> n) async {
    final id = n['id'] as String?;
    final read = n['readAt'] != null;
    if (id != null && !read) await _markRead(id);
    final metaRaw = n['metadata'];
    final metadata = metaRaw is Map ? Map<String, dynamic>.from(metaRaw) : null;
    final href = notificationHref(n['type']?.toString(), metadata);
    if (!mounted) return;
    if (href != null) {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        final uri = Uri.tryParse(href);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      } else {
        context.push(href);
      }
    }
    // null href: stay on notifications (no-op fallback)
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(notificationsRepositoryProvider).markAllRead();
      _invalidateUnreadBadge();
      await _load();
    } catch (_) {}
  }

  List<_NotifCategory> get _presentCategories {
    final present = <_NotifCategory>{};
    for (final raw in _items) {
      final type = (raw as Map)['type']?.toString();
      final cat = _metaFor(type).category;
      if (cat != _NotifCategory.reward) present.add(cat);
    }
    return _categoryLabels.keys.where(present.contains).toList();
  }

  List<dynamic> get _visible {
    return _items.where((raw) {
      final n = raw as Map;
      if (_unreadOnly && n['readAt'] != null) return false;
      if (_categoryFilter == null) return true;
      return _metaFor(n['type']?.toString()).category == _categoryFilter;
    }).toList();
  }

  String get _emptyMessage {
    if (_unreadOnly) return 'No unread notifications';
    if (_categoryFilter != null) {
      final label = _categoryLabels[_categoryFilter]!.toLowerCase();
      return 'No $label notifications';
    }
    return 'No notifications yet';
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final hasUnread = _items.any((n) => (n as Map)['readAt'] == null);
    final visible = _visible;
    final presentCategories = _presentCategories;

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
                      Container(height: 12, width: 120, color: t.surfaceContainerHigh),
                      const SizedBox(height: 8),
                      Container(height: 10, width: double.infinity, color: t.surfaceContainerHigh),
                    ],
                  ),
                ),
              ),
            )
          : _loadError
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: t.error),
                      const SizedBox(height: 12),
                      Text("Couldn't load notifications", style: TextStyle(color: t.onSurface)),
                      const SizedBox(height: 8),
                      Text(
                        'Check your connection and try again.',
                        style: TextStyle(color: t.onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      TextButton(onPressed: () => _load(), child: const Text('Retry')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    if (presentCategories.length > 1)
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                        child: Row(
                          children: [
                            FilterChip(
                              label: const Text('All'),
                              selected: _categoryFilter == null,
                              onSelected: (_) => setState(() => _categoryFilter = null),
                              visualDensity: VisualDensity.compact,
                            ),
                            const SizedBox(width: 6),
                            ...presentCategories.map(
                              (cat) => Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: FilterChip(
                                  label: Text(_categoryLabels[cat]!),
                                  selected: _categoryFilter == cat,
                                  onSelected: (_) => setState(() {
                                    _categoryFilter = _categoryFilter == cat ? null : cat;
                                  }),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: visible.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.notifications_none, size: 48, color: t.outline),
                                  const SizedBox(height: 12),
                                  Text(_emptyMessage, style: TextStyle(color: t.onSurfaceVariant)),
                                  const SizedBox(height: 12),
                                  TextButton(onPressed: () => _load(), child: const Text('Refresh')),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: visible.length +
                                  (_hasMore && !_unreadOnly && _categoryFilter == null ? 1 : 0),
                              itemBuilder: (_, i) {
                                if (i == visible.length) {
                                  return TextButton(
                                    onPressed: () => _load(cursor: _nextCursor),
                                    child: const Text('Load more'),
                                  );
                                }
                                final n = visible[i] as Map<String, dynamic>;
                                final read = n['readAt'] != null;
                                final meta = _metaFor(n['type']?.toString());
                                final color = meta.color(t);
                                final ago = _timeAgo(n['createdAt']?.toString());
                                final body = n['body']?.toString();
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: ForgeCard(
                                    child: ListTile(
                                      leading: CircleAvatar(
                                        backgroundColor: color.withValues(alpha: 0.12),
                                        child: Icon(meta.icon, color: color, size: 20),
                                      ),
                                      title: Text(
                                        n['title']?.toString() ?? 'Notification',
                                        style: TextStyle(
                                          fontWeight: read ? FontWeight.normal : FontWeight.bold,
                                        ),
                                      ),
                                      subtitle: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (body != null && body.isNotEmpty) Text(body),
                                          if (ago.isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(top: 2),
                                              child: Text(
                                                ago,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: t.outline,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      isThreeLine: body != null && body.isNotEmpty && ago.isNotEmpty,
                                      onTap: () => _openNotification(n),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}
