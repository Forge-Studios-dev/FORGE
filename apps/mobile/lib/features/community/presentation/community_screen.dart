import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/access/access_session_controller.dart';
import '../../profile/presentation/membership_panel.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  final String creatorId;
  final String? communitySlug;
  const CommunityScreen({super.key, required this.creatorId, this.communitySlug});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  int _tabIndex = 0;
  List<Map<String, dynamic>> _channels = [];
  List<Map<String, dynamic>> _categories = [];
  String? _activeChannelId;
  String? _replyToId;
  String? _expandedPostId;
  final _commentCtrl = TextEditingController();
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _posts = [];
  Map<String, dynamic>? _activePoll;
  List<Map<String, dynamic>> _leaderboard = [];
  Map<String, dynamic>? _gamificationProfile;
  bool _checkingIn = false;
  final _textCtrl = TextEditingController();
  bool _loading = true;
  bool _accessDenied = false;
  String? _accessReason;
  bool _sessionConflict = false;
  String? _communityId;
  void Function(dynamic)? _messageHandler;

  bool _channelAccessible(Map<String, dynamic> ch) {
    final access = ch['access'] as Map<String, dynamic>?;
    return access?['allowed'] != false;
  }

  void _bindChannelSocket(String channelId) {
    _unbindChannelSocket();
    ForgeSocket.joinChannel(channelId);
    _messageHandler = (payload) {
      if (payload is Map<String, dynamic>) {
        _appendMessage(payload);
      }
    };
    ForgeSocket.on('channel:message', _messageHandler!);
  }

  void _unbindChannelSocket() {
    if (_messageHandler != null) {
      ForgeSocket.off('channel:message', _messageHandler);
      _messageHandler = null;
    }
    if (_activeChannelId != null) {
      ForgeSocket.leaveChannel(_activeChannelId!);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadCommunity();
  }

  Future<void> _loadCommunity() async {
    try {
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
      final channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final categories = (data['categories'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final firstAccessible = channels.cast<Map<String, dynamic>?>().firstWhere(
            (ch) => ch != null && _channelAccessible(ch),
            orElse: () => channels.isNotEmpty ? channels.first : null,
          );
      setState(() {
        _channels = channels;
        _categories = categories;
        _activeChannelId = firstAccessible?['id'] as String?;
        _loading = false;
      });
      if (_activeChannelId != null) {
        await _selectChannel(_activeChannelId!);
      }
      if (_communityId != null) {
        await Future.wait([_loadPosts(), _loadPoll(), _loadLeaderboard(), _loadGamificationProfile()]);
      }
    } catch (_) {
      setState(() => _loading = false);
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

  Future<void> _loadLeaderboard() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/leaderboard');
      final data = response.data['data'] as List;
      setState(() => _leaderboard = data.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _loadGamificationProfile() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/gamification/me');
      setState(() => _gamificationProfile = response.data['data'] as Map<String, dynamic>?);
    } catch (_) {}
  }

  Future<void> _checkIn() async {
    if (_communityId == null || _checkingIn) return;
    setState(() => _checkingIn = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/gamification/check-in');
      await Future.wait([_loadGamificationProfile(), _loadLeaderboard()]);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Checked in — streak updated')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Already checked in today')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  Future<void> _selectChannel(String channelId) async {
    final ch = _channels.firstWhere((c) => c['id'] == channelId);
    final accessible = _channelAccessible(ch);
    _unbindChannelSocket();
    setState(() {
      _activeChannelId = channelId;
      _accessDenied = !accessible;
      _accessReason = (ch['access'] as Map<String, dynamic>?)?['reason'] as String?;
      _messages = [];
    });
    if (!accessible) return;
    final channelType = ch['type'] as String? ?? 'public';
    if (channelType != 'public' && _communityId != null) {
      final session = ref.read(accessSessionControllerProvider);
      final ok = await session.start(
        sessionType: 'community',
        resourceId: _communityId!,
      );
      if (!ok) {
        setState(() => _sessionConflict = true);
        return;
      }
      setState(() => _sessionConflict = false);
    }
    await _loadMessages(channelId);
    await ForgeSocket.connect();
    _bindChannelSocket(channelId);
  }

  void _appendMessage(Map<String, dynamic> message) {
    final id = message['id'] as String?;
    if (id == null) return;
    if (_messages.any((m) => m['id'] == id)) return;
    setState(() => _messages = [..._messages, message]);
  }

  Future<void> _loadMessages(String channelId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/channels/$channelId/messages');
      final data = response.data['data']['data'] as List;
      setState(() {
        _messages = data.cast<Map<String, dynamic>>();
        _accessDenied = false;
      });
    } catch (_) {
      setState(() => _accessDenied = true);
    }
  }

  Future<void> _sendMessage() async {
    if (_activeChannelId == null || _textCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final payload = <String, dynamic>{'body': _textCtrl.text.trim()};
      if (_replyToId != null) payload['parentId'] = _replyToId;
      final response = await client.dio.post('/channels/$_activeChannelId/messages', data: payload);
      _textCtrl.clear();
      setState(() => _replyToId = null);
      final message = response.data['data'];
      if (message is Map<String, dynamic>) {
        _appendMessage(message);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send message')),
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

  String _accessLabel() {
    if (_accessReason == 'tier_required') return 'A higher membership tier is required';
    if (_accessReason == 'subscription_required') return 'Membership required to access this channel';
    return 'You do not have access to this channel';
  }

  Future<void> _toggleLike(String postId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/posts/$postId/reactions');
      await _loadPosts();
    } catch (_) {}
  }

  Future<void> _addComment(String postId) async {
    if (_communityId == null || _commentCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/communities/$_communityId/posts/$postId/comments',
        data: {'body': _commentCtrl.text.trim()},
      );
      _commentCtrl.clear();
      setState(() => _expandedPostId = postId);
      await _loadPosts();
    } catch (_) {}
  }

  String _categoryName(String? categoryId) {
    if (categoryId == null) return 'Channels';
    final cat = _categories.cast<Map<String, dynamic>?>().firstWhere(
          (c) => c?['id'] == categoryId,
          orElse: () => null,
        );
    return cat?['name'] as String? ?? 'Channels';
  }

  Widget _buildChatTab() {
    if (_channels.isEmpty) {
      return const Center(child: Text('No community channels yet'));
    }
    return Row(
      children: [
        SizedBox(
          width: 140,
          child: ListView(
            children: _channels.map((ch) {
              final id = ch['id'] as String;
              final selected = id == _activeChannelId;
              final locked = !_channelAccessible(ch);
              final categoryId = ch['categoryId'] as String?;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (categoryId != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 8, top: 8),
                      child: Text(
                        _categoryName(categoryId),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ),
                  ListTile(
                    dense: true,
                    leading: locked ? const Icon(Icons.lock, size: 14) : null,
                    title: Text(
                      ch['name'] as String? ?? '',
                      style: TextStyle(
                        fontSize: 13,
                        color: selected ? Theme.of(context).colorScheme.primary : null,
                      ),
                    ),
                    onTap: () => _selectChannel(id),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
        const VerticalDivider(width: 1),
        Expanded(
          child: _sessionConflict
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Another device is using your membership session'),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () async {
                          if (_activeChannelId == null || _communityId == null) return;
                          final session = ref.read(accessSessionControllerProvider);
                          await session.start(
                            sessionType: 'community',
                            resourceId: _communityId!,
                            force: true,
                          );
                          setState(() => _sessionConflict = false);
                          await _loadMessages(_activeChannelId!);
                        },
                        child: const Text('Use this device'),
                      ),
                    ],
                  ),
                )
              : _accessDenied
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.lock_outline, size: 40, color: Colors.grey),
                            const SizedBox(height: 12),
                            Text(_accessLabel(), textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            MembershipPanel(creatorId: widget.creatorId),
                          ],
                        ),
                      ),
                    )
                  : Column(
                      children: [
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: _messages.length,
                            itemBuilder: (_, i) {
                              final m = _messages[i];
                              final user = m['user'] as Map<String, dynamic>?;
                              final parentId = m['parentId'] as String?;
                              return Padding(
                                padding: EdgeInsets.only(
                                  bottom: 8,
                                  left: parentId != null ? 16 : 0,
                                ),
                                child: GestureDetector(
                                  onLongPress: () => setState(() => _replyToId = m['id'] as String?),
                                  child: Text(
                                    '${user?['displayName'] ?? 'Member'}: ${m['body']}',
                                    style: parentId != null
                                        ? const TextStyle(fontSize: 13, color: Colors.grey)
                                        : null,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(8),
                          child: Column(
                            children: [
                              if (_replyToId != null)
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: TextButton(
                                    onPressed: () => setState(() => _replyToId = null),
                                    child: const Text('Cancel reply'),
                                  ),
                                ),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _textCtrl,
                                      decoration: InputDecoration(
                                        hintText: _replyToId != null ? 'Reply…' : 'Message…',
                                        isDense: true,
                                      ),
                                    ),
                                  ),
                                  IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
        ),
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
                              child: const Text('▶ Watch video', style: TextStyle(color: ForgeTokens.primary)),
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
                      child: Text('♥ $likes'),
                    ),
                    const SizedBox(width: 16),
                    InkWell(
                      onTap: () => setState(() => _expandedPostId = expanded ? null : postId),
                      child: Text('💬 $comments'),
                    ),
                  ],
                ),
                if (expanded) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _commentCtrl,
                    decoration: const InputDecoration(hintText: 'Add a comment…', isDense: true),
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
      ],
    );
  }

  Widget _buildLeaderboardTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_gamificationProfile != null) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Lv ${_gamificationProfile!['level']} · ${_gamificationProfile!['xp']} XP · ${_gamificationProfile!['streak']} day streak',
                    style: const TextStyle(fontSize: 13),
                  ),
                  if ((_gamificationProfile!['badges'] as List?)?.isNotEmpty == true)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        'Badges: ${(_gamificationProfile!['badges'] as List).join(', ')}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _checkingIn ? null : _checkIn,
                    child: Text(_checkingIn ? 'Checking in…' : 'Daily check-in'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (_leaderboard.isEmpty)
          const Text('No XP yet — chat to earn points')
        else
          ..._leaderboard.map(
            (row) => ListTile(
              title: Text('#${row['rank']} · Lv ${row['level']}'),
              trailing: Text('${row['xp']} XP'),
            ),
          ),
      ],
    );
  }

  @override
  void dispose() {
    _unbindChannelSocket();
    _textCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Community')),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _buildChatTab(),
          _buildPostsTab(),
          _buildPollsTab(),
          _buildLeaderboardTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.article_outlined), label: 'Posts'),
          NavigationDestination(icon: Icon(Icons.poll_outlined), label: 'Polls'),
          NavigationDestination(icon: Icon(Icons.leaderboard_outlined), label: 'XP'),
        ],
      ),
    );
  }
}
