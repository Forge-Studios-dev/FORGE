import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

class StudioCommunityScreen extends ConsumerStatefulWidget {
  const StudioCommunityScreen({super.key});

  @override
  ConsumerState<StudioCommunityScreen> createState() => _StudioCommunityScreenState();
}

class _StudioCommunityScreenState extends ConsumerState<StudioCommunityScreen> {
  final _nameCtrl = TextEditingController();
  final _communityNameCtrl = TextEditingController();
  final _editCommunityNameCtrl = TextEditingController();
  final _editCommunitySlugCtrl = TextEditingController();
  final _categoryNameCtrl = TextEditingController();
  final _editCategoryNameCtrl = TextEditingController();
  final _editChannelNameCtrl = TextEditingController();
  final _inviteUserIdCtrl = TextEditingController();
  String _type = 'public';
  String? _channelCategoryId;
  String? _editChannelCategoryId;
  String? _editChannelType;
  String? _editChannelTierId;
  String? _editingCategoryId;
  String? _editingChannelId;
  String _communityVisibility = 'public';
  String _editCommunityVisibility = 'public';
  String? _requiredTierId;
  String? _creatorId;
  String? _invitingChannelId;
  List<Map<String, dynamic>> _channels = [];
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _subscribers = [];
  List<Map<String, dynamic>> _pendingMembers = [];
  String? _communityId;
  bool _loading = true;

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
      final tiersRes = await client.dio.get('/creators/$_creatorId/tiers');
      final subsRes = await client.dio.get('/creators/me/subscribers');
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
        _channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _categories = (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _subscribers = (subsRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _pendingMembers = pending;
        _loading = false;
      });
      _syncCommunityEditFields(_communityId);
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

  Future<void> _createChannel() async {
    if (_nameCtrl.text.trim().isEmpty || _communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$_communityId/channels', data: {
        'name': _nameCtrl.text.trim(),
        'type': _type,
        if (_requiredTierId != null && _requiredTierId!.isNotEmpty)
          'requiredTierId': _requiredTierId,
        if (_channelCategoryId != null && _channelCategoryId!.isNotEmpty)
          'categoryId': _channelCategoryId,
      });
      _nameCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Channel created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create channel')),
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

  Future<void> _updateChannel(String channelId) async {
    if (_editChannelNameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/channels/$channelId', data: {
        'name': _editChannelNameCtrl.text.trim(),
        if (_editChannelType != null) 'type': _editChannelType,
        'requiredTierId': _editChannelTierId?.isEmpty == true ? null : _editChannelTierId,
        'categoryId': _editChannelCategoryId?.isEmpty == true ? null : _editChannelCategoryId,
      });
      setState(() => _editingChannelId = null);
      await _selectCommunity(_communityId!, null);
    } catch (_) {}
  }

  Future<void> _reorderChannels(int fromIndex, int toIndex) async {
    if (_communityId == null || fromIndex == toIndex) return;
    final reordered = [..._channels];
    final item = reordered.removeAt(fromIndex);
    reordered.insert(toIndex, item);
    final ids = reordered.map((c) => c['id'] as String).toList();
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/communities/$_communityId/channels/reorder', data: {
        'channelIds': ids,
      });
      setState(() => _channels = reordered);
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

  Future<void> _inviteToChannel(String channelId) async {
    final userId = _inviteUserIdCtrl.text.trim();
    if (userId.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/channels/$channelId/invite', data: {
        'userId': userId,
      });
      _inviteUserIdCtrl.clear();
      setState(() => _invitingChannelId = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invite sent')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send invite')),
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

  Future<void> _approveMember(String userId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/creators/me/communities/$_communityId/members/$userId/approve',
      );
      await _loadPendingMembers();
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

  String _memberLabel(Map<String, dynamic> row) {
    final user = row['user'] as Map<String, dynamic>?;
    return user?['displayName'] as String? ??
        user?['username'] as String? ??
        row['userId'] as String? ??
        'Member';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _communityNameCtrl.dispose();
    _editCommunityNameCtrl.dispose();
    _editCommunitySlugCtrl.dispose();
    _categoryNameCtrl.dispose();
    _editCategoryNameCtrl.dispose();
    _editChannelNameCtrl.dispose();
    _inviteUserIdCtrl.dispose();
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
        _channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _categories = (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
      _syncCommunityEditFields(communityId);
      await _loadPendingMembers();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Community channels')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (_communities.length > 1) ...[
                  const Text(
                    'Your communities',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  ..._communities.map((c) {
                    final id = c['id'] as String?;
                    final selected = id == _communityId;
                    return ListTile(
                      selected: selected,
                      title: Text(c['name'] as String? ?? 'Community'),
                      subtitle: Text('/${c['slug'] ?? ''}'),
                      onTap: id == null
                          ? null
                          : () => _selectCommunity(id, c['slug'] as String?),
                    );
                  }),
                  const Divider(height: 32),
                ],
                const Divider(height: 32),
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
                ],
                const Divider(height: 32),
                const Text('Categories', style: TextStyle(fontWeight: FontWeight.w600)),
                ..._categories.map(
                  (cat) {
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
                                        onPressed: () => _updateCategory(catId!),
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
                  },
                ),
                TextField(
                  controller: _categoryNameCtrl,
                  decoration: const InputDecoration(labelText: 'New category name'),
                ),
                ForgeButton(label: 'Add category', onPressed: _createCategory),
                const Divider(height: 32),
                const Text(
                  'Manage your creator community rooms',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant, fontSize: 13),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Channel name'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(labelText: 'Channel type'),
                  items: const [
                    DropdownMenuItem(value: 'public', child: Text('Public')),
                    DropdownMenuItem(value: 'subscribers', child: Text('Members only')),
                    DropdownMenuItem(value: 'tier', child: Text('Tier gated')),
                    DropdownMenuItem(value: 'invite', child: Text('Invite only')),
                  ],
                  onChanged: (v) => setState(() => _type = v ?? 'public'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String?>(
                  value: _requiredTierId,
                  decoration: const InputDecoration(labelText: 'Required tier (optional)'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('None')),
                    ..._tiers.map(
                      (t) => DropdownMenuItem(
                        value: t['id'] as String,
                        child: Text(t['name'] as String? ?? ''),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _requiredTierId = v),
                ),
                if (_categories.isNotEmpty)
                  DropdownButtonFormField<String?>(
                    value: _channelCategoryId,
                    decoration: const InputDecoration(labelText: 'Category (optional)'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Uncategorized')),
                      ..._categories.map(
                        (c) => DropdownMenuItem(
                          value: c['id'] as String,
                          child: Text(c['name'] as String? ?? ''),
                        ),
                      ),
                    ],
                    onChanged: (v) => setState(() => _channelCategoryId = v),
                  ),
                const SizedBox(height: 12),
                ForgeButton(label: 'Create channel', onPressed: _createChannel),
                if (_communityId != null) ...[
                  const SizedBox(height: 12),
                  ForgeButton(
                    label: 'Go live in community',
                    onPressed: _goLiveInCommunity,
                  ),
                ],
                const SizedBox(height: 24),
                ..._channels.asMap().entries.map((entry) {
                  final index = entry.key;
                  final ch = entry.value;
                  final channelId = ch['id'] as String?;
                  final channelType = ch['type'] as String? ?? '';
                  final isInvite = channelType == 'invite';
                  final editing = channelId != null && channelId == _editingChannelId;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (editing) ...[
                            TextField(
                              controller: _editChannelNameCtrl,
                              decoration: const InputDecoration(labelText: 'Channel name'),
                            ),
                            DropdownButtonFormField<String>(
                              value: _editChannelType ?? channelType,
                              decoration: const InputDecoration(labelText: 'Type'),
                              items: const [
                                DropdownMenuItem(value: 'public', child: Text('Public')),
                                DropdownMenuItem(value: 'subscribers', child: Text('Members only')),
                                DropdownMenuItem(value: 'tier', child: Text('Tier gated')),
                                DropdownMenuItem(value: 'invite', child: Text('Invite only')),
                              ],
                              onChanged: (v) => setState(() => _editChannelType = v),
                            ),
                            if (_categories.isNotEmpty)
                              DropdownButtonFormField<String?>(
                                value: _editChannelCategoryId,
                                decoration: const InputDecoration(labelText: 'Category'),
                                items: [
                                  const DropdownMenuItem(value: null, child: Text('Uncategorized')),
                                  ..._categories.map(
                                    (c) => DropdownMenuItem(
                                      value: c['id'] as String,
                                      child: Text(c['name'] as String? ?? ''),
                                    ),
                                  ),
                                ],
                                onChanged: (v) => setState(() => _editChannelCategoryId = v),
                              ),
                            Row(
                              children: [
                                TextButton(
                                  onPressed: channelId == null ? null : () => _updateChannel(channelId),
                                  child: const Text('Save'),
                                ),
                                TextButton(
                                  onPressed: () => setState(() => _editingChannelId = null),
                                  child: const Text('Cancel'),
                                ),
                              ],
                            ),
                          ] else ...[
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(ch['name'] as String? ?? ''),
                            subtitle: Text('$channelType · #${ch['slug']}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (index > 0)
                                  IconButton(
                                    icon: const Icon(Icons.arrow_upward, size: 18),
                                    onPressed: () => _reorderChannels(index, index - 1),
                                  ),
                                if (index < _channels.length - 1)
                                  IconButton(
                                    icon: const Icon(Icons.arrow_downward, size: 18),
                                    onPressed: () => _reorderChannels(index, index + 1),
                                  ),
                                IconButton(
                                  icon: const Icon(Icons.edit, size: 18),
                                  onPressed: channelId == null
                                      ? null
                                      : () {
                                          setState(() {
                                            _editingChannelId = channelId;
                                            _editChannelNameCtrl.text = ch['name'] as String? ?? '';
                                            _editChannelType = channelType;
                                            _editChannelTierId = ch['requiredTierId'] as String?;
                                            _editChannelCategoryId = ch['categoryId'] as String?;
                                          });
                                        },
                                ),
                              ],
                            ),
                          ),
                          ],
                          if (isInvite && channelId != null) ...[
                            TextButton(
                              onPressed: () => setState(() {
                                _invitingChannelId =
                                    _invitingChannelId == channelId ? null : channelId;
                              }),
                              child: Text(
                                _invitingChannelId == channelId ? 'Cancel invite' : 'Invite member',
                              ),
                            ),
                            if (_invitingChannelId == channelId)
                              DropdownButtonFormField<String>(
                                decoration: const InputDecoration(labelText: 'Subscriber'),
                                items: _subscribers
                                    .map(
                                      (s) => DropdownMenuItem(
                                        value: s['userId'] as String? ?? s['id'] as String?,
                                        child: Text(
                                          s['displayName'] as String? ??
                                              s['username'] as String? ??
                                              'Member',
                                        ),
                                      ),
                                    )
                                    .where((item) => item.value != null)
                                    .toList(),
                                onChanged: (v) {
                                  if (v != null) _inviteUserIdCtrl.text = v;
                                },
                              ),
                            if (_invitingChannelId == channelId)
                              ForgeButton(
                                label: 'Send invite',
                                onPressed: () => _inviteToChannel(channelId),
                              ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
                TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            ),
    );
  }
}
