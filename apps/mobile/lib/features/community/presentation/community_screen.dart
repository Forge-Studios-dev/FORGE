import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../profile/presentation/membership_panel.dart';
import '../../auth/data/auth_repository.dart';
import 'community_welcome_dialog.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  final String creatorId;
  final String? communitySlug;
  const CommunityScreen({super.key, required this.creatorId, this.communitySlug});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  int _tabIndex = 0;
  String? _replyToCommentId;
  String? _expandedPostId;
  final _commentCtrl = TextEditingController();
  List<Map<String, dynamic>> _posts = [];
  Map<String, dynamic>? _activePoll;
  List<Map<String, dynamic>> _liveStreams = [];
  List<Map<String, dynamic>> _postComments = [];
  List<Map<String, dynamic>> _events = [];
  List<Map<String, dynamic>> _voiceRooms = [];
  List<Map<String, dynamic>> _textRooms = [];
  String? _myUserId;
  bool _loading = true;
  bool _communityRestricted = false;
  bool _canRequestJoin = false;
  bool _joinPending = false;
  String? _communityRestrictedId;
  String? _communityId;

  static const _welcomeStorage = FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadCommunity();
  }

  Future<void> _loadCommunity() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _myUserId = user?['id'] as String?;
      final client = ref.read(apiClientProvider);
      final path = widget.communitySlug != null
          ? '/creators/${widget.creatorId}/communities/${widget.communitySlug}'
          : '/creators/${widget.creatorId}/communities';
      final response = widget.communitySlug != null
          ? await client.dio.get(path)
          : await _loadFirstCommunity(client);
      if (response == null) {
        setState(() => _loading = false);
        return;
      }
      final data = response.data['data'] as Map<String, dynamic>;
      final community = data['community'] as Map<String, dynamic>?;
      _communityId = community?['id'] as String?;
      setState(() {
        _loading = false;
      });
      if (_communityId != null) {
        await Future.wait([
          _loadPosts(),
          _loadPoll(),
          _loadLiveStreams(),
          _loadRoomsContent(),
        ]);
        await _maybeShowWelcome(community);
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 403 && widget.communitySlug != null) {
        await _loadAccessMeta();
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  /// Member welcome onboarding (mobile parity with web `CommunityWelcomeModal`).
  /// Shown once per community to non-creator members who have access. The "seen"
  /// flag is persisted so the nudge never repeats across sessions.
  Future<void> _maybeShowWelcome(Map<String, dynamic>? community) async {
    final id = community?['id'] as String?;
    final name = community?['name'] as String?;
    if (id == null || name == null || name.isEmpty) return;
    if (_myUserId != null && _myUserId == widget.creatorId) return;
    final key = 'forge_community_welcome_$id';
    try {
      if (await _welcomeStorage.read(key: key) != null) return;
      await _welcomeStorage.write(key: key, value: '1');
    } catch (_) {
      return;
    }
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showCommunityWelcomeDialog(context, name);
    });
  }

  Future<void> _loadAccessMeta() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get(
        '/creators/${widget.creatorId}/communities/${widget.communitySlug}/access',
      );
      final meta = res.data['data'] as Map<String, dynamic>;
      setState(() {
        _communityRestrictedId = meta['communityId'] as String?;
        _canRequestJoin = meta['canRequestJoin'] == true;
        _joinPending = meta['joinRequestStatus'] == 'pending';
        _communityRestricted = true;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _requestJoin() async {
    final id = _communityRestrictedId ?? _communityId;
    if (id == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$id/join-request');
      setState(() {
        _joinPending = true;
        _canRequestJoin = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Join request submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit join request')),
        );
      }
    }
  }

  Future<dynamic> _loadFirstCommunity(dynamic client) async {
    final listRes = await client.dio.get('/creators/${widget.creatorId}/communities');
    final list = (listRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    if (list.isEmpty) return null;
    final slug = list.first['slug'] as String?;
    if (slug == null) return null;
    return client.dio.get('/creators/${widget.creatorId}/communities/$slug');
  }

  Future<void> _loadPosts() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/posts');
      final data = response.data['data']['data'] as List;
      setState(() => _posts = data.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _loadPoll() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/polls/active');
      setState(() => _activePoll = response.data['data'] as Map<String, dynamic>?);
    } catch (_) {}
  }

  Future<void> _loadLiveStreams() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/live');
      final data = response.data['data'] as List? ?? [];
      setState(() => _liveStreams = data.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _loadPostComments(String postId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/posts/$postId/comments');
      final data = response.data['data']['data'] as List? ?? [];
      setState(() => _postComments = data.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _postComments = []);
    }
  }

  Future<void> _loadRoomsContent() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final results = await Future.wait([
        client.dio.get('/communities/$_communityId/rooms'),
        client.dio.get('/communities/$_communityId/events'),
      ]);
      setState(() {
        final rooms = (results[0].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _voiceRooms = rooms.where((r) => r['roomType'] != 'text').toList();
        _textRooms = rooms.where((r) => r['roomType'] == 'text').toList();
        final eventsPayload = results[1].data['data'];
        if (eventsPayload is List) {
          _events = eventsPayload.cast<Map<String, dynamic>>();
        } else if (eventsPayload is Map && eventsPayload['data'] is List) {
          _events = (eventsPayload['data'] as List).cast<Map<String, dynamic>>();
        } else {
          _events = [];
        }
      });
    } catch (_) {}
  }

  Future<void> _rsvpEvent(String eventId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/communities/$_communityId/events/$eventId/rsvp',
        data: {'status': 'going'},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('RSVP recorded')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not RSVP')),
        );
      }
    }
  }

  Future<void> _reportPoll() async {
    if (_communityId == null || _activePoll == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/reports', data: {
        'targetType': 'poll',
        'pollId': _activePoll!['id'],
        'reason': 'Inappropriate poll',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit report')),
        );
      }
    }
  }

  Future<void> _reportPost(String postId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/reports', data: {
        'targetType': 'post',
        'postId': postId,
        'reason': 'Inappropriate post',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit report')),
        );
      }
    }
  }

  Future<void> _votePoll(int optionIndex) async {
    if (_communityId == null || _activePoll == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/communities/$_communityId/polls/${_activePoll!['id']}/vote',
        data: {'optionIndex': optionIndex},
      );
      await _loadPoll();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit vote')),
        );
      }
    }
  }

  Future<void> _toggleLike(String postId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/posts/$postId/reactions');
      await _loadPosts();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not like post')),
        );
      }
    }
  }

  Future<void> _addComment(String postId) async {
    if (_communityId == null || _commentCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final payload = <String, dynamic>{'body': _commentCtrl.text.trim()};
      if (_replyToCommentId != null) payload['parentId'] = _replyToCommentId;
      await client.dio.post(
        '/communities/$_communityId/posts/$postId/comments',
        data: payload,
      );
      _commentCtrl.clear();
      setState(() {
        _expandedPostId = postId;
        _replyToCommentId = null;
      });
      await _loadPosts();
      await _loadPostComments(postId);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not post comment')),
        );
      }
    }
  }

  Widget _buildRoomsTab() {
    if (_textRooms.isEmpty && _voiceRooms.isEmpty && _events.isEmpty) {
      return const Center(child: Text('No rooms or events yet'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_events.isNotEmpty) ...[
          const Text('Events', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._events.map(
            (event) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(event['title'] as String? ?? 'Event'),
                subtitle: Text(
                  (event['occurrenceStartsAt'] as String?) ??
                      (event['startsAt'] as String?) ??
                      '',
                ),
                trailing: TextButton(
                  onPressed: () => _rsvpEvent(
                    (event['seriesEventId'] as String?) ?? (event['id'] as String),
                  ),
                  child: const Text('RSVP'),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (_textRooms.isNotEmpty) ...[
          const Text('Text rooms', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._textRooms.map(
            (r) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(r['name'] as String? ?? 'Room'),
                subtitle: Text(r['description'] as String? ?? 'Open to chat'),
                trailing: TextButton(
                  onPressed: () => _openTextRoom(r['id'] as String),
                  child: const Text('Open chat'),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (_voiceRooms.isNotEmpty) ...[
          const Text('Voice & stage rooms', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._voiceRooms.map(
            (r) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(r['name'] as String? ?? 'Room'),
                subtitle: Text(r['roomType'] as String? ?? 'voice'),
                trailing: TextButton(
                  onPressed: () => _openVoiceRoom(r['id'] as String),
                  child: const Text('Join room'),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPostsTab() {
    if (_posts.isEmpty) {
      return const Center(child: Text('No posts yet'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _posts.length,
      itemBuilder: (_, i) {
        final p = _posts[i];
        final likes = p['likeCount'] as int? ?? 0;
        final comments = p['commentCount'] as int? ?? 0;
        final likedByMe = p['likedByMe'] == true;
        final postId = p['id'] as String;
        final expanded = _expandedPostId == postId;
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p['title'] as String? ?? p['postType'] as String? ?? 'Post',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 4),
                Text(p['body'] as String? ?? ''),
                if ((p['mediaUrls'] as List?)?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  ...(p['mediaUrls'] as List).map((url) {
                    final s = url as String;
                    final isVideo = s.contains('youtube.com') ||
                        s.contains('youtu.be') ||
                        s.contains('vimeo.com');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: isVideo
                          ? InkWell(
                              onTap: () => launchUrl(Uri.parse(s), mode: LaunchMode.externalApplication),
                              child: Text('▶ Watch video', style: TextStyle(color: ForgeTokens.of(context).primary)),
                            )
                          : ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                s,
                                height: 120,
                                width: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                              ),
                            ),
                    );
                  }),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    InkWell(
                      onTap: () => _toggleLike(postId),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            likedByMe ? Icons.thumb_up : Icons.thumb_up_outlined,
                            size: 16,
                            color: likedByMe ? ForgeTokens.of(context).primary : ForgeTokens.of(context).onSurfaceVariant,
                          ),
                          const SizedBox(width: 4),
                          Text('$likes'),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    InkWell(
                      onTap: () {
                        setState(() => _expandedPostId = expanded ? null : postId);
                        if (!expanded) _loadPostComments(postId);
                      },
                      child: Text('💬 $comments'),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => _reportPost(postId),
                      child: const Text('Report', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                if (expanded) ...[
                  const SizedBox(height: 8),
                  ..._postComments.map(
                    (c) {
                      final isReply = c['parentId'] != null;
                      final commentId = c['id'] as String?;
                      return Padding(
                        padding: EdgeInsets.only(left: isReply ? 16 : 0, bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                '${(c['author'] as Map?)?['displayName'] ?? 'Member'}${isReply ? ' · reply' : ''}: ${c['body']}',
                                style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
                              ),
                            ),
                            if (commentId != null)
                              TextButton(
                                onPressed: () => setState(() => _replyToCommentId = commentId),
                                child: const Text('Reply', style: TextStyle(fontSize: 12)),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                  if (_replyToCommentId != null)
                    Row(
                      children: [
                        const Expanded(child: Text('Replying to comment', style: TextStyle(fontSize: 12))),
                        TextButton(
                          onPressed: () => setState(() => _replyToCommentId = null),
                          child: const Text('Cancel'),
                        ),
                      ],
                    ),
                  TextField(
                    controller: _commentCtrl,
                    decoration: InputDecoration(
                      hintText: _replyToCommentId != null ? 'Write a reply…' : 'Add a comment…',
                      isDense: true,
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => _addComment(postId),
                      child: const Text('Comment'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPollsTab() {
    if (_activePoll == null) {
      return const Center(child: Text('No active poll'));
    }
    final options = (_activePoll!['options'] as List?)?.cast<String>() ?? [];
    final counts = (_activePoll!['counts'] as List?)?.cast<num>() ?? [];
    final totalVotes = (_activePoll!['totalVotes'] as num?)?.toInt() ?? 0;
    final myVote = _activePoll!['myOptionIndex'] as int?;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(_activePoll!['question'] as String? ?? '', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...options.asMap().entries.map(
              (e) {
                final count = e.key < counts.length ? counts[e.key].toInt() : 0;
                final pct = totalVotes > 0 ? ((count / totalVotes) * 100).round() : 0;
                final isMine = myVote == e.key;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton(
                    onPressed: () => _votePoll(e.key),
                    style: isMine ? OutlinedButton.styleFrom(side: const BorderSide(width: 2)) : null,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('${e.value} · $pct%${isMine ? ' ✓' : ''}'),
                    ),
                  ),
                );
              },
            ),
        TextButton(onPressed: _reportPoll, child: const Text('Report poll')),
      ],
    );
  }

  Future<void> _openTextRoom(String roomId) async {
    if (_communityId == null) return;
    context.push('/community/$_communityId/text/$roomId');
  }

  Future<void> _openVoiceRoom(String roomId) async {
    if (_communityId == null) return;
    context.push('/community/$_communityId/voice/$roomId');
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_communityRestricted && _communityId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Community')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline, size: 48, color: ForgeTokens.of(context).onSurfaceVariant),
                const SizedBox(height: 12),
                const Text(
                  'This community is restricted',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                const Text(
                  'You need membership, an invite, or creator approval.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                if (_joinPending)
                  const Text('Your join request is pending approval.'),
                if (_canRequestJoin)
                  FilledButton(
                    onPressed: _requestJoin,
                    child: const Text('Request to join'),
                  ),
                if (!_joinPending && !_canRequestJoin)
                  MembershipPanel(
                    creatorId: widget.creatorId,
                    communityId: _communityRestrictedId,
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Community')),
      body: Column(
        children: [
          if (_liveStreams.isNotEmpty)
            MaterialBanner(
              content: Text('Live now: ${_liveStreams.first['title'] ?? 'Stream'}'),
              actions: [
                TextButton(
                  onPressed: () {
                    final id = _liveStreams.first['id'] as String?;
                    if (id != null) context.push('/live/$id');
                  },
                  child: const Text('Watch'),
                ),
              ],
            ),
          // In-body tabs — avoids stacking a second NavigationBar under MainScaffold.
          Material(
            color: Theme.of(context).colorScheme.surfaceContainerLow,
            child: Row(
              children: [
                for (final entry in const [
                  (0, Icons.article_outlined, 'Posts'),
                  (1, Icons.poll_outlined, 'Polls'),
                  (2, Icons.meeting_room_outlined, 'Rooms'),
                ])
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () => setState(() => _tabIndex = entry.$1),
                      icon: Icon(entry.$2),
                      label: Text(entry.$3),
                      style: TextButton.styleFrom(
                        foregroundColor: _tabIndex == entry.$1
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: [
                _buildPostsTab(),
                _buildPollsTab(),
                _buildRoomsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
