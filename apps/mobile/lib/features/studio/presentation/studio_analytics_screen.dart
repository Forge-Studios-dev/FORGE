import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/studio_repository.dart';

final studioAnalyticsProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) {
  return ref.read(studioRepositoryProvider).getMyVideos();
});

class StudioAnalyticsScreen extends ConsumerWidget {
  const StudioAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videosAsync = ref.watch(studioAnalyticsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: videosAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load analytics')),
        data: (videos) {
          if (videos.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const ForgeCard(
                    child: Text(
                      'Upload lessons to track views and engagement.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload lesson', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }

          final totalViews = videos.fold<int>(0, (s, v) => s + v.viewCount);
          final totalLikes = videos.fold<int>(0, (s, v) => s + v.likeCount);
          final ready = videos.where((v) => v.status == 'ready').length;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                children: [
                  Expanded(child: _stat('Views', '$totalViews')),
                  const SizedBox(width: 12),
                  Expanded(child: _stat('Likes', '$totalLikes')),
                  const SizedBox(width: 12),
                  Expanded(child: _stat('Published', '$ready')),
                ],
              ),
              const SizedBox(height: 24),
              const Text('Top lessons', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 12),
              ...videos.take(8).map(
                (v) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ForgeCard(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            v.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: ForgeTokens.onSurface),
                          ),
                        ),
                        Text('${v.viewCount} views', style: const TextStyle(color: ForgeTokens.primary, fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _stat(String label, String value) {
    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: ForgeTokens.primary)),
        ],
      ),
    );
  }
}
