import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioCoursesScreen extends ConsumerStatefulWidget {
  const StudioCoursesScreen({super.key});

  @override
  ConsumerState<StudioCoursesScreen> createState() => _StudioCoursesScreenState();
}

class _StudioCoursesScreenState extends ConsumerState<StudioCoursesScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  List<Map<String, dynamic>> _courses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/courses');
      setState(() {
        _courses = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createCourse() async {
    if (_titleCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/courses', data: {
        'title': _titleCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
      });
      _titleCtrl.clear();
      _descCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Course created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create course')),
        );
      }
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Courses')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(labelText: 'Course title'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                ForgeButton(label: 'Create course', onPressed: _createCourse),
                const SizedBox(height: 24),
                const Text('Your courses', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (_courses.isEmpty)
                  const Text('No courses yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
                else
                  ..._courses.map((c) {
                    final id = c['id'] as String;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        onTap: () => context.push('/studio/courses/$id'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c['title'] as String? ?? 'Course',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(
                              '/${c['slug'] ?? ''}${c['isPublished'] == true ? ' · Published' : ' · Draft'}',
                              style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
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
