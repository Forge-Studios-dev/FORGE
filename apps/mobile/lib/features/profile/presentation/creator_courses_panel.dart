import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

final creatorCoursesCatalogProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/courses');
  return readApiList(response.data);
});

final creatorProgramsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/programs');
  return readApiList(response.data);
});

/// One "Courses" panel covering both individual courses and programs (a
/// program is a course-row bundle grouping several courses — see
/// apps/api/.../1839800000000-merge-programs-into-courses.ts) instead of two
/// separately-titled profile sections, matching the same fold-in on web
/// (apps/web/src/components/Courses/CreatorCoursesPanel.tsx).
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
    final platformConfig = ref.watch(platformConfigProvider).valueOrNull ?? {};
    final lmsEnabled = platformSkillEconomyLmsEnabled(platformConfig);

    final coursesAsync = ref.watch(creatorCoursesCatalogProvider(creatorId));
    final programsAsync = lmsEnabled
        ? ref.watch(creatorProgramsProvider(creatorId))
        : const AsyncValue<List<Map<String, dynamic>>>.data([]);

    final courses = coursesAsync.asData?.value ?? const <Map<String, dynamic>>[];
    final programs = lmsEnabled
        ? (programsAsync.asData?.value ?? const <Map<String, dynamic>>[])
        : const <Map<String, dynamic>>[];
    final stillLoading = coursesAsync.isLoading || (lmsEnabled && programsAsync.isLoading);

    if (stillLoading) return const SizedBox.shrink();
    if (courses.isEmpty && programs.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Courses',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          if (courses.isNotEmpty) ...[
            const SizedBox(height: 4),
            const Text(
              'Structured lessons from this creator.',
              style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            ...courses.map((course) => _CourseCard(course: course)),
            TextButton(
              onPressed: () => context.push('/discover/courses'),
              child: const Text('Discover more courses'),
            ),
          ],
          if (programs.isNotEmpty) ...[
            SizedBox(height: courses.isNotEmpty ? 16 : 4),
            const Text(
              'PROGRAMS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.1,
                color: ForgeTokens.outline,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Multi-course paths curated by this creator.',
              style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            ...programs.map((program) => _ProgramCard(program: program, username: username)),
          ],
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.course});

  final Map<String, dynamic> course;

  @override
  Widget build(BuildContext context) {
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
                        style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${course['lessonCount'] ?? 0} lesson${course['lessonCount'] == 1 ? '' : 's'}',
                      style: const TextStyle(fontSize: 11, color: ForgeTokens.onSurfaceVariant),
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
  }
}

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({required this.program, required this.username});

  final Map<String, dynamic> program;
  final String username;

  @override
  Widget build(BuildContext context) {
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
                        style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${courses.length} course${courses.length == 1 ? '' : 's'}',
                      style: const TextStyle(fontSize: 11, color: ForgeTokens.onSurfaceVariant),
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
  }
}
