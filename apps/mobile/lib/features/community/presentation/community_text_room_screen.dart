import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';

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

  Future<void> _connectSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinCommunity(widget.communityId);
    ForgeSocket.joinRoom(widget.roomId);
    _messageHandler = (payload) {
      final data = payload as Map<String, dynamic>?;
      final message = data?['message'] as Map<String, dynamic>?;
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
      final client = ref.read(apiClientProvider);
      final roomRes = await client.dio.get(
        '/communities/${widget.communityId}/rooms/${widget.roomId}',
      );
      final msgRes = await client.dio.get(
        '/communities/${widget.communityId}/rooms/${widget.roomId}/messages',
      );
      setState(() {
        _roomName = roomRes.data['data']?['name'] as String?;
        _messages = (msgRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final body = _draftCtrl.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.post(
        '/communities/${widget.communityId}/rooms/${widget.roomId}/messages',
        data: {'body': body},
      );
      _draftCtrl.clear();
      final message = res.data['data'] as Map<String, dynamic>?;
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
    return Scaffold(
      appBar: AppBar(
        title: Text(_roomName ?? 'Text room'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i];
                      final author = m['user']?['displayName'] ?? m['user']?['username'] ?? 'Member';
                      return ListTile(
                        title: Text(author.toString()),
                        subtitle: Text(m['body']?.toString() ?? ''),
                        dense: true,
                      );
                    },
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
                            decoration: const InputDecoration(
                              hintText: 'Message…',
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
            ),
    );
  }
}
