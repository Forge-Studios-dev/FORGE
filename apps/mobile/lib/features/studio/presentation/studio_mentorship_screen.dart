import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../auth/data/auth_repository.dart';

class StudioMentorshipScreen extends ConsumerStatefulWidget {
  const StudioMentorshipScreen({super.key});

  @override
  ConsumerState<StudioMentorshipScreen> createState() =>
      _StudioMentorshipScreenState();
}

class _StudioMentorshipScreenState
    extends ConsumerState<StudioMentorshipScreen> {
  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _matches = [];
  String? _communityId;
  bool _loading = true;
  bool _running = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      final creatorId = user?['id'] as String?;
      if (creatorId == null) {
        setState(() => _loading = false);
        return;
      }
      final client = ref.read(apiClientProvider);
      final communitiesRes =
          await client.dio.get('/creators/$creatorId/communities');
      final communities = readApiList(communitiesRes.data);
      final communityId = _communityId ??
          (communities.isNotEmpty ? communities.first['id'] as String? : null);
      List<Map<String, dynamic>> matches = [];
      if (communityId != null) {
        final matchesRes = await client.dio
            .get('/communities/$communityId/mentorship/matches');
        matches = readApiList(matchesRes.data);
      }
      setState(() {
        _communities = communities;
        _communityId = communityId;
        _matches = matches;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Could not load mentorship data';
      });
    }
  }

  Future<void> _runMatching() async {
    if (_communityId == null) return;
    setState(() => _running = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio
          .post('/communities/$_communityId/mentorship/run-matching');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Matching complete')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Matching failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).asData?.value ?? {};
    if (!platformMentorshipEnabled(platformConfig)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Mentorship')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Mentorship is disabled on this deployment.',
              style: TextStyle(color: ForgeTokens.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: ForgeTokens.background,
      appBar: AppBar(
        title: const Text('Mentorship'),
        backgroundColor: ForgeTokens.surfaceContainer,
        foregroundColor: ForgeTokens.onSurface,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!, style: const TextStyle(color: ForgeTokens.error)),
                  ),
                if (_communities.isEmpty)
                  const Text(
                    'No community yet — mentorship matching needs a community.',
                    style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                  )
                else ...[
                  DropdownButtonFormField<String>(
                    value: _communityId,
                    decoration: const InputDecoration(labelText: 'Community'),
                    items: _communities
                        .map(
                          (c) => DropdownMenuItem(
                            value: c['id'] as String,
                            child: Text(c['name'] as String? ?? 'Community'),
                          ),
                        )
                        .toList(),
                    onChanged: (id) {
                      setState(() => _communityId = id);
                      _load();
                    },
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(
                    label: _running ? 'Running…' : 'Run matching',
                    onPressed: _running ? null : _runMatching,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Matches (${_matches.length})',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: ForgeTokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_matches.isEmpty)
                    const Text(
                      'No matches yet.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    )
                  else
                    ..._matches.map((m) {
                      final mentor = m['mentor'] as Map<String, dynamic>?;
                      final mentee = m['mentee'] as Map<String, dynamic>?;
                      final mentorName = mentor?['displayName'] as String? ??
                          mentor?['username'] as String? ??
                          'Mentor';
                      final menteeName = mentee?['displayName'] as String? ??
                          mentee?['username'] as String? ??
                          'Mentee';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          child: Text(
                            '$mentorName → $menteeName',
                            style: const TextStyle(color: ForgeTokens.onSurface),
                          ),
                        ),
                      );
                    }),
                ],
              ],
            ),
    );
  }
}
