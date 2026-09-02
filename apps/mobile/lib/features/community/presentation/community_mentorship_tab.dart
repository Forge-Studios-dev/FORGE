import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';
import '../data/community_repository.dart';

/// Member mentorship: join as mentor/mentee, browse mentors, respond to matches.
class CommunityMentorshipTab extends ConsumerStatefulWidget {
  const CommunityMentorshipTab({super.key, required this.communityId});

  final String communityId;

  @override
  ConsumerState<CommunityMentorshipTab> createState() =>
      _CommunityMentorshipTabState();
}

class _CommunityMentorshipTabState extends ConsumerState<CommunityMentorshipTab> {
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _mentors = [];
  List<Map<String, dynamic>> _asMentor = [];
  List<Map<String, dynamic>> _asMentee = [];
  bool _loading = true;
  bool _signedIn = false;
  bool _busy = false;
  String _role = 'mentee';
  final _skillsCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _skillsCtrl.dispose();
    _bioCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await ref.read(authRepositoryProvider).getStoredUser();
      _signedIn = user != null;
      final repo = ref.read(communityRepositoryProvider);
      final mentors = await repo.listMentors(widget.communityId);
      Map<String, dynamic>? profile;
      List<Map<String, dynamic>> asMentor = [];
      List<Map<String, dynamic>> asMentee = [];
      if (_signedIn) {
        try {
          profile = await repo.getMentorshipProfile(widget.communityId);
        } catch (_) {
          profile = null;
        }
        try {
          final matches = await repo.listMyMentorshipMatches(widget.communityId);
          asMentor = matches.asMentor;
          asMentee = matches.asMentee;
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _mentors = mentors;
        _profile = profile;
        _asMentor = asMentor;
        _asMentee = asMentee;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load mentorship';
      });
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _busy = true);
    try {
      final skills = _skillsCtrl.text
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      await ref.read(communityRepositoryProvider).upsertMentorshipProfile(
            widget.communityId,
            role: _role,
            skills: skills,
            bio: _bioCtrl.text.trim(),
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save profile')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _respond(String matchId, bool accept) async {
    setState(() => _busy = true);
    try {
      await ref.read(communityRepositoryProvider).respondToMentorshipMatch(
            widget.communityId,
            matchId,
            accept: accept,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update match')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!, textAlign: TextAlign.center));
    }
    if (!_signedIn) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Sign in to join mentorship in this community.',
              textAlign: TextAlign.center,
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            ForgeButton(
              label: 'Sign in',
              onPressed: () => context.push('/login'),
            ),
          ],
        ),
      );
    }

    final matches = [..._asMentor, ..._asMentee];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Your profile', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (_profile != null) ...[
          Text(
            'Role: ${_profile!['role'] ?? '—'}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          if ((_profile!['skills'] as List?)?.isNotEmpty == true)
            Text(
              'Skills: ${(_profile!['skills'] as List).join(', ')}',
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
        ] else ...[
          Row(
            children: [
              ChoiceChip(
                label: const Text('Mentee'),
                selected: _role == 'mentee',
                onSelected: (_) => setState(() => _role = 'mentee'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Mentor'),
                selected: _role == 'mentor',
                onSelected: (_) => setState(() => _role = 'mentor'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _skillsCtrl,
            decoration: const InputDecoration(
              labelText: 'Skills (comma-separated)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _bioCtrl,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Bio / goals',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          ForgeButton(
            label: _busy ? 'Saving…' : 'Join mentorship',
            onPressed: _busy ? null : _saveProfile,
          ),
        ],
        const SizedBox(height: 24),
        Text('Active mentors', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (_mentors.isEmpty)
          Text(
            'No mentors listed yet.',
            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
          )
        else
          ..._mentors.map((m) {
            final user = m['user'] as Map<String, dynamic>?;
            final name =
                user?['displayName'] as String? ?? user?['username'] as String? ?? 'Mentor';
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(name),
                subtitle: Text(
                  [
                    if ((m['skills'] as List?)?.isNotEmpty == true)
                      (m['skills'] as List).join(', '),
                    '${m['currentMentees'] ?? 0}/${m['maxMentees'] ?? '—'} mentees',
                  ].where((s) => s.toString().isNotEmpty).join(' · '),
                ),
              ),
            );
          }),
        const SizedBox(height: 24),
        Text('Your matches', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (matches.isEmpty)
          Text(
            'No matches yet.',
            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
          )
        else
          ...matches.map((match) {
            final id = match['id'] as String;
            final asMentor = _asMentor.any((m) => m['id'] == id);
            final pending = match['status'] == 'pending';
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text('${match['status'] ?? 'match'}'),
                subtitle: Text(asMentor ? 'As mentor' : 'As mentee'),
                trailing: asMentor && pending
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextButton(
                            onPressed: _busy ? null : () => _respond(id, true),
                            child: const Text('Accept'),
                          ),
                          TextButton(
                            onPressed: _busy ? null : () => _respond(id, false),
                            child: const Text('Decline'),
                          ),
                        ],
                      )
                    : null,
              ),
            );
          }),
      ],
    );
  }
}
