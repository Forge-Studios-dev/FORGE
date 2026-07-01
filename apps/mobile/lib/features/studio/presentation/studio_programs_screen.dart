import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioProgramsScreen extends ConsumerStatefulWidget {
  const StudioProgramsScreen({super.key});

  @override
  ConsumerState<StudioProgramsScreen> createState() => _StudioProgramsScreenState();
}

class _StudioProgramsScreenState extends ConsumerState<StudioProgramsScreen> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  List<Map<String, dynamic>> _programs = [];
  List<Map<String, dynamic>> _courses = [];
  List<Map<String, dynamic>> _communities = [];
  final Set<String> _selectedCourseIds = {};
  String? _communityId;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final programsRes = await client.dio.get('/creators/me/programs');
      final coursesRes = await client.dio.get('/creators/me/courses');
      List<Map<String, dynamic>> communities = [];
      try {
        final me = await client.dio.get('/users/me');
        final creatorId = me.data['data']?['id'] as String?;
        if (creatorId != null) {
          final communitiesRes = await client.dio.get('/creators/$creatorId/communities');
          communities =
              (communitiesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        }
      } catch (_) {}
      setState(() {
        _programs = (programsRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _courses = (coursesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _communities = communities;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createProgram() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/programs', data: {
        'name': _nameCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        if (_communityId != null) 'communityId': _communityId,
        'courseIds': _selectedCourseIds.toList(),
        'isPublished': false,
      });
      _nameCtrl.clear();
      _descCtrl.clear();
      _selectedCourseIds.clear();
      _communityId = null;
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Program created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create program')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _togglePublish(String programId, bool publish) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/programs/$programId', data: {
        'isPublished': publish,
      });
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update program')),
        );
      }
    }
  }

  Future<void> _deleteProgram(String programId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/programs/$programId');
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete program')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Programs')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Group multiple courses into a structured learning program.',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Program name'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                if (_communities.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String?>(
                    value: _communityId,
                    decoration: const InputDecoration(labelText: 'Linked community (optional)'),
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('No community')),
                      ..._communities.map(
                        (c) => DropdownMenuItem<String?>(
                          value: c['id'] as String?,
                          child: Text(c['name'] as String? ?? 'Community'),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _communityId = v),
                  ),
                ],
                if (_courses.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Courses in program', style: TextStyle(fontWeight: FontWeight.w600)),
                  ..._courses.map((course) {
                    final id = course['id'] as String;
                    return CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _selectedCourseIds.contains(id),
                      onChanged: (checked) {
                        setState(() {
                          if (checked == true) {
                            _selectedCourseIds.add(id);
                          } else {
                            _selectedCourseIds.remove(id);
                          }
                        });
                      },
                      title: Text(course['title'] as String? ?? 'Course'),
                    );
                  }),
                ] else
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Create courses first to add them to a program.',
                      style: TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
                    ),
                  ),
                const SizedBox(height: 12),
                ForgeButton(
                  label: _saving ? 'Creating…' : 'Create program',
                  onPressed: _saving || _nameCtrl.text.trim().isEmpty ? null : _createProgram,
                ),
                const SizedBox(height: 24),
                const Text('Your programs', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (_programs.isEmpty)
                  const Text('No programs yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
                else
                  ..._programs.map((program) {
                    final id = program['id'] as String;
                    final courses = (program['courses'] as List?) ?? [];
                    final published = program['isPublished'] == true;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
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
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: ForgeTokens.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                '${courses.length} course${courses.length == 1 ? '' : 's'} · ${published ? 'Published' : 'Draft'}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: ForgeTokens.onSurfaceVariant,
                                ),
                              ),
                            ),
                            Row(
                              children: [
                                TextButton(
                                  onPressed: () => _togglePublish(id, !published),
                                  child: Text(published ? 'Unpublish' : 'Publish'),
                                ),
                                TextButton(
                                  onPressed: () => _deleteProgram(id),
                                  child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                                ),
                              ],
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
