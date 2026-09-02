import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
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
      final creatorId = user?['id'] as String?;
      if (creatorId == null) {
        setState(() => _loading = false);
        return;
      }
      final client = ref.read(apiClientProvider);
      final communitiesRes =
          await client.dio.get('/creators/$creatorId/communities');
      final communities =
          (communitiesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ??
              [];
      final communityId = _communityId ??
          (communities.isNotEmpty ? communities.first['id'] as String? : null);
      List<Map<String, dynamic>> matches = [];
      if (communityId != null) {
        final matchesRes = await client.dio
            .get('/communities/$communityId/mentorship/matches');
        matches =
            (matchesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ??
                [];
      }
      setState(() {
        _communities = communities;
        _communityId = communityId;
        _matches = matches;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
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
          const SnackBar(content: Text('Could not run matching')),
        );
      }
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                if (_communities.isEmpty)
                  const Text(
                    'Create a community to run mentorship matching.',
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
                    ..._matches.map(
                      (m) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          child: Text(
                            '${m['status'] ?? 'match'} · score ${m['matchScore'] ?? m['match_score'] ?? '—'}',
                            style: const TextStyle(color: ForgeTokens.onSurface),
                          ),
                        ),
                      ),
                    ),
                ],
              ],
            ),
    );
  }
}
