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

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(watchHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Watch history'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
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
              description: 'Browse the feed and start watching lessons.',
              actionLabel: 'Explore',
              onAction: () => context.go('/explore'),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: videos.length,
            itemBuilder: (context, i) {
              final v = videos[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: ForgeCard(
                  padding: const EdgeInsets.all(8),
                  onTap: () => context.push('/watch/${v.id}'),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 112,
                          height: 63,
                          child: v.thumbnailUrl != null
                              ? CachedNetworkImage(
                                  imageUrl: v.thumbnailUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => const ColoredBox(
                                    color: ForgeTokens.surfaceContainerHigh,
                                  ),
                                  errorWidget: (_, __, ___) => const ColoredBox(
                                    color: ForgeTokens.surfaceContainerHigh,
                                  ),
                                )
                              : const ColoredBox(color: ForgeTokens.surfaceContainerHigh),
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
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: ForgeTokens.onSurface,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '@${v.user.username}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: ForgeTokens.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: ForgeTokens.outline),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
