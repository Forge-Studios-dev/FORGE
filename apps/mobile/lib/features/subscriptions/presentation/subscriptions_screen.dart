import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../shared/models/video.dart';
import '../../feed/data/feed_repository.dart';

/// Subscriptions = videos from channels you follow (YouTube parity).
class SubscriptionsScreen extends ConsumerStatefulWidget {
  const SubscriptionsScreen({super.key});

  @override
  ConsumerState<SubscriptionsScreen> createState() => _SubscriptionsScreenState();
}

class _SubscriptionsScreenState extends ConsumerState<SubscriptionsScreen> {
  final List<VideoModel> _videos = [];
  final List<Map<String, dynamic>> _channels = [];
  String? _nextCursor;
  String? _channelFilterId;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _loadChannels();
    _loadInitial();
  }

  Future<void> _loadChannels() async {
    try {
      final api = ref.read(apiClientProvider);
      final me = await api.dio.get('/users/me');
      final meId = (me.data['data'] as Map?)?['id'] as String?;
      if (meId == null) return;
      final res = await api.dio.get('/users/$meId/following', queryParameters: {'limit': 40});
      final payload = res.data['data'];
      final list = payload is Map
          ? (payload['data'] as List? ?? [])
          : (payload is List ? payload : []);
      if (!mounted) return;
      setState(() {
        _channels
          ..clear()
          ..addAll(
            list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
          );
      });
    } catch (_) {}
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final page = await ref.read(feedRepositoryProvider).getFollowingFeed(
            channelId: _channelFilterId,
          );
      if (!mounted) return;
      setState(() {
        _videos
          ..clear()
          ..addAll(page.videos);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await ref.read(feedRepositoryProvider).getFollowingFeed(
            cursor: _nextCursor,
            channelId: _channelFilterId,
          );
      if (!mounted) return;
      setState(() {
        _videos.addAll(page.videos);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
      });
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _selectChannel(String? channelId) {
    if (_channelFilterId == channelId) return;
    setState(() => _channelFilterId = channelId);
    _loadInitial();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Subscriptions')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? ForgeEmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn’t load subscriptions',
                  description: 'Sign in and subscribe to channels to see their latest videos.',
                  actionLabel: 'Retry',
                  onAction: _loadInitial,
                )
              : _videos.isEmpty && _channelFilterId == null
                  ? ForgeEmptyState(
                      icon: Icons.subscriptions_outlined,
                      title: 'No subscriptions yet',
                      description: 'Videos from channels you subscribe to will appear here.',
                      actionLabel: 'Explore',
                      onAction: () => context.push('/explore'),
                    )
                  : Column(
                      children: [
                        if (_channels.isNotEmpty)
                          SizedBox(
                            height: 92,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                              itemCount: _channels.length + 1,
                              separatorBuilder: (_, __) => const SizedBox(width: 10),
                              itemBuilder: (context, index) {
                                if (index == 0) {
                                  final selected = _channelFilterId == null;
                                  return _ChannelChip(
                                    label: 'All',
                                    selected: selected,
                                    onTap: () => _selectChannel(null),
                                  );
                                }
                                final ch = _channels[index - 1];
                                final id = ch['id'] as String? ?? '';
                                final name = ch['displayName'] as String? ?? 'Channel';
                                final avatar = ch['avatarUrl'] as String?;
                                return _ChannelChip(
                                  label: name,
                                  avatarUrl: avatar,
                                  selected: _channelFilterId == id,
                                  onTap: () => _selectChannel(id),
                                );
                              },
                            ),
                          ),
                        Expanded(
                          child: _videos.isEmpty
                              ? const Center(
                                  child: Text(
                                    'No videos from this channel',
                                    style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                                  ),
                                )
                              : NotificationListener<ScrollNotification>(
                                  onNotification: (n) {
                                    if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) {
                                      _loadMore();
                                    }
                                    return false;
                                  },
                                  child: ListView.builder(
                                    padding: const EdgeInsets.all(12),
                                    itemCount: _videos.length,
                                    itemBuilder: (context, i) {
                                      final v = _videos[i];
                                      return ListTile(
                                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                                        leading: ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: SizedBox(
                                            width: 96,
                                            height: 54,
                                            child: v.thumbnailUrl != null
                                                ? CachedNetworkImage(
                                                    imageUrl: v.thumbnailUrl!,
                                                    fit: BoxFit.cover,
                                                  )
                                                : const ColoredBox(
                                                    color: ForgeTokens.surfaceContainerHigh,
                                                  ),
                                          ),
                                        ),
                                        title: Text(
                                          v.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        subtitle: Text('@${v.user.username}'),
                                        onTap: () => context.push('/watch/${v.id}'),
                                      );
                                    },
                                  ),
                                ),
                        ),
                      ],
                    ),
    );
  }
}

class _ChannelChip extends StatelessWidget {
  final String label;
  final String? avatarUrl;
  final bool selected;
  final VoidCallback onTap;

  const _ChannelChip({
    required this.label,
    this.avatarUrl,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: selected ? t.primary : t.surfaceContainerHigh,
              backgroundImage: avatarUrl != null ? CachedNetworkImageProvider(avatarUrl!) : null,
              child: avatarUrl == null
                  ? Text(
                      label.isNotEmpty ? label[0].toUpperCase() : '?',
                      style: TextStyle(
                        color: selected ? t.onPrimary : t.onSurface,
                        fontWeight: FontWeight.bold,
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? t.primary : t.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
