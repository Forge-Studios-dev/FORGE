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
  List<Map<String, dynamic>> _channels = [];
  List<Map<String, dynamic>> _tiers = [];
  String? _creatorId;
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
      final communityRes = await client.dio.get('/communities/$_creatorId');
      final tiersRes = await client.dio.get('/creators/$_creatorId/tiers');
      setState(() {
        final data = communityRes.data['data'] as Map<String, dynamic>;
        _channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createChannel() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/channels', data: {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Community channels')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
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
