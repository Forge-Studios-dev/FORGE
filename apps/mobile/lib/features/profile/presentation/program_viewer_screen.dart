import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import 'profile_screen.dart';

class ProgramViewerScreen extends ConsumerStatefulWidget {
  const ProgramViewerScreen({
    super.key,
    required this.username,
    required this.slug,
  });

  final String username;
  final String slug;

  @override
  ConsumerState<ProgramViewerScreen> createState() => _ProgramViewerScreenState();
}

class _ProgramViewerScreenState extends ConsumerState<ProgramViewerScreen> {
  Map<String, dynamic>? _program;
  bool _loading = true;
  bool _enrolling = false;
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
      final client = ref.read(apiClientProvider);
      final profileRes = await client.dio.get('/users/by-username/${widget.username}');
      final creatorId = profileRes.data['data']?['id'] as String?;
      if (creatorId == null) throw Exception('Creator not found');
      final programRes = await client.dio.get(
        '/creators/$creatorId/programs/${widget.slug}',
      );
      setState(() {
        _program = programRes.data['data'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Program not found';
      });
    }
  }

  Future<void> _enroll() async {
    final programId = _program?['id'] as String?;
    if (programId == null) return;
    setState(() => _enrolling = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/programs/$programId/enroll', data: {});
      final courses = (_program?['courses'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final firstCourseId = courses.isNotEmpty ? courses.first['courseId'] as String? : null;
      if (mounted && firstCourseId != null) {
        context.push('/courses/$firstCourseId');
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enrolled in program')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to enroll in this program')),
        );
      }
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(userProfileProvider(widget.username));

    return Scaffold(
      appBar: AppBar(title: Text(_program?['name'] as String? ?? 'Program')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || _program == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error ?? 'Program not found'),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => context.pop(),
                        child: const Text('Back to profile'),
                      ),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    profileAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (user) => Text(
                        'by ${user.displayName}',
                        style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                      ),
                    ),
                    if ((_program!['description'] as String?)?.isNotEmpty == true) ...[
                      const SizedBox(height: 12),
                      Text(_program!['description'] as String),
                    ],
                    const SizedBox(height: 24),
                    const Text(
                      'Courses in this program',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    const SizedBox(height: 8),
                    ...((_program!['courses'] as List?)?.cast<Map<String, dynamic>>() ?? [])
                        .asMap()
                        .entries
                        .map((entry) {
                      final row = entry.value;
                      final course = row['course'] as Map<String, dynamic>?;
                      final courseId = row['courseId'] as String?;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          radius: 14,
                          child: Text('${entry.key + 1}'),
                        ),
                        title: Text(course?['title'] as String? ?? 'Course'),
                        trailing: courseId != null
                            ? TextButton(
                                onPressed: () => context.push('/courses/$courseId'),
                                child: const Text('Open'),
                              )
                            : null,
                      );
                    }),
                    const SizedBox(height: 24),
                    ForgeButton(
                      label: _enrolling ? 'Enrolling…' : 'Enroll in program',
                      onPressed: _enrolling ? null : _enroll,
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => context.pop(),
                      child: const Text('Back to profile'),
                    ),
                  ],
                ),
    );
  }
}
