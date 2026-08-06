import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../shared/models/video.dart';
import '../data/history_repository.dart';

final watchHistoryProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  final repo = ref.read(historyRepositoryProvider);
  return repo.getWatchHistory(limit: 50);
});

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirmClear() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear watch history?'),
        content: const Text('This removes all videos from your watch history. You can’t undo this.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear all')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(historyRepositoryProvider).clearWatchHistory();
      ref.invalidate(watchHistoryProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not clear history')),
        );
      }
    }
  }

  Future<void> _removeOne(VideoModel video) async {
    try {
      await ref.read(historyRepositoryProvider).removeFromWatchHistory(video.id);
      ref.invalidate(watchHistoryProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not remove from history')),
        );
      }
    }
  }

  List<VideoModel> _filtered(List<VideoModel> videos) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return videos;
    return videos.where((v) {
      return v.title.toLowerCase().contains(q) ||
          v.user.username.toLowerCase().contains(q) ||
          v.user.displayName.toLowerCase().contains(q);
    }).toList();
  }

  String _watchHref(VideoModel v) {
    if (v.videoType == 'short') return '/shorts?v=${v.id}';
    final progress = v.viewerProgressSeconds;
    final duration = v.durationSeconds;
    if (progress != null &&
        progress > 0 &&
        duration != null &&
        duration > 0 &&
        progress < duration * 0.95) {
      return '/watch/${v.id}?t=$progress';
    }
    return '/watch/${v.id}';
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(watchHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Watch history'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: () => context.push('/profile/settings?section=privacy'),
            child: const Text('Pause history'),
          ),
          if (async.hasValue && async.value!.isNotEmpty)
            TextButton(
              onPressed: _confirmClear,
              child: const Text('Clear'),
            ),
        ],
      ),
      body: async.when(
        loading: () => const FeedSkeletonList(count: 4),
        error: (e, _) => ForgeEmptyState(
          icon: Icons.error_outline,
          title: "Couldn't load history",
          description: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(watchHistoryProvider),
        ),
        data: (videos) {
          if (videos.isEmpty) {
            return ForgeEmptyState(
              icon: Icons.history,
              title: 'No history yet',
              description: 'Browse the feed and start watching videos.',
              actionLabel: 'Explore',
              onAction: () => context.go('/explore'),
            );
          }
          final filtered = _filtered(videos);
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search watch history',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                          ),
                    isDense: true,
                  ),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          'No matching videos',
                          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        itemBuilder: (context, i) {
                          final v = filtered[i];
                          final progress = v.viewerProgressSeconds;
                          final duration = v.durationSeconds;
                          final progressFrac = (progress != null &&
                                  duration != null &&
                                  duration > 0)
                              ? (progress / duration).clamp(0.0, 1.0)
                              : null;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Dismissible(
                              key: ValueKey(v.id),
                              direction: DismissDirection.endToStart,
                              background: Container(
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                decoration: BoxDecoration(
                                  color: ForgeTokens.of(context).error.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(Icons.delete_outline, color: ForgeTokens.of(context).error),
                              ),
                              onDismissed: (_) => _removeOne(v),
                              child: ForgeCard(
                                padding: const EdgeInsets.all(8),
                                onTap: () => context.push(_watchHref(v)),
                                child: Row(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: SizedBox(
                                        width: 112,
                                        height: 63,
                                        child: Stack(
                                          fit: StackFit.expand,
                                          children: [
                                            if (v.thumbnailUrl != null)
                                              CachedNetworkImage(
                                                imageUrl: v.thumbnailUrl!,
                                                fit: BoxFit.cover,
                                                placeholder: (_, __) => ColoredBox(
                                                  color: ForgeTokens.of(context).surfaceContainerHigh,
                                                ),
                                                errorWidget: (_, __, ___) => ColoredBox(
                                                  color: ForgeTokens.of(context).surfaceContainerHigh,
                                                ),
                                              )
                                            else
                                              ColoredBox(
                                                color: ForgeTokens.of(context).surfaceContainerHigh,
                                              ),
                                            if (progressFrac != null)
                                              Positioned(
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                child: LinearProgressIndicator(
                                                  value: progressFrac,
                                                  minHeight: 3,
                                                  backgroundColor: Colors.black38,
                                                  color: ForgeTokens.of(context).primary,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            v.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: ForgeTokens.of(context).onSurface,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '@${v.user.username}',
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: ForgeTokens.of(context).onSurfaceVariant,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    PopupMenuButton<String>(
                                      tooltip: 'More',
                                      onSelected: (value) {
                                        if (value == 'remove') _removeOne(v);
                                      },
                                      itemBuilder: (context) => const [
                                        PopupMenuItem(
                                          value: 'remove',
                                          child: Text('Remove from watch history'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
