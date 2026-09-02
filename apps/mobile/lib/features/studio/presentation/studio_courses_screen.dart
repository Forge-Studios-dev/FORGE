import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

/// Courses + Programs in one screen (two tabs) — a program is a Course row
/// with isBundle=true (apps/api/.../1839800000000-merge-programs-into-courses.ts),
/// so authoring them side by side matches the data model instead of splitting
/// across two separate Studio nav entries. Named "Programs", not "Bundles", to
/// avoid colliding with the separate /studio/bundles (tier-resource) feature.
class StudioCoursesScreen extends ConsumerStatefulWidget {
  const StudioCoursesScreen({super.key, this.initialTab});

  /// `programs` opens the Programs tab when LMS is enabled.
  final String? initialTab;

  @override
  ConsumerState<StudioCoursesScreen> createState() => _StudioCoursesScreenState();
}

class _StudioCoursesScreenState extends ConsumerState<StudioCoursesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _lms = false;

  @override
  void initState() {
    super.initState();
    // Start with courses-only; expand to Programs after platform config loads.
    _tabController = TabController(length: 1, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _syncTabController(bool lms) {
    final length = lms ? 2 : 1;
    if (_lms == lms && _tabController.length == length) return;
    final previous = _tabController;
    final openPrograms = lms && widget.initialTab == 'programs';
    final nextIndex = openPrograms
        ? 1
        : previous.index.clamp(0, length - 1);
    _lms = lms;
    _tabController = TabController(
      length: length,
      vsync: this,
      initialIndex: nextIndex,
    );
    setState(() {});
    // Dispose after the frame so TabBar/TabBarView are not holding the old controller.
    WidgetsBinding.instance.addPostFrameCallback((_) => previous.dispose());
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).asData?.value ?? {};
    if (!platformCoursesEnabled(platformConfig)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/studio');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final lms = platformSkillEconomyLmsEnabled(platformConfig);
    if (lms != _lms || _tabController.length != (lms ? 2 : 1)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncTabController(lms);
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Courses'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: 'Courses'),
            if (_lms) const Tab(text: 'Programs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          const _CoursesTab(),
          if (_lms) const _ProgramsTab(),
        ],
      ),
    );
  }
}

class _CoursesTab extends ConsumerStatefulWidget {
  const _CoursesTab();

  @override
  ConsumerState<_CoursesTab> createState() => _CoursesTabState();
}

class _CoursesTabState extends ConsumerState<_CoursesTab> {
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
        _courses = readApiList(response.data);
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
    if (_loading) return const Center(child: CircularProgressIndicator());
    return ListView(
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
    );
  }
}

class _ProgramsTab extends ConsumerStatefulWidget {
  const _ProgramsTab();

  @override
  ConsumerState<_ProgramsTab> createState() => _ProgramsTabState();
}

class _ProgramsTabState extends ConsumerState<_ProgramsTab> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController(text: '0');
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
    _priceCtrl.dispose();
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
        _programs = readApiList(programsRes.data);
        _courses = readApiList(coursesRes.data);
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
        'priceCents': int.tryParse(_priceCtrl.text.trim()) ?? 0,
      });
      _nameCtrl.clear();
      _descCtrl.clear();
      _priceCtrl.text = '0';
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
    if (_loading) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Group multiple of your courses into a paid, orderable learning program.',
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
        const SizedBox(height: 8),
        TextField(
          controller: _priceCtrl,
          decoration: const InputDecoration(
            labelText: 'Price in cents (0 = free, min 100 for paid checkout)',
          ),
          keyboardType: TextInputType.number,
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
          const Text('Courses in this program', style: TextStyle(fontWeight: FontWeight.w600)),
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
              'Create courses first, then group them into a program here.',
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
            final priceCents = program['priceCents'] as int? ?? 0;
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
                        '${courses.length} course${courses.length == 1 ? '' : 's'} · ${published ? 'Published' : 'Draft'}'
                        '${priceCents > 0 ? ' · \$${(priceCents / 100).toStringAsFixed(2)}' : ' · Free'}',
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
    );
  }
}
