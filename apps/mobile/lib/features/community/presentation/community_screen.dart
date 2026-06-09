import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  final String creatorId;
  const CommunityScreen({super.key, required this.creatorId});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  List<Map<String, dynamic>> _channels = [];
  String? _activeChannelId;
  List<Map<String, dynamic>> _messages = [];
  final _textCtrl = TextEditingController();
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCommunity();
  }

  Future<void> _loadCommunity() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/${widget.creatorId}');
      final data = response.data['data'] as Map<String, dynamic>;
      final channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _channels = channels;
        _activeChannelId = channels.isNotEmpty ? channels.first['id'] as String : null;
        _loading = false;
      });
      if (_activeChannelId != null) {
        await _loadMessages(_activeChannelId!);
        await ForgeSocket.connect();
        ForgeSocket.joinChannel(_activeChannelId!);
        ForgeSocket.on('channel:message', (payload) {
          if (payload is Map<String, dynamic>) {
            _appendMessage(payload);
          }
        });
      }
    } catch (_) {
      setState(() => _loading = false);
    }
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
      });
    } catch (_) {}
  }

  Future<void> _sendMessage() async {
    if (_activeChannelId == null || _textCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post('/channels/$_activeChannelId/messages', data: {
        'body': _textCtrl.text.trim(),
      });
      _textCtrl.clear();
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

  @override
  void dispose() {
    if (_activeChannelId != null) {
      ForgeSocket.leaveChannel(_activeChannelId!);
    }
    _textCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_channels.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Community')),
        body: const Center(child: Text('No community channels yet')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Community')),
      body: Row(
        children: [
          SizedBox(
            width: 120,
            child: ListView(
              children: _channels.map((ch) {
                final id = ch['id'] as String;
                final selected = id == _activeChannelId;
                return ListTile(
                  dense: true,
                  title: Text(
                    ch['name'] as String? ?? '',
                    style: TextStyle(
                      fontSize: 13,
                      color: selected ? Theme.of(context).colorScheme.primary : null,
                    ),
                  ),
                  onTap: () async {
                    if (_activeChannelId != null) ForgeSocket.leaveChannel(_activeChannelId!);
                    setState(() => _activeChannelId = id);
                    ForgeSocket.joinChannel(id);
                    await _loadMessages(id);
                  },
                );
              }).toList(),
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i];
                      final user = m['user'] as Map<String, dynamic>?;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text('${user?['displayName'] ?? 'Member'}: ${m['body']}'),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textCtrl,
                          decoration: const InputDecoration(hintText: 'Message…', isDense: true),
                        ),
                      ),
                      IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
