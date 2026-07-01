import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

final creatorCoursesCatalogProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/courses');
  return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
});

class CreatorCoursesPanel extends ConsumerWidget {
  const CreatorCoursesPanel({
    super.key,
    required this.creatorId,
    required this.username,
  });

  final String creatorId;
  final String username;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(creatorCoursesCatalogProvider(creatorId));

    return coursesAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (courses) {
        if (courses.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Courses',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              const Text(
                'Structured lessons from this creator.',
                style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              ...courses.map((course) {
                final id = course['id'] as String? ?? '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ForgeCard(
                    onTap: () => context.push('/courses/$id'),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                course['title'] as String? ?? 'Course',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              if ((course['description'] as String?)?.isNotEmpty == true)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    course['description'] as String,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: ForgeTokens.onSurfaceVariant,
                                    ),
                                  ),
                                ),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  '${course['lessonCount'] ?? 0} lesson${course['lessonCount'] == 1 ? '' : 's'}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: ForgeTokens.onSurfaceVariant,
                                  ),
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
              }),
              TextButton(
                onPressed: () => context.push('/discover/courses'),
                child: const Text('Discover more courses'),
              ),
            ],
          ),
        );
      },
    );
  }
}
