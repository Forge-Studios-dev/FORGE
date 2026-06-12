import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
      final path = widget.following ? '/users/$userId/following' : '/users/$userId/followers';
      final params = <String, dynamic>{'limit': 30};
      if (cursor != null) params['cursor'] = cursor;
      final res = await client.dio.get(path, queryParameters: params);
      final payload = res.data['data'] as Map<String, dynamic>;
      final data = payload['data'] as List<dynamic>? ?? [];
      final meta = payload['meta'] as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        _users = cursor != null ? [..._users, ...data] : data;
        _nextCursor = meta['cursor'] as String?;
        _hasMore = meta['hasMore'] == true;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.following ? 'Following' : 'Followers';
    return Scaffold(
      appBar: AppBar(title: Text('@${widget.username} · $title')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _users.isEmpty
              ? Center(child: Text('No $title yet', style: const TextStyle(color: ForgeTokens.onSurfaceVariant)))
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
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        child: ListTile(
                          title: Text(u['displayName'] as String? ?? 'User'),
                          subtitle: Text('@${u['username']}'),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
