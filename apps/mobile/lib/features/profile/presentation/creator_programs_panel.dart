import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

final creatorProgramsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/programs');
  return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
});

class CreatorProgramsPanel extends ConsumerWidget {
  const CreatorProgramsPanel({
    super.key,
    required this.creatorId,
    required this.username,
  });

  final String creatorId;
  final String username;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final programsAsync = ref.watch(creatorProgramsProvider(creatorId));

    return programsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (programs) {
        if (programs.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Learning programs',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 4),
              const Text(
                'Multi-course paths curated by this creator.',
                style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              ...programs.map((program) {
                final slug = program['slug'] as String? ?? '';
                final courses = (program['courses'] as List?) ?? [];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ForgeCard(
                    onTap: () => context.push('/profile/$username/programs/$slug'),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                program['name'] as String? ?? 'Program',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              if ((program['description'] as String?)?.isNotEmpty == true)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(
                                    program['description'] as String,
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
                                  '${courses.length} course${courses.length == 1 ? '' : 's'}',
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
            ],
          ),
        );
      },
    );
  }
}
