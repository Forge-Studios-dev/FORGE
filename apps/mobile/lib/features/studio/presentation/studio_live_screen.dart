import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

import '../../auth/data/auth_repository.dart';

class StudioLiveScreen extends ConsumerStatefulWidget {
  const StudioLiveScreen({super.key});

  @override
  ConsumerState<StudioLiveScreen> createState() => _StudioLiveScreenState();
}

class _StudioLiveScreenState extends ConsumerState<StudioLiveScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _visibility = 'public';
  String? _communityId;
  String? _creatorId;
  List<Map<String, dynamic>> _communities = [];
  bool _chatEnabled = true;
  bool _recordEnabled = true;
  bool _ageRestricted = false;
  bool _loading = false;
  bool _loadingCommunities = true;

  @override
  void initState() {
    super.initState();
    _loadCommunities();
  }

  Future<void> _loadCommunities() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _creatorId = user?['id'] as String?;
      if (_creatorId == null) {
        setState(() => _loadingCommunities = false);
        return;
      }
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/$_creatorId/communities');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _communities = list;
        if (list.length == 1) _communityId = list.first['id'] as String?;
        _loadingCommunities = false;
      });
    } catch (_) {
      setState(() => _loadingCommunities = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_titleCtrl.text.trim().length < 3) return;
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post('/streams/start', data: {
        'title': _titleCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        'visibility': _communityId != null ? 'subscribers' : _visibility,
        if (_communityId != null) 'communityId': _communityId,
        'chatEnabled': _chatEnabled,
        'recordEnabled': _recordEnabled,
        'ageRestricted': _ageRestricted,
      });
      final streamId = response.data['data']?['id'] as String?;
      if (mounted && streamId != null) {
        context.go('/live/$streamId');
      } else if (mounted) {
        context.go('/live');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not start stream')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Go live'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Teach in real time. Link to a community for member-only live sessions.',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant, height: 1.5),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Session title',
              hintText: 'e.g. Live wheel throwing basics',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descCtrl,
            decoration: const InputDecoration(labelText: 'Description (optional)'),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          if (_loadingCommunities)
            const LinearProgressIndicator()
          else if (_communities.isNotEmpty)
            DropdownButtonFormField<String?>(
              value: _communityId,
              decoration: const InputDecoration(
                labelText: 'Link to community (optional)',
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('No community link')),
                ..._communities.map(
                  (c) => DropdownMenuItem(
                    value: c['id'] as String,
                    child: Text(c['name'] as String? ?? 'Community'),
                  ),
                ),
              ],
              onChanged: (v) => setState(() => _communityId = v),
            ),
          if (_communityId == null) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _visibility,
              decoration: const InputDecoration(labelText: 'Visibility'),
              items: const [
                DropdownMenuItem(value: 'public', child: Text('Public')),
                DropdownMenuItem(value: 'followers', child: Text('Followers')),
                DropdownMenuItem(value: 'subscribers', child: Text('Members')),
                DropdownMenuItem(value: 'private', child: Text('Private')),
              ],
              onChanged: (v) => setState(() => _visibility = v ?? 'public'),
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Community live uses members-only visibility.',
                style: TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant.withValues(alpha: 0.9)),
              ),
            ),
          SwitchListTile(
            title: const Text('Chat enabled'),
            value: _chatEnabled,
            onChanged: (v) => setState(() => _chatEnabled = v),
          ),
          SwitchListTile(
            title: const Text('Record VOD'),
            value: _recordEnabled,
            onChanged: (v) => setState(() => _recordEnabled = v),
          ),
          SwitchListTile(
            title: const Text('Age restricted'),
            value: _ageRestricted,
            onChanged: (v) => setState(() => _ageRestricted = v),
          ),
          const SizedBox(height: 16),
          ForgeButton(
            label: _loading ? 'Starting…' : 'Go live',
            onPressed: _loading ? null : _start,
          ),
          const SizedBox(height: 24),
          ForgeCard(
            onTap: () => context.go('/live'),
            child: const Row(
              children: [
                Icon(Icons.live_tv, color: ForgeTokens.primary),
                SizedBox(width: 12),
                Expanded(child: Text('Browse live sessions')),
                Icon(Icons.chevron_right, color: ForgeTokens.outline),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
