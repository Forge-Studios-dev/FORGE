import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../auth/data/auth_repository.dart';

class StudioCourseDetailScreen extends ConsumerStatefulWidget {
  const StudioCourseDetailScreen({super.key, required this.courseId});

  final String courseId;

  @override
  ConsumerState<StudioCourseDetailScreen> createState() => _StudioCourseDetailScreenState();
}

class _StudioCourseDetailScreenState extends ConsumerState<StudioCourseDetailScreen> {
  final _lessonTitleCtrl = TextEditingController();
  final _lessonContentCtrl = TextEditingController();
  List<Map<String, dynamic>> _lessons = [];
  List<Map<String, dynamic>> _tiers = [];
  final Map<String, String?> _tierEntitlementIds = {};
  String? _courseTitle;
  bool _isPublished = false;
  String? _creatorId;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _creatorId = user?['id'] as String?;
      final client = ref.read(apiClientProvider);
      final coursesRes = await client.dio.get('/creators/me/courses');
      final courses = (coursesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      Map<String, dynamic>? course;
      for (final c in courses) {
        if (c['id'] == widget.courseId) {
          course = c;
          break;
        }
      }
      if (_creatorId != null) {
        final tiersRes = await client.dio.get('/creators/$_creatorId/tiers');
        _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _tierEntitlementIds.clear();
        for (final tier in _tiers) {
          final tierId = tier['id'] as String;
          final entRes = await client.dio.get('/creators/me/tiers/$tierId/entitlements');
          final ents = (entRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          String? matchId;
          for (final e in ents) {
            if (e['resourceType'] == 'course' && e['resourceId'] == widget.courseId) {
              matchId = e['id'] as String?;
              break;
            }
          }
          _tierEntitlementIds[tierId] = matchId;
        }
      }
      final lessonsRes = await client.dio.get('/courses/${widget.courseId}/lessons');
      setState(() {
        _courseTitle = course?['title'] as String?;
        _isPublished = course?['isPublished'] == true;
        _lessons = (lessonsRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _togglePublish() async {
    setState(() => _busy = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/courses/${widget.courseId}', data: {
        'isPublished': !_isPublished,
      });
      setState(() => _isPublished = !_isPublished);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_isPublished ? 'Course published' : 'Course unpublished')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update publish state')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleTierAccess(String tierId, bool hasAccess) async {
    setState(() => _busy = true);
    try {
      final client = ref.read(apiClientProvider);
      if (hasAccess) {
        final entId = _tierEntitlementIds[tierId];
        if (entId != null) {
          await client.dio.delete('/creators/me/tiers/$tierId/entitlements/$entId');
        }
      } else {
        await client.dio.post('/creators/me/tiers/$tierId/entitlements', data: {
          'resourceType': 'course',
          'resourceId': widget.courseId,
          'accessLevel': 'full',
        });
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update tier access')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addLesson() async {
    if (_lessonTitleCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/courses/${widget.courseId}/lessons', data: {
        'title': _lessonTitleCtrl.text.trim(),
        if (_lessonContentCtrl.text.trim().isNotEmpty) 'content': _lessonContentCtrl.text.trim(),
        'sortOrder': _lessons.length,
      });
      _lessonTitleCtrl.clear();
      _lessonContentCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lesson added')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not add lesson')),
        );
      }
    }
  }

  @override
  void dispose() {
    _lessonTitleCtrl.dispose();
    _lessonContentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_courseTitle ?? 'Course')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                ForgeCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _isPublished ? 'Published' : 'Draft',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            Text(
                              _isPublished
                                  ? 'Members with tier access can enroll'
                                  : 'Only you can preview lessons',
                              style: const TextStyle(
                                fontSize: 12,
                                color: ForgeTokens.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: _busy ? null : _togglePublish,
                        child: Text(_isPublished ? 'Unpublish' : 'Publish'),
                      ),
                    ],
                  ),
                ),
                if (_tiers.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Text('Tier access', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  ..._tiers.map((tier) {
                    final tierId = tier['id'] as String;
                    final hasAccess = _tierEntitlementIds[tierId] != null;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: ListTile(
                        title: Text(tier['name'] as String? ?? 'Tier'),
                        trailing: TextButton(
                          onPressed: _busy ? null : () => _toggleTierAccess(tierId, hasAccess),
                          child: Text(hasAccess ? 'Remove' : 'Grant'),
                        ),
                      ),
                    );
                  }),
                ],
                const SizedBox(height: 24),
                TextField(
                  controller: _lessonTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Lesson title'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _lessonContentCtrl,
                  decoration: const InputDecoration(labelText: 'Lesson content'),
                  maxLines: 5,
                ),
                const SizedBox(height: 12),
                ForgeButton(label: 'Add lesson', onPressed: _addLesson),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => context.push('/courses/${widget.courseId}'),
                  child: const Text('Preview as member'),
                ),
                const SizedBox(height: 24),
                Text('Lessons (${_lessons.length})',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (_lessons.isEmpty)
                  const Text('No lessons yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
                else
                  ..._lessons.asMap().entries.map((entry) {
                    final i = entry.key;
                    final lesson = entry.value;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text('${i + 1}. ${lesson['title']}'),
                        subtitle: lesson['content'] != null
                            ? Text('${lesson['content']}', maxLines: 2, overflow: TextOverflow.ellipsis)
                            : null,
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}
