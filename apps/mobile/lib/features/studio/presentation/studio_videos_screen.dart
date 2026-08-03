import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/studio_repository.dart';
import '../../../shared/models/video.dart';

final myVideosProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  return ref.read(studioRepositoryProvider).getMyVideos();
});

class StudioVideosScreen extends ConsumerWidget {
  const StudioVideosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videosAsync = ref.watch(myVideosProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your videos'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: videosAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Failed to load videos', style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
              const SizedBox(height: 12),
              TextButton(onPressed: () => ref.invalidate(myVideosProvider), child: const Text('Retry')),
            ],
          ),
        ),
        data: (videos) {
          if (videos.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const ForgeCard(
                    child: Text(
                      'No videos yet. Upload your first video.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload video', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ForgeButton(label: 'New upload', onPressed: () => context.push('/upload')),
              const SizedBox(height: 16),
              ...videos.map(
                (v) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ForgeCard(
                    onTap: () => context.push('/watch/${v.id}'),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(v.title, style: const TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
                              const SizedBox(height: 4),
                              Text(
                                '${_statusLabel(v.status)} · ${v.viewCount} views',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _statusColor(v.status),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: ForgeTokens.outline),
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

  String _statusLabel(String status) {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      case 'failed':
        return 'Failed';
      case 'draft':
        return 'Draft';
      default:
        return status;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'ready':
        return ForgeTokens.secondary;
      case 'processing':
      case 'uploading':
        return ForgeTokens.primary;
      case 'failed':
        return ForgeTokens.error;
      case 'draft':
        return ForgeTokens.onSurfaceVariant;
      default:
        return ForgeTokens.onSurfaceVariant;
    }
  }
}
