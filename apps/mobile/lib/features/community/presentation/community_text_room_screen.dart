import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/socket/forge_socket.dart';
import '../data/community_repository.dart';

class CommunityTextRoomScreen extends ConsumerStatefulWidget {
  const CommunityTextRoomScreen({
    super.key,
    required this.communityId,
    required this.roomId,
  });

  final String communityId;
  final String roomId;

  @override
  ConsumerState<CommunityTextRoomScreen> createState() => _CommunityTextRoomScreenState();
}

class _CommunityTextRoomScreenState extends ConsumerState<CommunityTextRoomScreen> {
  final _draftCtrl = TextEditingController();
  List<Map<String, dynamic>> _messages = [];
  String? _roomName;
  String? _replyToId;
  String? _replyToLabel;
  String? _currentUserId;
  bool _loading = true;
  bool _sending = false;
  void Function(dynamic)? _messageHandler;

  @override
  void initState() {
    super.initState();
    _load();
    _connectSocket();
  }

  @override
  void dispose() {
    _teardownSocket();
    _draftCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _threadedMessages {
    final byId = {for (final m in _messages) m['id'] as String: m};
    final roots = _messages.where((m) => m['parentMessageId'] == null).toList();
    final repliesByParent = <String, List<Map<String, dynamic>>>{};
    for (final m in _messages) {
      final parentId = m['parentMessageId'] as String?;
      if (parentId != null) {
        repliesByParent.putIfAbsent(parentId, () => []).add(m);
      }
    }
    final result = <Map<String, dynamic>>[];
    for (final root in roots) {
      result.add({...root, '_depth': 0});
      for (final reply in repliesByParent[root['id']] ?? []) {
        result.add({...reply, '_depth': 1});
      }
    }
    for (final m in _messages) {
      final parentId = m['parentMessageId'] as String?;
      if (parentId != null && !byId.containsKey(parentId)) {
        result.add({...m, '_depth': 1});
      }
    }
    return result;
  }

  Future<void> _connectSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinCommunity(widget.communityId);
    ForgeSocket.joinRoom(widget.roomId);
    _messageHandler = (payload) {
      final data = payload as Map<String, dynamic>?;
      final message = data?['message'] as Map<String, dynamic>? ?? data;
      if (message == null) return;
      if (message['roomId'] != widget.roomId && message['roomId'] != null) return;
      setState(() {
        if (!_messages.any((m) => m['id'] == message['id'])) {
          _messages = [..._messages, message];
        }
      });
    };
    ForgeSocket.on('room:message', _messageHandler!);
  }

  void _teardownSocket() {
    if (_messageHandler != null) {
      ForgeSocket.off('room:message', _messageHandler);
    }
    ForgeSocket.leaveRoom(widget.roomId);
    ForgeSocket.leaveCommunity(widget.communityId);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(communityRepositoryProvider);
      final room = await repo.getRoom(widget.communityId, widget.roomId);
      final messages = await repo.getRoomMessages(widget.communityId, widget.roomId);
      String? userId;
      try {
        userId = await repo.getCurrentUserId();
      } catch (_) {}
      setState(() {
        _roomName = room?['name'] as String?;
        _messages = messages;
        _currentUserId = userId;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setReply(Map<String, dynamic> msg) {
    final author = msg['user']?['displayName'] ?? msg['user']?['username'] ?? 'Member';
    setState(() {
      _replyToId = msg['id'] as String?;
      _replyToLabel = author.toString();
    });
  }

  void _clearReply() {
    setState(() {
      _replyToId = null;
      _replyToLabel = null;
    });
  }

  Future<void> _reportMessage(Map<String, dynamic> msg) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Report message'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(hintText: 'Reason'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final text = reasonCtrl.text.trim();
              if (text.isNotEmpty) Navigator.pop(ctx, text);
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    reasonCtrl.dispose();
    if (reason == null || reason.isEmpty || !mounted) return;
    try {
      await ref.read(communityRepositoryProvider).submitReport(
        widget.communityId,
        {
          'targetType': 'message',
          'roomId': widget.roomId,
          'messageId': msg['id'],
          'reason': reason,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit report')),
        );
      }
    }
  }

  Future<void> _send() async {
    final body = _draftCtrl.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final message = await ref.read(communityRepositoryProvider).sendRoomMessage(
            widget.communityId,
            widget.roomId,
            body: body,
            parentMessageId: _replyToId,
          );
      _draftCtrl.clear();
      _clearReply();
      if (message != null && !_messages.any((m) => m['id'] == message['id'])) {
        setState(() => _messages = [..._messages, message]);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send message')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final threaded = _threadedMessages;
    return Scaffold(
      appBar: AppBar(
        title: Text(_roomName ?? 'Text room'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), tooltip: 'Refresh messages', onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: threaded.length,
                    itemBuilder: (_, i) {
                      final m = threaded[i];
                      final depth = m['_depth'] as int? ?? 0;
                      final author = m['user']?['displayName'] ?? m['user']?['username'] ?? 'Member';
                      final parentId = m['parentMessageId'] as String?;
                      final parent = parentId != null
                          ? _messages.cast<Map<String, dynamic>?>().firstWhere(
                                (x) => x?['id'] == parentId,
                                orElse: () => null,
                              )
                          : null;
                      return ListTile(
                        contentPadding: EdgeInsets.only(left: 12.0 + depth * 16, right: 12),
                        title: Text(author.toString()),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (depth > 0 && parent != null)
                              Text(
                                '↳ reply to ${parent['user']?['displayName'] ?? 'message'}',
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                            Text(m['body']?.toString() ?? ''),
                          ],
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_currentUserId == null ||
                                m['userId']?.toString() != _currentUserId)
                              IconButton(
                                icon: const Icon(Icons.flag_outlined, size: 18),
                                tooltip: 'Report message',
                                onPressed: () => _reportMessage(m),
                              ),
                            IconButton(
                              icon: const Icon(Icons.reply, size: 18),
                              tooltip: 'Reply',
                              onPressed: () => _setReply(m),
                            ),
                          ],
                        ),
                        dense: true,
                      );
                    },
                  ),
                ),
                if (_replyToId != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Replying to $_replyToLabel',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        TextButton(onPressed: _clearReply, child: const Text('Cancel')),
                      ],
                    ),
                  ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _draftCtrl,
                            decoration: InputDecoration(
                              hintText: _replyToId != null ? 'Write a reply…' : 'Message…',
                              border: const OutlineInputBorder(),
                            ),
                            onSubmitted: (_) => _send(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          tooltip: 'Send message',
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
            ),
    );
  }
}
