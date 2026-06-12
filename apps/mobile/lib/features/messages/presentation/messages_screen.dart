import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  List<dynamic> _conversations = [];
  String? _activeId;
  List<dynamic> _messages = [];
  bool _loading = true;
  final _draftCtrl = TextEditingController();
  final _recipientCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/messages/conversations');
      if (mounted) {
        setState(() {
          _conversations = res.data['data'] as List<dynamic>? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openConversation(String id) async {
    setState(() => _activeId = id);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/messages/conversations/$id/read');
      final res = await client.dio.get('/messages/conversations/$id', queryParameters: {'limit': 50});
      if (mounted) {
        setState(() {
          _messages = res.data['data']['data'] as List<dynamic>? ?? [];
        });
      }
    } catch (_) {}
  }

  Future<void> _send() async {
    final content = _draftCtrl.text.trim();
    final recipientId = _recipientCtrl.text.trim();
    if (content.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.post('/messages', data: {
        if (recipientId.isNotEmpty) 'recipientId': recipientId,
        'content': content,
      });
      final msg = res.data['data'] as Map<String, dynamic>;
      _draftCtrl.clear();
      _recipientCtrl.clear();
      await _loadConversations();
      await _openConversation(msg['conversationId'] as String);
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
    _draftCtrl.dispose();
    _recipientCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: Row(
        children: [
          SizedBox(
            width: 280,
            child: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: _conversations.length,
                    itemBuilder: (_, i) {
                      final c = _conversations[i] as Map<String, dynamic>;
                      final id = c['conversationId'] as String;
                      final peer = (c['participants'] as List?)?.first as Map<String, dynamic>?;
                      return ListTile(
                        selected: _activeId == id,
                        title: Text(peer?['displayName'] as String? ?? 'User'),
                        subtitle: Text('@${peer?['username'] ?? ''}'),
                        onTap: () => _openConversation(id),
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    children: [
                      TextField(
                        controller: _recipientCtrl,
                        decoration: const InputDecoration(hintText: 'Recipient user ID', isDense: true),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _draftCtrl,
                        decoration: const InputDecoration(hintText: 'New message…', isDense: true),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(onPressed: _send, child: const Text('Send')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: _activeId == null
                ? const Center(child: Text('Select a conversation', style: TextStyle(color: ForgeTokens.onSurfaceVariant)))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i] as Map<String, dynamic>;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(m['content'] as String? ?? ''),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
