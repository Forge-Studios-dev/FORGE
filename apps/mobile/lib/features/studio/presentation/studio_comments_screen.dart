import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../watch/data/watch_repository.dart';
import '../data/studio_repository.dart';

final studioCommentsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(studioRepositoryProvider).getRecentComments();
});

class StudioCommentsScreen extends ConsumerWidget {
  const StudioCommentsScreen({super.key});

  Future<void> _pin(WidgetRef ref, Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCommentPinned(videoId, id, isPinned: next);
    ref.invalidate(studioCommentsProvider);
  }

  Future<void> _heart(WidgetRef ref, Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCreatorHeart(videoId, id, creatorHearted: next);
    ref.invalidate(studioCommentsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final commentsAsync = ref.watch(studioCommentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Comments'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: commentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load comments')),
        data: (comments) {
          if (comments.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  ForgeCard(
                    child: Text(
                      'When viewers comment on your videos, they will appear here.',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload video', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: comments.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) {
              final c = comments[i];
              final user = c['user'] as Map<String, dynamic>?;
              final pinned = c['isPinned'] == true;
              final hearted = c['creatorHearted'] == true;
              return ForgeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: () => context.push('/watch/${c['videoId']}'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (pinned)
                            Text(
                              'Pinned',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: ForgeTokens.of(context).onSurfaceVariant,
                              ),
                            ),
                          Text(
                            c['videoTitle'] as String? ?? 'Video',
                            style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).primary),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            c['content'] as String? ?? '',
                            style: TextStyle(color: ForgeTokens.of(context).onSurface),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '@${user?['username'] ?? 'user'}',
                            style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (c['parentId'] == null)
                          TextButton(
                            onPressed: () async {
                              try {
                                await _pin(ref, c, !pinned);
                              } catch (_) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Could not update pin')),
                                  );
                                }
                              }
                            },
                            child: Text(pinned ? 'Unpin' : 'Pin'),
                          ),
                        TextButton(
                          onPressed: () async {
                            try {
                              await _heart(ref, c, !hearted);
                            } catch (_) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Could not update heart')),
                                );
                              }
                            }
                          },
                          child: Text(hearted ? 'Remove heart' : 'Heart'),
                        ),
                        TextButton(
                          onPressed: () => context.push('/watch/${c['videoId']}'),
                          child: const Text('Open video'),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}
