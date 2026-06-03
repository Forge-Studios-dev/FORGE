import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';

class StreamChatPanel extends ConsumerStatefulWidget {
  final String streamId;
  const StreamChatPanel({super.key, required this.streamId});

  @override
  ConsumerState<StreamChatPanel> createState() => _StreamChatPanelState();
}

class _StreamChatPanelState extends ConsumerState<StreamChatPanel> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _bindSocket();
  }

  Future<void> _loadMessages() async {
    try {
      final client = ref.read(apiClientProvider);
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
    ForgeSocket.on('stream:chat:message', (payload) {
      if (payload is! Map) return;
      final msg = Map<String, dynamic>.from(payload);
      if (msg['streamId'] != widget.streamId) return;
      if (!mounted) return;
      setState(() {
        if (_messages.any((m) => m['id'] == msg['id'])) return;
        _messages = [..._messages, msg];
      });
      _scrollToBottom();
    });
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

  @override
  void dispose() {
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? const Center(
                  child: Text('No messages yet', style: TextStyle(color: Colors.grey)),
                )
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i];
                    final user = m['user'] as Map<String, dynamic>?;
                    final name = user?['displayName'] ?? user?['username'] ?? 'User';
                    final body = m['body'] as String? ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
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
