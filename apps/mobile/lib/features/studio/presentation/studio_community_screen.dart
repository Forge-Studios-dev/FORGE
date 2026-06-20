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
  String _type = 'public';
  String? _requiredTierId;
  String? _creatorId;
  List<Map<String, dynamic>> _channels = [];
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _communities = [];
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
      setState(() {
        _communities = communities;
        final data = communityRes.data['data'] as Map<String, dynamic>;
        _channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
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

  @override
  void dispose() {
    _nameCtrl.dispose();
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
        _loading = false;
      });
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
                ..._channels.map((ch) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(ch['name'] as String? ?? ''),
                      subtitle: Text('${ch['type']} · #${ch['slug']}'),
                    ),
                  );
                }),
                TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            ),
    );
  }
}
