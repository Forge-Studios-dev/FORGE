import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/csv_export_util.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

import 'studio_rooms_screen.dart';
import 'studio_engagement_screen.dart';
import 'studio_moderation_screen.dart';

class StudioCommunityScreen extends ConsumerStatefulWidget {
  const StudioCommunityScreen({super.key, this.initialTabIndex = 0});

  final int initialTabIndex;

  @override
  ConsumerState<StudioCommunityScreen> createState() => _StudioCommunityScreenState();
}

class _StudioCommunityScreenState extends ConsumerState<StudioCommunityScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _communityNameCtrl = TextEditingController();
  final _editCommunityNameCtrl = TextEditingController();
  final _editCommunitySlugCtrl = TextEditingController();
  final _categoryNameCtrl = TextEditingController();
  final _editCategoryNameCtrl = TextEditingController();
  String? _editingCategoryId;
  List<Map<String, dynamic>> _categories = [];
  String _communityVisibility = 'public';
  String _editCommunityVisibility = 'public';
  String? _creatorId;
  String? _communityId;
  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _pendingMembers = [];
  List<Map<String, dynamic>> _activeMembers = [];
  List<Map<String, dynamic>> _suspendedMembers = [];
  bool _loading = true;
  bool _exportingMembers = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 5,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 4),
    );
    _load();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _creatorId = user?['id'] as String?;
      if (_creatorId == null) return;
      final client = ref.read(apiClientProvider);
      final communitiesRes = await client.dio.get('/creators/$_creatorId/communities');
      final communities =
          (communitiesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (communities.isEmpty) {
        setState(() => _loading = false);
        return;
      }
      _communityId = communities.first['id'] as String?;
      final slug = communities.first['slug'] as String?;
      final communityRes = slug != null
          ? await client.dio.get('/creators/$_creatorId/communities/$slug')
          : communitiesRes;
      List<Map<String, dynamic>> pending = [];
      if (_communityId != null) {
        try {
          final pendingRes = await client.dio.get(
            '/creators/me/communities/$_communityId/members?status=pending',
          );
          pending = (pendingRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        } catch (_) {}
      }
      setState(() {
        _communities = communities;
        final data = communityRes.data['data'] as Map<String, dynamic>;
        _categories = (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _pendingMembers = pending;
        _loading = false;
      });
      _syncCommunityEditFields(_communityId);
      await _loadMemberRoster();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _goLiveInCommunity() async {
    if (_communityId == null) return;
    Map<String, dynamic>? community;
    for (final c in _communities) {
      if (c['id'] == _communityId) {
        community = c;
        break;
      }
    }
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post('/streams/start', data: {
        'title': '${community?['name'] ?? 'Community'} Live',
        'communityId': _communityId,
        'visibility': 'subscribers',
      });
      final streamId = response.data['data']?['id'] as String?;
      if (mounted && streamId != null) {
        context.go('/live/$streamId');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not start community live')),
        );
      }
    }
  }

  Future<void> _createCommunity() async {
    if (_communityNameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities', data: {
        'name': _communityNameCtrl.text.trim(),
        'visibility': _communityVisibility,
      });
      _communityNameCtrl.clear();
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create community')),
        );
      }
    }
  }

  Future<void> _deleteCategory(String categoryId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/categories/$categoryId');
      await _selectCommunity(_communityId!, null);
    } catch (_) {}
  }

  Future<void> _updateCategory(String categoryId) async {
    if (_communityId == null || _editCategoryNameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/communities/$_communityId/categories/$categoryId', data: {
        'name': _editCategoryNameCtrl.text.trim(),
      });
      setState(() => _editingCategoryId = null);
      await _selectCommunity(_communityId!, null);
    } catch (_) {}
  }

  Future<void> _createCategory() async {
    if (_categoryNameCtrl.text.trim().isEmpty || _communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$_communityId/categories', data: {
        'name': _categoryNameCtrl.text.trim(),
      });
      _categoryNameCtrl.clear();
      final slug = _communities.firstWhere((c) => c['id'] == _communityId)['slug'] as String?;
      if (_communityId != null) await _selectCommunity(_communityId!, slug);
    } catch (_) {}
  }

  void _syncCommunityEditFields(String? communityId) {
    if (communityId == null) return;
    Map<String, dynamic>? selected;
    for (final c in _communities) {
      if (c['id'] == communityId) {
        selected = c;
        break;
      }
    }
    if (selected == null) return;
    _editCommunityNameCtrl.text = selected['name'] as String? ?? '';
    _editCommunitySlugCtrl.text = selected['slug'] as String? ?? '';
    _editCommunityVisibility = selected['visibility'] as String? ?? 'public';
  }

  Future<void> _saveCommunitySettings() async {
    if (_communityId == null || _editCommunityNameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/communities/$_communityId', data: {
        'name': _editCommunityNameCtrl.text.trim(),
        'slug': _editCommunitySlugCtrl.text.trim(),
        'visibility': _editCommunityVisibility,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Community settings saved')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save community settings')),
        );
      }
    }
  }

  Future<void> _loadPendingMembers() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final pendingRes = await client.dio.get(
        '/creators/me/communities/$_communityId/members?status=pending',
      );
      setState(() {
        _pendingMembers =
            (pendingRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
  }

  Future<void> _loadMemberRoster() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final activeRes = await client.dio.get(
        '/creators/me/communities/$_communityId/members?status=active',
      );
      final suspendedRes = await client.dio.get(
        '/creators/me/communities/$_communityId/members?status=suspended',
      );
      setState(() {
        _activeMembers =
            (activeRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _suspendedMembers =
            (suspendedRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
  }

  Future<void> _exportMembersCsv() async {
    if (_communityId == null) return;
    setState(() => _exportingMembers = true);
    try {
      final client = ref.read(apiClientProvider);
      await CsvExportUtil.downloadAndShare(
        dio: client.dio,
        apiPath: '/creators/me/communities/$_communityId/members/export',
        filename: 'community-$_communityId-members.csv',
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not export members')),
        );
      }
    } finally {
      if (mounted) setState(() => _exportingMembers = false);
    }
  }

  Future<void> _approveMember(String userId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/creators/me/communities/$_communityId/members/$userId/approve',
      );
      await _loadPendingMembers();
      await _loadMemberRoster();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not approve member')),
        );
      }
    }
  }

  Future<void> _rejectMember(String userId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/creators/me/communities/$_communityId/members/$userId/reject',
      );
      await _loadPendingMembers();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not reject member')),
        );
      }
    }
  }

  Future<void> _suspendMember(String userId) async {
    if (_communityId == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Suspend member?'),
        content: const Text('They will lose community access until restored.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Suspend')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/creators/me/communities/$_communityId/members/$userId/suspend',
      );
      await _loadMemberRoster();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not suspend member')),
        );
      }
    }
  }

  Future<void> _unsuspendMember(String userId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/creators/me/communities/$_communityId/members/$userId/unsuspend',
      );
      await _loadMemberRoster();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not restore member')),
        );
      }
    }
  }

  String _memberLabel(Map<String, dynamic> row) {
    final user = row['user'] as Map<String, dynamic>?;
    return user?['displayName'] as String? ??
        user?['username'] as String? ??
        row['userId'] as String? ??
        'Member';
  }

  @override
  void dispose() {
    _tabController.dispose();
    _communityNameCtrl.dispose();
    _editCommunityNameCtrl.dispose();
    _editCommunitySlugCtrl.dispose();
    _categoryNameCtrl.dispose();
    _editCategoryNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _selectCommunity(String communityId, String? slug) async {
    if (_creatorId == null) return;
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final communityRes = slug != null
          ? await client.dio.get('/creators/$_creatorId/communities/$slug')
          : await client.dio.get('/communities/id/$communityId');
      setState(() {
        _communityId = communityId;
        final data = communityRes.data['data'] as Map<String, dynamic>;
        _categories = (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
      _syncCommunityEditFields(communityId);
      await _loadPendingMembers();
      await _loadMemberRoster();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Widget _buildMembersTab() {
    if (_communityId == null) {
      return const Center(child: Text('Create a community in Settings first'));
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Join requests', style: TextStyle(fontWeight: FontWeight.w600)),
        if (_pendingMembers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('No pending join requests'),
          )
        else
          ..._pendingMembers.map((row) {
            final userId = row['userId'] as String?;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(_memberLabel(row)),
                subtitle: Text(row['source'] as String? ?? ''),
                trailing: userId == null
                    ? null
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextButton(
                            onPressed: () => _approveMember(userId),
                            child: const Text('Approve'),
                          ),
                          TextButton(
                            onPressed: () => _rejectMember(userId),
                            child: const Text('Reject'),
                          ),
                        ],
                      ),
              ),
            );
          }),
        const Divider(height: 32),
        Row(
          children: [
            const Expanded(
              child: Text('Active members', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            TextButton.icon(
              onPressed: _exportingMembers ? null : _exportMembersCsv,
              icon: _exportingMembers
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_outlined, size: 18),
              label: Text(_exportingMembers ? 'Exporting…' : 'Export CSV'),
            ),
          ],
        ),
        if (_activeMembers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('No active community members yet'),
          )
        else
          ..._activeMembers.map((row) {
            final userId = row['userId'] as String?;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(_memberLabel(row)),
                subtitle: Text(row['source'] as String? ?? ''),
                trailing: userId == null
                    ? null
                    : TextButton(
                        onPressed: () => _suspendMember(userId),
                        child: Text(
                          'Suspend',
                          style: TextStyle(color: ForgeTokens.of(context).error),
                        ),
                      ),
              ),
            );
          }),
        const SizedBox(height: 16),
        const Text('Suspended members', style: TextStyle(fontWeight: FontWeight.w600)),
        if (_suspendedMembers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('No suspended members'),
          )
        else
          ..._suspendedMembers.map((row) {
            final userId = row['userId'] as String?;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(_memberLabel(row)),
                subtitle: Text(row['source'] as String? ?? ''),
                trailing: userId == null
                    ? null
                    : TextButton(
                        onPressed: () => _unsuspendMember(userId),
                        child: const Text('Restore'),
                      ),
              ),
            );
          }),
      ],
    );
  }

  Widget _buildSettingsTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (_communities.length > 1) ...[
          const Text('Your communities', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._communities.map((c) {
            final id = c['id'] as String?;
            final selected = id == _communityId;
            return ListTile(
              selected: selected,
              title: Text(c['name'] as String? ?? 'Community'),
              subtitle: Text('/${c['slug'] ?? ''}'),
              onTap: id == null ? null : () => _selectCommunity(id, c['slug'] as String?),
            );
          }),
          const Divider(height: 32),
        ],
        const Text('Create community', style: TextStyle(fontWeight: FontWeight.w600)),
        TextField(
          controller: _communityNameCtrl,
          decoration: const InputDecoration(labelText: 'Community name'),
        ),
        DropdownButtonFormField<String>(
          value: _communityVisibility,
          decoration: const InputDecoration(labelText: 'Visibility'),
          items: const [
            DropdownMenuItem(value: 'public', child: Text('Public')),
            DropdownMenuItem(value: 'private', child: Text('Private')),
            DropdownMenuItem(value: 'paid', child: Text('Paid')),
            DropdownMenuItem(value: 'invite', child: Text('Invite only')),
          ],
          onChanged: (v) => setState(() => _communityVisibility = v ?? 'public'),
        ),
        ForgeButton(label: 'Create community', onPressed: _createCommunity),
        if (_communityId != null) ...[
          const Divider(height: 32),
          const Text('Community settings', style: TextStyle(fontWeight: FontWeight.w600)),
          TextField(
            controller: _editCommunityNameCtrl,
            decoration: const InputDecoration(labelText: 'Community name'),
          ),
          TextField(
            controller: _editCommunitySlugCtrl,
            decoration: const InputDecoration(labelText: 'Slug'),
          ),
          DropdownButtonFormField<String>(
            value: _editCommunityVisibility,
            decoration: const InputDecoration(labelText: 'Visibility'),
            items: const [
              DropdownMenuItem(value: 'public', child: Text('Public')),
              DropdownMenuItem(value: 'private', child: Text('Private')),
              DropdownMenuItem(value: 'paid', child: Text('Paid')),
              DropdownMenuItem(value: 'invite', child: Text('Invite only')),
            ],
            onChanged: (v) => setState(() => _editCommunityVisibility = v ?? 'public'),
          ),
          ForgeButton(label: 'Save community settings', onPressed: _saveCommunitySettings),
          const Divider(height: 32),
          const Text('Categories', style: TextStyle(fontWeight: FontWeight.w600)),
          ..._categories.map((cat) {
            final catId = cat['id'] as String?;
            final editing = catId != null && catId == _editingCategoryId;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: editing
                  ? Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        children: [
                          TextField(
                            controller: _editCategoryNameCtrl,
                            decoration: const InputDecoration(labelText: 'Category name'),
                          ),
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => _updateCategory(catId),
                                child: const Text('Save'),
                              ),
                              TextButton(
                                onPressed: () => setState(() => _editingCategoryId = null),
                                child: const Text('Cancel'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    )
                  : ListTile(
                      dense: true,
                      title: Text(cat['name'] as String? ?? ''),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit, size: 20),
                            onPressed: catId == null
                                ? null
                                : () {
                                    setState(() {
                                      _editingCategoryId = catId;
                                      _editCategoryNameCtrl.text = cat['name'] as String? ?? '';
                                    });
                                  },
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 20),
                            onPressed: catId == null ? null : () => _deleteCategory(catId),
                          ),
                        ],
                      ),
                    ),
            );
          }),
          TextField(
            controller: _categoryNameCtrl,
            decoration: const InputDecoration(labelText: 'New category name'),
          ),
          ForgeButton(label: 'Add category', onPressed: _createCategory),
          const Divider(height: 32),
          ForgeButton(label: 'Go live in community', onPressed: _goLiveInCommunity),
        ],
        TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Community'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Rooms'),
            Tab(text: 'Members'),
            Tab(text: 'Engagement'),
            Tab(text: 'Moderation'),
            Tab(text: 'Settings'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                StudioRoomsScreen(
                  key: ValueKey('rooms-$_communityId'),
                  embedded: true,
                  fixedCommunityId: _communityId,
                ),
                _buildMembersTab(),
                StudioEngagementScreen(
                  key: ValueKey('engagement-$_communityId'),
                  embedded: true,
                  fixedCommunityId: _communityId,
                ),
                StudioModerationScreen(
                  key: ValueKey('moderation-$_communityId'),
                  embedded: true,
                  fixedCommunityId: _communityId,
                ),
                _buildSettingsTab(),
              ],
            ),
    );
  }
}
