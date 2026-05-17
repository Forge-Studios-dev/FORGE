import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/studio_repository.dart';

final studioCommentsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(studioRepositoryProvider).getRecentComments();
});

class StudioCommentsScreen extends ConsumerWidget {
  const StudioCommentsScreen({super.key});

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
                  const ForgeCard(
                    child: Text(
                      'When learners comment on your lessons, they will appear here.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload lesson', onPressed: () => context.push('/upload')),
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
              return ForgeCard(
                onTap: () => context.push('/watch/${c['videoId']}'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c['videoTitle'] as String? ?? 'Lesson',
                      style: const TextStyle(fontSize: 12, color: ForgeTokens.primary),
                    ),
                    const SizedBox(height: 8),
                    Text(c['content'] as String? ?? '', style: const TextStyle(color: ForgeTokens.onSurface)),
                    const SizedBox(height: 8),
                    Text(
                      '@${user?['username'] ?? 'user'}',
                      style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
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
