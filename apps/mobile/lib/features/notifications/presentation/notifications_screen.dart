import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

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
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        child: ListTile(
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
