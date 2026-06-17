import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  List<Map<String, dynamic>> _channels = [];
  String? _activeChannelId;
  List<Map<String, dynamic>> _messages = [];
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
          : '/communities/${widget.creatorId}';
      final response = await client.dio.get(path);
      final data = response.data['data'] as Map<String, dynamic>;
      final community = data['community'] as Map<String, dynamic>?;
      _communityId = community?['id'] as String?;
      final channels = (data['channels'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final firstAccessible = channels.cast<Map<String, dynamic>?>().firstWhere(
            (ch) => ch != null && _channelAccessible(ch),
            orElse: () => channels.isNotEmpty ? channels.first : null,
          );
      setState(() {
        _channels = channels;
        _activeChannelId = firstAccessible?['id'] as String?;
        _loading = false;
      });
      if (_activeChannelId != null) {
        await _selectChannel(_activeChannelId!);
      }
    } catch (_) {
      setState(() => _loading = false);
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

  String _accessLabel() {
    if (_accessReason == 'tier_required') return 'A higher membership tier is required';
    if (_accessReason == 'subscription_required') return 'Membership required to access this channel';
    return 'You do not have access to this channel';
  }

  @override
  void dispose() {
    _unbindChannelSocket();
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
                final locked = !_channelAccessible(ch);
                return ListTile(
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
