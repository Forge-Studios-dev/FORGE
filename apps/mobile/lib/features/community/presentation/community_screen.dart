import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/access/access_session_controller.dart';
import '../../profile/presentation/membership_panel.dart';
import '../../auth/data/auth_repository.dart';

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
  List<Map<String, dynamic>> _liveStreams = [];
  List<Map<String, dynamic>> _postComments = [];
  List<Map<String, dynamic>> _wikiPages = [];
  List<Map<String, dynamic>> _challenges = [];
  List<Map<String, dynamic>> _surveys = [];
  List<Map<String, dynamic>> _voiceRooms = [];
  List<Map<String, dynamic>> _textRooms = [];
  final Map<String, List<dynamic>> _surveyAnswers = {};
  final Map<String, TextEditingController> _surveyTextCtrls = {};
  String? _myUserId;
  bool _checkingIn = false;
  final _textCtrl = TextEditingController();
  bool _loading = true;
  bool _accessDenied = false;
  String? _accessReason;
  bool _sessionConflict = false;
  bool _communityRestricted = false;
  bool _canRequestJoin = false;
  bool _joinPending = false;
  String? _communityRestrictedId;
  String? _communityId;
  void Function(dynamic)? _messageHandler;
  void Function(dynamic)? _deleteHandler;

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
    _deleteHandler = (payload) {
      if (payload is Map<String, dynamic>) {
        final messageId = payload['messageId'] as String? ?? payload['id'] as String?;
        if (messageId != null) _markMessageDeleted(messageId);
      }
    };
    ForgeSocket.on('channel:message', _messageHandler!);
    ForgeSocket.on('channel:message:delete', _deleteHandler!);
  }

  void _unbindChannelSocket() {
    if (_messageHandler != null) {
      ForgeSocket.off('channel:message', _messageHandler);
      _messageHandler = null;
    }
    if (_deleteHandler != null) {
      ForgeSocket.off('channel:message:delete', _deleteHandler);
      _deleteHandler = null;
    }
    if (_activeChannelId != null) {
      ForgeSocket.leaveChannel(_activeChannelId!);
    }
  }

  void _markMessageDeleted(String messageId) {
    setState(() {
      _messages = _messages.map((m) {
        if (m['id'] == messageId) {
          return {...m, 'body': '[deleted]', 'deletedAt': DateTime.now().toIso8601String()};
        }
        return m;
      }).toList();
    });
  }

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
        await Future.wait([
          _loadPosts(),
          _loadPoll(),
          _loadLeaderboard(),
          _loadGamificationProfile(),
          _loadLiveStreams(),
          _loadEngageContent(),
        ]);
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

  Future<void> _loadLeaderboard() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/$_communityId/leaderboard');
      final data = response.data['data'] as List;
      setState(() => _leaderboard = data.cast<Map<String, dynamic>>());
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

  Future<void> _deleteMessage(String messageId) async {
    if (_activeChannelId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/channels/$_activeChannelId/messages/$messageId');
      _markMessageDeleted(messageId);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete message')),
        );
      }
    }
  }

  Future<void> _reportMessage(String messageId) async {
    if (_communityId == null || _activeChannelId == null) return;
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final ctrl = TextEditingController(text: 'Inappropriate content');
        return AlertDialog(
          title: const Text('Report message'),
          content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Reason')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Report')),
          ],
        );
      },
    );
    if (reason == null || reason.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/reports', data: {
        'targetType': 'message',
        'channelId': _activeChannelId,
        'messageId': messageId,
        'reason': reason,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {}
  }

  Future<void> _reportUser(String userId) async {
    if (_communityId == null) return;
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final ctrl = TextEditingController(text: 'Inappropriate behavior');
        return AlertDialog(
          title: const Text('Report user'),
          content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Reason')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Report')),
          ],
        );
      },
    );
    if (reason == null || reason.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/reports', data: {
        'targetType': 'user',
        'reportedUserId': userId,
        'reason': reason,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('User report submitted')),
        );
      }
    } catch (_) {}
  }

  Future<void> _loadEngageContent() async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final results = await Future.wait([
        client.dio.get('/communities/$_communityId/wiki'),
        client.dio.get('/communities/$_communityId/challenges'),
        client.dio.get('/communities/$_communityId/surveys'),
        client.dio.get('/communities/$_communityId/rooms'),
      ]);
      setState(() {
        _wikiPages = (results[0].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _challenges = (results[1].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _surveys = (results[2].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        final rooms = (results[3].data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _voiceRooms = rooms.where((r) => r['roomType'] != 'text').toList();
        _textRooms = rooms.where((r) => r['roomType'] == 'text').toList();
      });
    } catch (_) {}
  }

  Future<void> _joinChallenge(String challengeId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/communities/$_communityId/challenges/$challengeId/join');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Joined challenge')),
        );
      }
    } catch (_) {}
  }

  Future<void> _respondSurvey(String surveyId) async {
    if (_communityId == null) return;
    final answers = _surveyAnswers[surveyId] ?? [];
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/communities/$_communityId/surveys/$surveyId/respond',
        data: {'answers': answers},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Survey submitted')),
        );
      }
      await _loadEngageContent();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit survey')),
        );
      }
    }
  }

  TextEditingController _surveyAnswerCtrl(String surveyId, int questionIndex) {
    final key = '$surveyId-$questionIndex';
    return _surveyTextCtrls.putIfAbsent(key, TextEditingController.new);
  }

  void _setSurveyAnswer(String surveyId, int questionIndex, dynamic value) {
    final answers = List<dynamic>.from(_surveyAnswers[surveyId] ?? []);
    while (answers.length <= questionIndex) {
      answers.add(null);
    }
    answers[questionIndex] = value;
    _surveyAnswers[surveyId] = answers;
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
    } catch (_) {}
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
      await _loadPostComments(postId);
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
                            MembershipPanel(creatorId: widget.creatorId, communityId: _communityId),
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
                              final messageId = m['id'] as String?;
                              final userId = m['userId'] as String?;
                              final deleted = m['deletedAt'] != null;
                              final canDelete = _myUserId != null && userId == _myUserId && !deleted;
                              final canReport = _myUserId != null && userId != _myUserId && !deleted;
                              return Padding(
                                padding: EdgeInsets.only(
                                  bottom: 8,
                                  left: parentId != null ? 16 : 0,
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: GestureDetector(
                                        onLongPress: deleted
                                            ? null
                                            : () => setState(() => _replyToId = messageId),
                                        child: Text(
                                          '${user?['displayName'] ?? 'Member'}: ${m['body']}',
                                          style: parentId != null || deleted
                                              ? TextStyle(
                                                  fontSize: 13,
                                                  color: deleted ? Colors.grey : null,
                                                  fontStyle: deleted ? FontStyle.italic : null,
                                                )
                                              : null,
                                        ),
                                      ),
                                    ),
                                    if (canReport && messageId != null)
                                      PopupMenuButton<String>(
                                        icon: const Icon(Icons.flag_outlined, size: 16),
                                        onSelected: (value) {
                                          if (value == 'message') {
                                            _reportMessage(messageId);
                                          } else if (value == 'user' && userId != null) {
                                            _reportUser(userId);
                                          }
                                        },
                                        itemBuilder: (_) => [
                                          const PopupMenuItem(value: 'message', child: Text('Report message')),
                                          if (userId != null)
                                            const PopupMenuItem(value: 'user', child: Text('Report user')),
                                        ],
                                      ),
                                    if (canDelete && messageId != null)
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 16),
                                        onPressed: () => _deleteMessage(messageId),
                                      ),
                                  ],
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
                              child: Text('▶ Watch video', style: TextStyle(color: ForgeTokens.primary)),
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
                    (c) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '${(c['author'] as Map?)?['displayName'] ?? 'Member'}: ${c['body']}',
                        style: const TextStyle(fontSize: 13, color: Colors.grey),
                      ),
                    ),
                  ),
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
    var webBase = AppConstants.webBaseUrl;
    try {
      final config = await ref.read(platformConfigProvider.future);
      final fromConfig = config['webUrl'] as String?;
      if (fromConfig != null && fromConfig.isNotEmpty) {
        webBase = fromConfig;
      }
    } catch (_) {}
    final url = '$webBase/community/$_communityId/voice/$roomId';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open FORGE on web to join voice rooms')),
      );
    }
  }

  Widget _buildEngageTab() {
    if (_wikiPages.isEmpty &&
        _challenges.isEmpty &&
        _surveys.isEmpty &&
        _voiceRooms.isEmpty &&
        _textRooms.isEmpty) {
      return const Center(child: Text('No wiki, challenges, surveys, or rooms yet'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_textRooms.isNotEmpty) ...[
          const Text('Text rooms', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._textRooms.map(
            (r) => Card(
              child: ListTile(
                title: Text(r['name'] as String? ?? 'Room'),
                subtitle: const Text('text'),
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
                  child: const Text('Join on web'),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (_wikiPages.isNotEmpty) ...[
          const Text('Knowledge base', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._wikiPages.map(
            (p) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ExpansionTile(
                title: Text(p['title'] as String? ?? 'Page'),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(p['body'] as String? ?? ''),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (_challenges.isNotEmpty) ...[
          const Text('Challenges', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._challenges.map(
            (c) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(c['title'] as String? ?? ''),
                subtitle: Text(c['description'] as String? ?? ''),
                trailing: TextButton(
                  onPressed: () => _joinChallenge(c['id'] as String),
                  child: const Text('Join'),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        if (_surveys.isNotEmpty) ...[
          const Text('Surveys', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._surveys.map((s) {
            final surveyId = s['id'] as String;
            final questions = (s['questions'] as List?)?.cast<Map<String, dynamic>>() ?? [];
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s['title'] as String? ?? 'Survey',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    ...questions.asMap().entries.map((entry) {
                      final qi = entry.key;
                      final q = entry.value;
                      final options = (q['options'] as List?)?.cast<String>() ?? [];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(q['question'] as String? ?? 'Question', style: const TextStyle(fontSize: 13)),
                            const SizedBox(height: 6),
                            if (options.isNotEmpty)
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: options.map((opt) {
                                  final selected = (_surveyAnswers[surveyId] ?? [])[qi] == opt;
                                  return ChoiceChip(
                                    label: Text(opt, style: const TextStyle(fontSize: 12)),
                                    selected: selected,
                                    onSelected: (_) {
                                      setState(() => _setSurveyAnswer(surveyId, qi, opt));
                                    },
                                  );
                                }).toList(),
                              )
                            else
                              TextField(
                                controller: _surveyAnswerCtrl(surveyId, qi),
                                decoration: const InputDecoration(
                                  hintText: 'Your answer',
                                  isDense: true,
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (value) => _setSurveyAnswer(surveyId, qi, value),
                              ),
                          ],
                        ),
                      );
                    }),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => _respondSurvey(surveyId),
                        child: const Text('Submit survey'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
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
    for (final ctrl in _surveyTextCtrls.values) {
      ctrl.dispose();
    }
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
                const Icon(Icons.lock_outline, size: 48, color: Colors.grey),
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
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: [
                _buildChatTab(),
                _buildPostsTab(),
                _buildPollsTab(),
                _buildLeaderboardTab(),
                _buildEngageTab(),
              ],
            ),
          ),
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
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: 'Engage'),
        ],
      ),
    );
  }
}
