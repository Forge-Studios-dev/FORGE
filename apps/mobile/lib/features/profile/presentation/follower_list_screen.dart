import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class FollowerListScreen extends ConsumerStatefulWidget {
  final String username;
  final bool following;

  const FollowerListScreen({
    super.key,
    required this.username,
    required this.following,
  });

  @override
  ConsumerState<FollowerListScreen> createState() => _FollowerListScreenState();
}

class _FollowerListScreenState extends ConsumerState<FollowerListScreen> {
  List<dynamic> _users = [];
  bool _loading = true;
  String? _nextCursor;
  bool _hasMore = false;
  String? _listOwnerId;
  String? _meId;
  final Map<String, String> _notifyLevels = {};

  bool get _isManage =>
      widget.following && _meId != null && _listOwnerId != null && _meId == _listOwnerId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? cursor}) async {
    try {
      final client = ref.read(apiClientProvider);
      final userRes = await client.dio.get('/users/by-username/${widget.username}');
      final userId = userRes.data['data']['id'] as String;
      String? meId = _meId;
      if (cursor == null) {
        try {
          final meRes = await client.dio.get('/users/me');
          meId = meRes.data['data']?['id'] as String?;
        } catch (_) {
          meId = null;
        }
      }
      final path = widget.following
          ? '/channels/$userId/subscriptions'
          : '/channels/$userId/subscribers';
      final params = <String, dynamic>{'limit': 30};
      if (cursor != null) params['cursor'] = cursor;
      final res = await client.dio.get(path, queryParameters: params);
      final payload = res.data['data'] as Map<String, dynamic>;
      final data = payload['data'] as List<dynamic>? ?? [];
      final meta = payload['meta'] as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        _listOwnerId = userId;
        _meId = meId;
        _users = cursor != null ? [..._users, ...data] : data;
        _nextCursor = meta['cursor'] as String?;
        _hasMore = meta['hasMore'] == true;
        _loading = false;
        for (final raw in data) {
          if (raw is! Map) continue;
          final id = raw['id'] as String?;
          final level = raw['notifyLevel'] as String?;
          if (id != null && level != null) {
            _notifyLevels[id] = level;
          }
        }
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _ensureNotifyLevel(String channelId) async {
    if (_notifyLevels.containsKey(channelId)) return;
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/channels/$channelId/subscription');
      final level = res.data['data']?['notifyLevel'] as String? ?? 'all';
      if (!mounted) return;
      setState(() => _notifyLevels[channelId] = level);
    } catch (_) {
      if (!mounted) return;
      setState(() => _notifyLevels[channelId] = 'all');
    }
  }

  Future<void> _setNotify(String channelId, String level) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/channels/$channelId/subscription/notify',
        data: {'notifyLevel': level},
      );
      if (!mounted) return;
      setState(() => _notifyLevels[channelId] = level);
      final label = switch (level) {
        'all' => 'All notifications',
        'personalized' => 'Personalized',
        _ => 'None',
      };
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not update notifications')),
      );
    }
  }

  Future<void> _unsubscribe(String channelId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unsubscribe?'),
        content: const Text('You will stop receiving updates from this channel.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Unsubscribe')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/channels/$channelId/subscribe');
      if (!mounted) return;
      setState(() {
        _users = _users.where((raw) {
          final m = raw as Map<String, dynamic>;
          return m['id'] != channelId;
        }).toList();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not unsubscribe')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.following
        ? (_isManage ? 'Manage subscriptions' : 'Subscriptions')
        : 'Subscribers';
    return Scaffold(
      appBar: AppBar(title: Text('@${widget.username} · $title')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _users.isEmpty
              ? Center(
                  child: Text(
                    'No ${widget.following ? 'subscriptions' : 'subscribers'} yet',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _users.length + (_hasMore ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == _users.length) {
                      return TextButton(
                        onPressed: () => _load(cursor: _nextCursor),
                        child: const Text('Load more'),
                      );
                    }
                    final u = _users[i] as Map<String, dynamic>;
                    final channelId = u['id'] as String?;
                    final username = u['username'] as String? ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        onTap: username.isEmpty ? null : () => context.push('/$username'),
                        child: ListTile(
                          title: Text(u['displayName'] as String? ?? 'User'),
                          subtitle: Text('@$username'),
                          trailing: _isManage && channelId != null
                              ? PopupMenuButton<String>(
                                  tooltip: 'Manage',
                                  onOpened: () => _ensureNotifyLevel(channelId),
                                  onSelected: (value) {
                                    if (value == 'unsubscribe') {
                                      _unsubscribe(channelId);
                                    } else {
                                      _setNotify(channelId, value);
                                    }
                                  },
                                  itemBuilder: (context) {
                                    final current = _notifyLevels[channelId] ?? 'all';
                                    return [
                                      CheckedPopupMenuItem(
                                        value: 'all',
                                        checked: current == 'all',
                                        child: const Text('All'),
                                      ),
                                      CheckedPopupMenuItem(
                                        value: 'personalized',
                                        checked: current == 'personalized',
                                        child: const Text('Personalized'),
                                      ),
                                      CheckedPopupMenuItem(
                                        value: 'none',
                                        checked: current == 'none',
                                        child: const Text('None'),
                                      ),
                                      const PopupMenuDivider(),
                                      const PopupMenuItem(
                                        value: 'unsubscribe',
                                        child: Text('Unsubscribe'),
                                      ),
                                    ];
                                  },
                                  icon: Icon(
                                    Icons.notifications_outlined,
                                    color: ForgeTokens.of(context).onSurfaceVariant,
                                  ),
                                )
                              : null,
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
