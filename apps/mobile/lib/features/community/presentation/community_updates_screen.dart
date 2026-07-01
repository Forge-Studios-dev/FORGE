import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';

/// Creator updates feed — announcement posts across the communities the
/// viewer has joined. Mirrors the web `/updates` page and the notifications
/// screen's cursor-pagination pattern.
class CommunityUpdatesScreen extends ConsumerStatefulWidget {
  const CommunityUpdatesScreen({super.key});

  @override
  ConsumerState<CommunityUpdatesScreen> createState() => _CommunityUpdatesScreenState();
}

class _CommunityUpdatesScreenState extends ConsumerState<CommunityUpdatesScreen> {
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
      final params = <String, dynamic>{'limit': 20};
      if (cursor != null) params['cursor'] = cursor;
      final res = await api.dio.get('/me/community-updates', queryParameters: params);
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

  String _formatDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final d = dt.toLocal();
    return '${d.day}/${d.month}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Updates')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? ForgeEmptyState(
                  icon: Icons.campaign_outlined,
                  title: 'No updates yet',
                  description: "Join creator communities to see their announcements here.",
                  actionLabel: 'Discover communities',
                  onAction: () => context.push('/discover/communities'),
                )
              : RefreshIndicator(
                  onRefresh: () => _load(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length + (_hasMore ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i == _items.length) {
                        return TextButton(
                          onPressed: () => _load(cursor: _nextCursor),
                          child: const Text('Load more'),
                        );
                      }
                      final p = _items[i] as Map<String, dynamic>;
                      final community = p['community'] as Map<String, dynamic>?;
                      final author = p['author'] as Map<String, dynamic>?;
                      final title = p['title'] as String?;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ForgeCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      community?['name'] as String? ?? 'Community',
                                      style: const TextStyle(
                                        color: ForgeTokens.primary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    _formatDate(p['createdAt'] as String?),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: ForgeTokens.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                              if (title != null && title.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: ForgeTokens.onSurface,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 4),
                              Text(
                                p['body'] as String? ?? '',
                                style: const TextStyle(color: ForgeTokens.onSurface),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Text(
                                    '${p['likeCount'] ?? 0} likes',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: ForgeTokens.onSurfaceVariant,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Text(
                                    '${p['commentCount'] ?? 0} comments',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: ForgeTokens.onSurfaceVariant,
                                    ),
                                  ),
                                  if (author?['displayName'] != null ||
                                      author?['username'] != null) ...[
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Text(
                                        'by ${author?['displayName'] ?? author?['username']}',
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: ForgeTokens.onSurfaceVariant,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
