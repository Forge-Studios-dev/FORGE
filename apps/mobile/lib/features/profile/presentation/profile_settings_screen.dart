import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/theme_mode_provider.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';
import '../../watch/data/watch_repository.dart';
import '../../../core/theme/forge_tokens.dart';

class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  final _displayName = TextEditingController();
  final _bio = TextEditingController();
  final _websiteUrl = TextEditingController();
  final List<_ChannelLinkDraft> _channelLinks = [];
  bool _loading = true;
  bool _saving = false;
  bool _watchHistoryPaused = false;
  bool _privacySaving = false;
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
      _websiteUrl.text = data['websiteUrl'] as String? ?? '';
      final links = data['channelLinks'];
      _channelLinks
        ..clear()
        ..addAll(
          (links is List ? links : const [])
              .whereType<Map>()
              .map(
                (e) => _ChannelLinkDraft(
                  title: TextEditingController(text: e['title'] as String? ?? ''),
                  url: TextEditingController(text: e['url'] as String? ?? ''),
                ),
              ),
        );
      try {
        final privacy = await client.dio.get('/users/me/privacy');
        final privacyData = privacy.data['data'] as Map<String, dynamic>?;
        _watchHistoryPaused = privacyData?['watchHistoryPaused'] as bool? ?? false;
      } catch (_) {
        /* privacy endpoint optional on older builds */
      }
    } catch (_) {
      if (mounted) context.go('/login');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setWatchHistoryPaused(bool next) async {
    setState(() {
      _watchHistoryPaused = next;
      _privacySaving = true;
    });
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.put('/users/me/privacy', data: {'watchHistoryPaused': next});
    } catch (_) {
      if (mounted) {
        setState(() => _watchHistoryPaused = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update privacy setting')),
        );
      }
    } finally {
      if (mounted) setState(() => _privacySaving = false);
    }
  }

  Future<void> _save() async {
    if (_userId == null) return;
    setState(() => _saving = true);
    try {
      final client = ref.read(apiClientProvider);
      final cleanedLinks = _channelLinks
          .map(
            (l) => {
              'title': l.title.text.trim(),
              'url': l.url.text.trim(),
            },
          )
          .where((l) => (l['url'] as String).isNotEmpty)
          .toList();
      await client.dio.put('/users/$_userId', data: {
        'displayName': _displayName.text.trim(),
        'bio': _bio.text.trim().isEmpty ? null : _bio.text.trim(),
        'websiteUrl': _websiteUrl.text.trim().isEmpty ? null : _websiteUrl.text.trim(),
        'channelLinks': cleanedLinks,
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
    _websiteUrl.dispose();
    for (final link in _channelLinks) {
      link.dispose();
    }
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
          const SizedBox(height: 16),
          TextField(
            controller: _websiteUrl,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              labelText: 'Website',
              hintText: 'https://…',
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text('Channel links', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              TextButton.icon(
                onPressed: _channelLinks.length >= 5
                    ? null
                    : () => setState(
                          () => _channelLinks.add(
                            _ChannelLinkDraft(
                              title: TextEditingController(),
                              url: TextEditingController(),
                            ),
                          ),
                        ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add'),
              ),
            ],
          ),
          ...List.generate(_channelLinks.length, (i) {
            final link = _channelLinks[i];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        TextField(
                          controller: link.title,
                          decoration: const InputDecoration(labelText: 'Title'),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: link.url,
                          keyboardType: TextInputType.url,
                          decoration: const InputDecoration(labelText: 'URL'),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove',
                    onPressed: () => setState(() {
                      final removed = _channelLinks.removeAt(i);
                      removed.dispose();
                    }),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 24),
          ForgeButton(
            label: _saving ? 'Saving…' : 'Save changes',
            onPressed: _saving ? null : _save,
          ),
          const SizedBox(height: 24),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Pause watch history'),
            subtitle: const Text("New watches won't be saved to History."),
            value: _watchHistoryPaused,
            onChanged: _privacySaving ? null : _setWatchHistoryPaused,
          ),
          const SizedBox(height: 8),
          const _ThemeModeTile(),
          const SizedBox(height: 16),
          const _MutedChannelsSection(),
          const SizedBox(height: 8),
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
              foregroundColor: ForgeTokens.error,
              side: const BorderSide(color: ForgeTokens.error),
            ),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _ThemeModeTile extends ConsumerWidget {
  const _ThemeModeTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final label = switch (mode) {
      ThemeMode.light => 'Light',
      ThemeMode.dark => 'Dark',
      ThemeMode.system => 'System',
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: const Text('Appearance'),
      subtitle: Text(label),
      trailing: const Icon(Icons.brightness_6_outlined),
      onTap: () async {
        final next = switch (mode) {
          ThemeMode.system => ThemeMode.light,
          ThemeMode.light => ThemeMode.dark,
          ThemeMode.dark => ThemeMode.system,
        };
        await ref.read(themeModeProvider.notifier).setMode(next);
      },
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
      return const Text('No other active sessions', style: TextStyle(color: ForgeTokens.onSurfaceVariant));
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

class _ChannelLinkDraft {
  final TextEditingController title;
  final TextEditingController url;

  _ChannelLinkDraft({required this.title, required this.url});

  void dispose() {
    title.dispose();
    url.dispose();
  }
}

class _MutedChannelsSection extends ConsumerStatefulWidget {
  const _MutedChannelsSection();

  @override
  ConsumerState<_MutedChannelsSection> createState() => _MutedChannelsSectionState();
}

class _MutedChannelsSectionState extends ConsumerState<_MutedChannelsSection> {
  List<Map<String, dynamic>> _channels = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(watchRepositoryProvider).listMutedChannels();
      if (!mounted) return;
      setState(() {
        _channels = list;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _unmute(String id) async {
    try {
      await ref.read(watchRepositoryProvider).unmuteChannel(id);
      if (!mounted) return;
      setState(() => _channels = _channels.where((c) => c['id'] != id).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unmute channel')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Recommended content', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        const Text(
          'Channels hidden with “Don’t recommend channel”. Unmute anytime.',
          style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator()
        else if (_error)
          TextButton(onPressed: _load, child: const Text('Retry muted channels'))
        else if (_channels.isEmpty)
          const Text('No muted channels.', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
        else
          ..._channels.map((ch) {
            final id = ch['id'] as String? ?? '';
            final name = ch['displayName'] as String? ?? 'Channel';
            final username = ch['username'] as String? ?? '';
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(name),
              subtitle: username.isNotEmpty ? Text('@$username') : null,
              trailing: TextButton(
                onPressed: id.isEmpty ? null : () => _unmute(id),
                child: const Text('Unmute'),
              ),
            );
          }),
      ],
    );
  }
}
