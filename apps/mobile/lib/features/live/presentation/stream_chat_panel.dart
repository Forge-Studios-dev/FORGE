import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';

class StreamChatPanel extends ConsumerStatefulWidget {
  final String streamId;
  final String? streamOwnerId;
  final bool chatEnabled;
  final String chatMode;

  const StreamChatPanel({
    super.key,
    required this.streamId,
    this.streamOwnerId,
    this.chatEnabled = true,
    this.chatMode = 'all',
  });

  @override
  ConsumerState<StreamChatPanel> createState() => _StreamChatPanelState();
}

class _StreamChatPanelState extends ConsumerState<StreamChatPanel> {
  final _textCtrl = TextEditingController();
  final _unbanCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  String? _myUserId;
  bool _isAdmin = false;
  bool _isDelegatedMod = false;
  int _slowMode = 0;
  String? _pinnedId;
  bool _chatEnabled = true;
  String _chatMode = 'all';

  void Function(dynamic)? _onChatMessage;
  void Function(dynamic)? _onChatDelete;
  void Function(dynamic)? _onSlowMode;
  void Function(dynamic)? _onPinned;
  void Function(dynamic)? _onChatSettings;

  static const _chatModeLabels = <String, String>{
    'all': 'Everyone can chat',
    'followers': 'Subscribers-only chat',
    'subscribers': 'Members-only chat',
    'mods_only': 'Moderators-only chat',
  };

  @override
  void initState() {
    super.initState();
    _chatEnabled = widget.chatEnabled;
    _chatMode = widget.chatMode;
    _loadMessages();
    _bindSocket();
  }

  @override
  void didUpdateWidget(StreamChatPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.chatEnabled != widget.chatEnabled) {
      setState(() => _chatEnabled = widget.chatEnabled);
    }
    if (oldWidget.chatMode != widget.chatMode) {
      setState(() => _chatMode = widget.chatMode);
    }
  }

  Future<void> _loadMessages() async {
    try {
      final client = ref.read(apiClientProvider);
      try {
        final me = await client.dio.get('/users/me');
        _myUserId = me.data['data']?['id'] as String?;
        _isAdmin = me.data['data']?['role'] == 'admin';
        if (_myUserId != null) {
          final modRes = await client.dio.get('/streams/${widget.streamId}/moderator-status');
          _isDelegatedMod = modRes.data['data']?['isMod'] == true;
        }
      } catch (_) {}
      final response = await client.dio.get('/streams/${widget.streamId}/chat');
      final list = response.data['data']['data'] as List? ?? [];
      if (!mounted) return;
      setState(() {
        _messages = list.cast<Map<String, dynamic>>();
        _loading = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _bindSocket() {
    _onChatMessage = (payload) {
      if (payload is! Map) return;
      final msg = Map<String, dynamic>.from(payload);
      if (msg['streamId'] != widget.streamId && msg['streamId'] != null) return;
      if (!mounted) return;
      setState(() {
        if (_messages.any((m) => m['id'] == msg['id'])) return;
        _messages = [..._messages, msg];
      });
      _scrollToBottom();
    };
    _onChatDelete = (payload) {
      if (payload is! Map || payload['streamId'] != widget.streamId) return;
      final messageId = payload['messageId'] as String?;
      if (messageId == null || !mounted) return;
      setState(() {
        _messages = _messages
            .map((m) => m['id'] == messageId ? {...m, 'body': '[deleted]'} : m)
            .toList();
      });
    };
    _onSlowMode = (payload) {
      if (payload is! Map || payload['streamId'] != widget.streamId) return;
      if (!mounted) return;
      setState(() => _slowMode = payload['slowModeSeconds'] as int? ?? 0);
    };
    _onPinned = (payload) {
      if (payload is! Map || payload['streamId'] != widget.streamId) return;
      if (!mounted) return;
      setState(() => _pinnedId = payload['messageId'] as String?);
    };
    _onChatSettings = (payload) {
      if (payload is! Map || payload['streamId'] != widget.streamId) return;
      if (!mounted) return;
      setState(() {
        if (payload['chatEnabled'] is bool) {
          _chatEnabled = payload['chatEnabled'] as bool;
        }
        if (payload['chatMode'] is String) {
          _chatMode = payload['chatMode'] as String;
        }
      });
    };
    ForgeSocket.on('stream:chat:message', _onChatMessage!);
    ForgeSocket.on('stream:chat:delete', _onChatDelete!);
    ForgeSocket.on('stream:chat:slow-mode', _onSlowMode!);
    ForgeSocket.on('stream:chat:pinned', _onPinned!);
    ForgeSocket.on('stream:chat:settings', _onChatSettings!);
  }

  bool get _isMod =>
      _myUserId != null &&
      (_myUserId == widget.streamOwnerId || _isAdmin || _isDelegatedMod);

  String _displayName(Map<String, dynamic>? user) {
    final username = user?['username'] as String?;
    if (username != null && username.isNotEmpty) return '@$username';
    return user?['displayName'] as String? ?? 'User';
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final body = _textCtrl.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/streams/${widget.streamId}/chat', data: {'body': body});
      _textCtrl.clear();
      await _loadMessages();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send message. Sign in to chat.')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _unban() async {
    final username = _unbanCtrl.text.trim().replaceFirst(RegExp(r'^@'), '');
    if (username.length < 2) return;
    try {
      await ref.read(apiClientProvider).dio.post(
            '/streams/${widget.streamId}/chat/unban',
            data: {'targetUsername': username},
          );
      _unbanCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Unbanned @$username')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unban user')),
        );
      }
    }
  }

  Map<String, dynamic> _modTarget(Map<String, dynamic> m) {
    final user = m['user'] as Map<String, dynamic>?;
    final username = user?['username'] as String?;
    final userId = m['userId'] as String?;
    if (username != null && username.isNotEmpty) {
      return {'targetUsername': username};
    }
    return {'targetUserId': userId};
  }

  @override
  void dispose() {
    if (_onChatMessage != null) ForgeSocket.off('stream:chat:message', _onChatMessage);
    if (_onChatDelete != null) ForgeSocket.off('stream:chat:delete', _onChatDelete);
    if (_onSlowMode != null) ForgeSocket.off('stream:chat:slow-mode', _onSlowMode);
    if (_onPinned != null) ForgeSocket.off('stream:chat:pinned', _onPinned);
    if (_onChatSettings != null) ForgeSocket.off('stream:chat:settings', _onChatSettings);
    _textCtrl.dispose();
    _unbanCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_chatEnabled) {
      return Center(
        child: Text('Chat is disabled', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
      );
    }

    if (_loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    final pinned = _pinnedId != null
        ? _messages.cast<Map<String, dynamic>?>().firstWhere(
              (m) => m?['id'] == _pinnedId,
              orElse: () => null,
            )
        : null;

    final modeLabel = _chatModeLabels[_chatMode];

    return Column(
      children: [
        if (_isMod)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Row(
              children: [
                for (final s in [0, 5, 10, 30])
                  TextButton(
                    onPressed: () async {
                      await ref.read(apiClientProvider).dio.patch(
                            '/streams/${widget.streamId}/chat/slow-mode',
                            data: {'slowModeSeconds': s},
                          );
                    },
                    child: Text(s == 0 ? 'Slow off' : '${s}s'),
                  ),
              ],
            ),
          ),
        if (modeLabel != null && _chatMode != 'all')
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            child: Text(modeLabel, style: TextStyle(fontSize: 11, color: ForgeTokens.of(context).onSurfaceVariant)),
          ),
        if (_isMod)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _unbanCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Unban @username',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(onPressed: _unban, child: const Text('Unban')),
              ],
            ),
          ),
        if (pinned != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Text(
              'Pinned: ${pinned['body']}',
              style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).warning),
            ),
          ),
        if (_slowMode > 0 && !_isMod)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text('Slow mode ${_slowMode}s', style: TextStyle(fontSize: 11, color: ForgeTokens.of(context).onSurfaceVariant)),
          ),
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Text('No messages yet', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
                )
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i];
                    final user = m['user'] as Map<String, dynamic>?;
                    final name = _displayName(user);
                    final body = m['body'] as String? ?? '';
                    final userId = m['userId'] as String?;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: RichText(
                              text: TextSpan(
                                style: const TextStyle(color: Colors.white, fontSize: 13),
                                children: [
                                  TextSpan(
                                    text: '$name: ',
                                    style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white70),
                                  ),
                                  TextSpan(text: body),
                                ],
                              ),
                            ),
                          ),
                          if (_isMod && body != '[deleted]')
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                TextButton(
                                  onPressed: () async {
                                    await ref.read(apiClientProvider).dio.patch(
                                          '/streams/${widget.streamId}/chat/pin',
                                          data: {'messageId': m['id']},
                                        );
                                  },
                                  child: const Text('Pin', style: TextStyle(fontSize: 11)),
                                ),
                                TextButton(
                                  onPressed: () async {
                                    await ref.read(apiClientProvider).dio.delete(
                                          '/streams/${widget.streamId}/chat/${m['id']}',
                                        );
                                  },
                                  child: const Text('Del', style: TextStyle(fontSize: 11)),
                                ),
                                if (userId != null && userId != _myUserId) ...[
                                  TextButton(
                                    onPressed: () async {
                                      await ref.read(apiClientProvider).dio.post(
                                            '/streams/${widget.streamId}/chat/timeout',
                                            data: {
                                              ..._modTarget(m),
                                              'durationSeconds': 300,
                                            },
                                          );
                                    },
                                    child: const Text('To', style: TextStyle(fontSize: 11)),
                                  ),
                                  TextButton(
                                    onPressed: () async {
                                      await ref.read(apiClientProvider).dio.post(
                                            '/streams/${widget.streamId}/chat/ban',
                                            data: _modTarget(m),
                                          );
                                    },
                                    child: const Text('Ban', style: TextStyle(fontSize: 11, color: Colors.redAccent)),
                                  ),
                                ],
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Say something…',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
