import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class StudioModerationScreen extends ConsumerStatefulWidget {
  const StudioModerationScreen({
    super.key,
    this.embedded = false,
    this.fixedCommunityId,
  });

  final bool embedded;
  final String? fixedCommunityId;

  @override
  ConsumerState<StudioModerationScreen> createState() => _StudioModerationScreenState();
}

class _StudioModerationScreenState extends ConsumerState<StudioModerationScreen> {
  List<Map<String, dynamic>> _communities = [];
  String? _selectedCommunityId;
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _roles = [];
  List<Map<String, dynamic>> _bans = [];
  bool _loading = true;
  int _tabIndex = 0;
  final _banUserIdCtrl = TextEditingController();
  final _banReasonCtrl = TextEditingController();
  final _roleUserIdCtrl = TextEditingController();
  String _roleType = 'moderator';

  @override
  void initState() {
    super.initState();
    _loadModerated();
  }

  @override
  void dispose() {
    _banUserIdCtrl.dispose();
    _banReasonCtrl.dispose();
    _roleUserIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadModerated() async {
    try {
      if (widget.fixedCommunityId != null) {
        setState(() {
          _selectedCommunityId = widget.fixedCommunityId;
          _loading = false;
        });
        await _loadAll(widget.fixedCommunityId!);
        return;
      }
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/moderated-communities');
      final list = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _communities = list;
        _selectedCommunityId = list.isNotEmpty ? list.first['id'] as String? : null;
        _loading = false;
      });
      if (_selectedCommunityId != null) await _loadAll(_selectedCommunityId!);
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadAll(String communityId) async {
    await Future.wait([
      _loadReports(communityId),
      _loadRoles(communityId),
      _loadBans(communityId),
    ]);
  }

  Future<void> _loadReports(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/communities/$communityId/reports');
      setState(() => _reports = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? []);
    } catch (_) {
      setState(() => _reports = []);
    }
  }

  Future<void> _loadRoles(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/communities/$communityId/roles');
      setState(() => _roles = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? []);
    } catch (_) {
      setState(() => _roles = []);
    }
  }

  Future<void> _loadBans(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/communities/$communityId/bans');
      setState(() => _bans = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? []);
    } catch (_) {
      setState(() => _bans = []);
    }
  }

  Future<void> _resolve(String communityId, String reportId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/communities/$communityId/reports/$reportId/resolve');
      await _loadReports(communityId);
    } catch (_) {}
  }

  Future<void> _assignRole(String communityId) async {
    if (_roleUserIdCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$communityId/roles', data: {
        'userId': _roleUserIdCtrl.text.trim(),
        'role': _roleType,
      });
      _roleUserIdCtrl.clear();
      await _loadRoles(communityId);
    } catch (_) {}
  }

  Future<void> _banMember(String communityId) async {
    if (_banUserIdCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$communityId/bans', data: {
        'userId': _banUserIdCtrl.text.trim(),
        'reason': _banReasonCtrl.text.trim().isEmpty ? null : _banReasonCtrl.text.trim(),
      });
      _banUserIdCtrl.clear();
      _banReasonCtrl.clear();
      await _loadBans(communityId);
    } catch (_) {}
  }

  Future<void> _unban(String communityId, String userId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$communityId/bans/$userId/remove');
      await _loadBans(communityId);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      final loading = const Center(child: CircularProgressIndicator());
      if (widget.embedded) return loading;
      return Scaffold(body: loading);
    }
    if (_communities.isEmpty && widget.fixedCommunityId == null) {
      final empty = const Center(child: Text('No moderated communities assigned'));
      if (widget.embedded) return empty;
      return Scaffold(appBar: AppBar(title: const Text('Moderation')), body: empty);
    }

    final body = Column(
        children: [
          if (!widget.embedded && _communities.length > 1)
            Padding(
              padding: const EdgeInsets.all(12),
              child: DropdownButtonFormField<String>(
                value: _selectedCommunityId,
                decoration: const InputDecoration(labelText: 'Community', isDense: true),
                items: _communities
                    .map(
                      (c) => DropdownMenuItem(
                        value: c['id'] as String,
                        child: Text(c['name'] as String? ?? ''),
                      ),
                    )
                    .toList(),
                onChanged: (id) {
                  if (id == null) return;
                  setState(() => _selectedCommunityId = id);
                  _loadAll(id);
                },
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Reports'),
                  selected: _tabIndex == 0,
                  onSelected: (_) => setState(() => _tabIndex = 0),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Roles'),
                  selected: _tabIndex == 1,
                  onSelected: (_) => setState(() => _tabIndex = 1),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Bans'),
                  selected: _tabIndex == 2,
                  onSelected: (_) => setState(() => _tabIndex = 2),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: [
                _buildReportsTab(),
                _buildRolesTab(),
                _buildBansTab(),
              ],
            ),
          ),
        ],
      );

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Moderation')),
      body: body,
    );
  }

  Widget _buildReportsTab() {
    if (_reports.isEmpty) return const Center(child: Text('No open reports'));
    return ListView.builder(
      itemCount: _reports.length,
      itemBuilder: (_, i) {
        final r = _reports[i];
        return ListTile(
          title: Text(r['reason'] as String? ?? 'Report'),
          subtitle: Text('${r['targetType'] ?? 'message'} · ${r['status']}'),
          trailing: TextButton(
            onPressed: _selectedCommunityId == null
                ? null
                : () => _resolve(_selectedCommunityId!, r['id'] as String),
            child: const Text('Resolve'),
          ),
        );
      },
    );
  }

  Widget _buildRolesTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        TextField(
          controller: _roleUserIdCtrl,
          decoration: const InputDecoration(labelText: 'User ID to assign role'),
        ),
        DropdownButtonFormField<String>(
          value: _roleType,
          decoration: const InputDecoration(labelText: 'Role'),
          items: const [
            DropdownMenuItem(value: 'moderator', child: Text('Moderator')),
            DropdownMenuItem(value: 'admin', child: Text('Admin')),
            DropdownMenuItem(value: 'coach', child: Text('Coach')),
          ],
          onChanged: (v) => setState(() => _roleType = v ?? 'moderator'),
        ),
        ElevatedButton(
          onPressed: _selectedCommunityId == null
              ? null
              : () => _assignRole(_selectedCommunityId!),
          child: const Text('Assign role'),
        ),
        const Divider(height: 24),
        ..._roles.map(
          (r) => ListTile(
            title: Text(r['role'] as String? ?? ''),
            subtitle: Text(r['userId'] as String? ?? ''),
          ),
        ),
      ],
    );
  }

  Widget _buildBansTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        TextField(
          controller: _banUserIdCtrl,
          decoration: const InputDecoration(labelText: 'User ID to ban'),
        ),
        TextField(
          controller: _banReasonCtrl,
          decoration: const InputDecoration(labelText: 'Reason (optional)'),
        ),
        ElevatedButton(
          onPressed: _selectedCommunityId == null ? null : () => _banMember(_selectedCommunityId!),
          child: const Text('Ban member'),
        ),
        const Divider(height: 24),
        ..._bans.map(
          (b) => ListTile(
            title: Text(b['userId'] as String? ?? ''),
            subtitle: Text(b['reason'] as String? ?? ''),
            trailing: TextButton(
              onPressed: _selectedCommunityId == null
                  ? null
                  : () => _unban(_selectedCommunityId!, b['userId'] as String),
              child: const Text('Unban'),
            ),
          ),
        ),
      ],
    );
  }
}
