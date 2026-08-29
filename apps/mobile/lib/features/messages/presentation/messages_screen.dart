import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_palette.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../auth/data/auth_repository.dart';
import '../data/messages_repository.dart';

class _SearchUser {
  final String id;
  final String username;
  final String? displayName;

  const _SearchUser({
    required this.id,
    required this.username,
    this.displayName,
  });

  factory _SearchUser.fromJson(Map<String, dynamic> json) => _SearchUser(
        id: json['id'] as String,
        username: json['username'] as String? ?? '',
        displayName: json['displayName'] as String?,
      );
}

/// Direct messages — conversation list, username search compose, live thread.
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
  bool _sending = false;
  bool _composingNew = false;
  String? _myUserId;

  final _draftCtrl = TextEditingController();
  final _recipientQueryCtrl = TextEditingController();
  _SearchUser? _selectedRecipient;
  List<_SearchUser> _suggestions = [];
  Timer? _searchDebounce;
  void Function(dynamic)? _onDmMessage;

  MessagesRepository get _repo => ref.read(messagesRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final user = await ref.read(authRepositoryProvider).getStoredUser();
    _myUserId = user?['id'] as String?;
    await _loadConversations();
  }

  Future<void> _loadConversations() async {
    try {
      final list = await _repo.listConversations();
      if (mounted) {
        setState(() {
          _conversations = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openConversation(String id) async {
    if (_activeId != null && _activeId != id) {
      ForgeSocket.leaveConversation(_activeId!);
    }
    setState(() {
      _activeId = id;
      _composingNew = false;
      _messages = [];
    });
    try {
      await _repo.markRead(id);
      final messages = await _repo.getMessages(id);
      if (mounted) {
        setState(() {
          _messages = messages;
        });
      }
      await _bindSocket(id);
    } catch (_) {}
  }

  Future<void> _bindSocket(String conversationId) async {
    await ForgeSocket.connect();
    if (_onDmMessage != null) {
      ForgeSocket.off('dm:message', _onDmMessage);
    }
    ForgeSocket.joinConversation(conversationId);
    _onDmMessage = (payload) {
      if (!mounted || _activeId != conversationId) return;
      final map = payload is Map
          ? Map<String, dynamic>.from(payload)
          : null;
      final cid = map?['conversationId'] as String? ??
          (map?['message'] is Map
              ? (map!['message'] as Map)['conversationId'] as String?
              : null);
      if (cid != null && cid != conversationId) return;
      unawaited(_refreshActiveMessages());
    };
    ForgeSocket.on('dm:message', _onDmMessage!);
  }

  Future<void> _refreshActiveMessages() async {
    final id = _activeId;
    if (id == null) return;
    try {
      final messages = await _repo.getMessages(id);
      if (!mounted || _activeId != id) return;
      setState(() {
        _messages = messages;
      });
      await _repo.markRead(id);
    } catch (_) {}
  }

  void _onRecipientQueryChanged(String q) {
    _searchDebounce?.cancel();
    if (_selectedRecipient != null) {
      setState(() => _selectedRecipient = null);
    }
    final term = q.trim();
    if (term.length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 280), () {
      unawaited(_searchUsers(term));
    });
  }

  Future<void> _searchUsers(String q) async {
    try {
      final list = await _repo.searchUsers(q: q);
      if (!mounted) return;
      setState(() {
        _suggestions = list
            .map(_SearchUser.fromJson)
            .where((u) => u.id != _myUserId && u.username.isNotEmpty)
            .toList();
      });
    } catch (_) {
      if (mounted) setState(() => _suggestions = []);
    }
  }

  Future<void> _send() async {
    final content = _draftCtrl.text.trim();
    if (content.isEmpty || _sending) return;

    String? recipientId = _selectedRecipient?.id;
    if (recipientId == null && _activeId != null) {
      final conv = _conversations.cast<dynamic>().whereType<Map>().firstWhere(
            (c) => c['conversationId'] == _activeId,
            orElse: () => <String, dynamic>{},
          );
      final peers = (conv['participants'] as List?) ?? [];
      final peer = peers.isNotEmpty ? peers.first as Map<String, dynamic>? : null;
      recipientId = peer?['id'] as String?;
    }
    if (recipientId == null || recipientId.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose a recipient')),
        );
      }
      return;
    }

    setState(() => _sending = true);
    try {
      final msg = await _repo.sendMessage(
        recipientId: recipientId,
        content: content,
      );
      _draftCtrl.clear();
      setState(() {
        _selectedRecipient = null;
        _suggestions = [];
        _composingNew = false;
      });
      _recipientQueryCtrl.clear();
      await _loadConversations();
      await _openConversation(msg['conversationId'] as String);
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.data is Map
            ? (e.response!.data['message'] as String? ??
                (e.response!.data['data'] is Map
                    ? (e.response!.data['data'] as Map)['message'] as String?
                    : null))
            : null;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              msg != null && msg.isNotEmpty ? msg : 'Could not send message. Tap Send to retry.',
            ),
            action: SnackBarAction(label: 'Retry', onPressed: _send),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Could not send message. Tap Send to retry.'),
            action: SnackBarAction(label: 'Retry', onPressed: _send),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _closeThread() {
    if (_activeId != null) {
      ForgeSocket.leaveConversation(_activeId!);
    }
    if (_onDmMessage != null) {
      ForgeSocket.off('dm:message', _onDmMessage);
      _onDmMessage = null;
    }
    setState(() {
      _activeId = null;
      _messages = [];
    });
  }

  Map<String, dynamic>? get _activePeer {
    if (_activeId == null) return null;
    for (final raw in _conversations) {
      if (raw is! Map) continue;
      if (raw['conversationId'] != _activeId) continue;
      final peers = raw['participants'] as List?;
      if (peers == null || peers.isEmpty) return null;
      return peers.first as Map<String, dynamic>?;
    }
    return null;
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    if (_activeId != null) ForgeSocket.leaveConversation(_activeId!);
    if (_onDmMessage != null) ForgeSocket.off('dm:message', _onDmMessage);
    _draftCtrl.dispose();
    _recipientQueryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final showingThread = _activeId != null && !_composingNew;
    final peer = _activePeer;
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          showingThread
              ? (peer?['displayName'] as String? ?? 'Conversation')
              : _composingNew
                  ? 'New message'
                  : 'Messages',
        ),
        leading: showingThread || _composingNew
            ? IconButton(
                tooltip: 'Back',
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (showingThread) {
                    _closeThread();
                  } else {
                    setState(() {
                      _composingNew = false;
                      _selectedRecipient = null;
                      _suggestions = [];
                      _recipientQueryCtrl.clear();
                    });
                  }
                },
              )
            : null,
        actions: [
          if (!showingThread && !_composingNew)
            IconButton(
              tooltip: 'New message',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => setState(() => _composingNew = true),
            ),
        ],
      ),
      body: showingThread
          ? _buildThread(t, peer)
          : _composingNew
              ? _buildComposeNew(t)
              : _buildConversationList(t),
    );
  }

  Widget _buildConversationList(ForgePalette t) {
    if (_conversations.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chat_bubble_outline, size: 48, color: t.onSurfaceVariant),
              const SizedBox(height: 12),
              Text(
                'No conversations yet',
                style: TextStyle(color: t.onSurface, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                'Search by @username to start a message.',
                textAlign: TextAlign.center,
                style: TextStyle(color: t.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => setState(() => _composingNew = true),
                child: const Text('New message'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadConversations,
      child: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (_, i) {
          final c = _conversations[i] as Map<String, dynamic>;
          final id = c['conversationId'] as String;
          final peer = (c['participants'] as List?)?.first as Map<String, dynamic>?;
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: t.surfaceContainerHigh,
              child: Text(
                () {
                  final name = (peer?['displayName'] as String?) ?? 'U';
                  return name.isNotEmpty ? name[0].toUpperCase() : 'U';
                }(),
                style: TextStyle(color: t.onSurface),
              ),
            ),
            title: Text(peer?['displayName'] as String? ?? 'User'),
            subtitle: Text('@${peer?['username'] ?? ''}'),
            onTap: () => _openConversation(id),
          );
        },
      ),
    );
  }

  Widget _buildComposeNew(ForgePalette t) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_selectedRecipient != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              '@${_selectedRecipient!.username}'
              '${_selectedRecipient!.displayName != null ? ' · ${_selectedRecipient!.displayName}' : ''}',
            ),
            trailing: TextButton(
              onPressed: () => setState(() {
                _selectedRecipient = null;
                _recipientQueryCtrl.clear();
              }),
              child: const Text('Change'),
            ),
          )
        else ...[
          TextField(
            controller: _recipientQueryCtrl,
            onChanged: _onRecipientQueryChanged,
            decoration: const InputDecoration(
              labelText: 'To',
              hintText: 'Search @username',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          if (_suggestions.isNotEmpty)
            ..._suggestions.map(
              (u) => ListTile(
                title: Text(u.displayName ?? u.username),
                subtitle: Text('@${u.username}'),
                onTap: () => setState(() {
                  _selectedRecipient = u;
                  _suggestions = [];
                  _recipientQueryCtrl.clear();
                }),
              ),
            ),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _draftCtrl,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Message…',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: (_selectedRecipient != null &&
                    _draftCtrl.text.trim().isNotEmpty &&
                    !_sending)
                ? _send
                : null,
            child: Text(_sending ? 'Sending…' : 'Send'),
          ),
        ),
      ],
    );
  }

  Widget _buildThread(ForgePalette t, Map<String, dynamic>? peer) {
    return Column(
      children: [
        if (peer?['username'] != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '@${peer!['username']}',
                style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
              ),
            ),
          ),
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Text(
                    'Say hello',
                    style: TextStyle(color: t.onSurfaceVariant),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i] as Map<String, dynamic>;
                    final mine = m['senderId'] == _myUserId;
                    return Align(
                      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: mine ? t.primary : t.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          m['content'] as String? ?? '',
                          style: TextStyle(
                            color: mine ? t.onPrimary : t.onSurface,
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _draftCtrl,
                    minLines: 1,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Message…',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: 'Send message',
                  onPressed: (_draftCtrl.text.trim().isEmpty || _sending) ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
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
