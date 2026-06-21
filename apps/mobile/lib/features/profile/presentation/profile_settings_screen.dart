import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';
class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  final _displayName = TextEditingController();
  final _bio = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _userId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/users/me');
      final data = res.data['data'] as Map<String, dynamic>;
      _userId = data['id'] as String?;
      _displayName.text = data['displayName'] as String? ?? '';
      _bio.text = data['bio'] as String? ?? '';
    } catch (_) {
      if (mounted) context.go('/login');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_userId == null) return;
    setState(() => _saving = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.put('/users/$_userId', data: {
        'displayName': _displayName.text.trim(),
        'bio': _bio.text.trim().isEmpty ? null : _bio.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings saved')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save settings')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _displayName.dispose();
    _bio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _displayName,
            decoration: const InputDecoration(labelText: 'Display name'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _bio,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Bio'),
          ),
          const SizedBox(height: 24),
          ForgeButton(
            label: _saving ? 'Saving…' : 'Save changes',
            onPressed: _saving ? null : _save,
          ),
          const SizedBox(height: 24),
          ListTile(
            title: const Text('My memberships'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/memberships'),
          ),
          const SizedBox(height: 24),
          const Text('Active sessions', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _ActiveSessionsSection(),
          const SizedBox(height: 32),
          OutlinedButton(
            onPressed: () async {
              await ref.read(authRepositoryProvider).logout();
              if (context.mounted) context.go('/login');
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent),
            ),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _ActiveSessionsSection extends ConsumerStatefulWidget {
  const _ActiveSessionsSection();

  @override
  ConsumerState<_ActiveSessionsSection> createState() => _ActiveSessionsSectionState();
}

class _ActiveSessionsSectionState extends ConsumerState<_ActiveSessionsSection> {
  List<Map<String, dynamic>> _sessions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/auth/sessions');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _sessions = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _revoke(String sessionId) async {
    final client = ref.read(apiClientProvider);
    await client.dio.delete('/auth/sessions/$sessionId');
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LinearProgressIndicator();
    if (_sessions.isEmpty) {
      return const Text('No other active sessions', style: TextStyle(color: Colors.grey));
    }
    return Column(
      children: _sessions.map((s) {
        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(s['deviceLabel'] as String? ?? 'Device'),
          subtitle: Text(s['userAgent'] as String? ?? ''),
          trailing: TextButton(
            onPressed: () => _revoke(s['id'] as String),
            child: const Text('Revoke'),
          ),
        );
      }).toList(),
    );
  }
}
