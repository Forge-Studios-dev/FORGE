import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/public_video_path.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

class CourseViewerScreen extends ConsumerStatefulWidget {
  const CourseViewerScreen({super.key, required this.courseId});

  final String courseId;

  @override
  ConsumerState<CourseViewerScreen> createState() => _CourseViewerScreenState();
}

class _CourseViewerScreenState extends ConsumerState<CourseViewerScreen> {
  List<Map<String, dynamic>> _lessons = [];
  Map<String, dynamic>? _progress;
  bool _loading = true;
  bool _guestMode = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await ref.read(authRepositoryProvider).getStoredUser();
      final client = ref.read(apiClientProvider);

      if (user == null) {
        final catalogRes =
            await client.dio.get('/courses/${widget.courseId}/catalog/lessons');
        final lessons = readApiList(catalogRes.data);
        setState(() {
          _lessons = lessons;
          _progress = null;
          _guestMode = true;
          _loading = false;
        });
        return;
      }

      final lessonsRes = await client.dio.get('/courses/${widget.courseId}/lessons');
      final lessons = readApiList(lessonsRes.data);
      Map<String, dynamic>? progress;
      try {
        final progressRes = await client.dio.get('/courses/${widget.courseId}/progress');
        progress = readApiMap(progressRes.data);
      } catch (_) {
        progress = null;
      }
      setState(() {
        _lessons = lessons;
        _progress = progress;
        _guestMode = false;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = 'Course access required or not enrolled';
      });
    }
  }

  Future<void> _enroll() async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/courses/${widget.courseId}/enroll', data: {});
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enrollment failed — check membership')),
        );
      }
    }
  }

  Future<void> _completeLesson(String lessonId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/courses/${widget.courseId}/lessons/$lessonId/progress',
        data: {'progressPercent': 100},
      );
      await _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).valueOrNull ?? {};
    if (!platformCoursesEnabled(platformConfig)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/explore');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Course')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        ForgeButton(label: 'Enroll', onPressed: _enroll),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    if (_guestMode) ...[
                      Text(
                        'Sign in to enroll and access full lesson content.',
                        style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                      ),
                      const SizedBox(height: 8),
                      ForgeButton(
                        label: 'Sign in',
                        onPressed: () => context.push('/login?next=/courses/${widget.courseId}'),
                      ),
                      const SizedBox(height: 20),
                    ] else if (_progress != null) ...[
                      Text('Progress: ${_progress!['progress'] ?? 0}%',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      LinearProgressIndicator(
                        value: ((_progress!['progress'] as num?) ?? 0) / 100,
                        backgroundColor: ForgeTokens.surfaceContainerHigh,
                        color: ForgeTokens.primary,
                      ),
                      const SizedBox(height: 20),
                    ] else if (!_guestMode)
                      ForgeButton(label: 'Enroll in course', onPressed: _enroll),
                    if (_lessons.isEmpty)
                      const Text('No lessons yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
                    else
                      ..._lessons.asMap().entries.map((entry) {
                        final i = entry.key;
                        final lesson = entry.value;
                        final id = lesson['id'] as String;
                        final lessonType = lesson['lessonType'] as String? ?? 'text';
                        final duration = lesson['durationMinutes'] as num?;

                        if (_guestMode) {
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              title: Text('${i + 1}. ${lesson['title']}'),
                              trailing: Text(
                                '${lessonType == 'video' ? 'Video' : 'Text'}'
                                '${duration != null ? ' · ${duration}m' : ''}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: ForgeTokens.onSurfaceVariant,
                                ),
                              ),
                            ),
                          );
                        }

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${i + 1}. ${lesson['title']}',
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                                if (lessonType == 'video' && lesson['video'] is Map<String, dynamic>)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: TextButton(
                                      onPressed: () {
                                        final video = lesson['video'] as Map<String, dynamic>;
                                        final videoId = video['id'] as String?;
                                        if (videoId == null) return;
                                        context.push(publicVideoPath(id: videoId));
                                      },
                                      child: Text(
                                        'Watch lesson video'
                                        '${lesson['video']?['title'] != null ? ' — ${lesson['video']['title']}' : ''}',
                                      ),
                                    ),
                                  ),
                                if (lesson['content'] != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text('${lesson['content']}',
                                        style: const TextStyle(
                                            fontSize: 14, color: ForgeTokens.onSurfaceVariant)),
                                  ),
                                const SizedBox(height: 8),
                                TextButton(
                                  onPressed: () => _completeLesson(id),
                                  child: const Text('Mark complete'),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                  ],
                ),
    );
  }
}
