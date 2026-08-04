import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/observability/capture_error.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';

/// Live Q&A panel — mirrors the web `StreamQaPanel`. Viewers submit and upvote
/// questions; the host can mark answered or dismiss. Reuses the stream socket
/// room for realtime updates (`stream:qa:created` / `stream:qa:updated`).
class StreamQaPanel extends ConsumerStatefulWidget {
  final String streamId;
  final bool isHost;
  const StreamQaPanel({super.key, required this.streamId, this.isHost = false});

  @override
  ConsumerState<StreamQaPanel> createState() => _StreamQaPanelState();
}

class _StreamQaPanelState extends ConsumerState<StreamQaPanel> {
  List<dynamic> _questions = [];
  bool _loading = true;
  bool _submitting = false;
  final _draftCtrl = TextEditingController();
  void Function(dynamic)? _onQaEvent;

  @override
  void initState() {
    super.initState();
    _load();
    _onQaEvent = (_) => _load();
    ForgeSocket.on('stream:qa:created', _onQaEvent!);
    ForgeSocket.on('stream:qa:updated', _onQaEvent!);
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/streams/${widget.streamId}/qa');
      if (!mounted) return;
      setState(() {
        _questions = res.data['data'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (e, st) {
      captureError(e, st, 'loadQa');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final body = _draftCtrl.text.trim();
    if (body.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .post('/streams/${widget.streamId}/qa', data: {'body': body});
      _draftCtrl.clear();
      await _load();
    } catch (e, st) {
      captureError(e, st, 'submitQa');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _upvote(String questionId) async {
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .post('/streams/${widget.streamId}/qa/$questionId/upvote');
      await _load();
    } catch (e, st) { captureError(e, st, 'upvoteQa'); }
  }

  Future<void> _setStatus(String questionId, String status) async {
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .patch('/streams/${widget.streamId}/qa/$questionId/status', data: {'status': status});
      await _load();
    } catch (e, st) { captureError(e, st, 'setQaStatus'); }
  }

  @override
  void dispose() {
    if (_onQaEvent != null) {
      ForgeSocket.off('stream:qa:created', _onQaEvent);
      ForgeSocket.off('stream:qa:updated', _onQaEvent);
    }
    _draftCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();

    final t = ForgeTokens.of(context);
    final visible = _questions
        .cast<Map<String, dynamic>>()
        .where((q) => widget.isHost || q['status'] != 'dismissed')
        .toList();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.surfaceContainer.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Q&A', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _draftCtrl,
                  maxLength: 500,
                  decoration: const InputDecoration(
                    hintText: 'Ask a question…',
                    isDense: true,
                    counterText: '',
                  ),
                ),
              ),
              TextButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? '…' : 'Ask'),
              ),
            ],
          ),
          if (visible.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text('No questions yet.', style: TextStyle(color: t.onSurfaceVariant)),
            )
          else
            for (final q in visible)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: () => _upvote(q['id'] as String),
                      child: Column(
                        children: [
                          Icon(
                            Icons.arrow_drop_up,
                            color: q['viewerHasUpvoted'] == true ? t.secondary : t.onSurfaceVariant,
                          ),
                          Text('${q['upvotes'] ?? 0}', style: TextStyle(fontSize: 12, color: t.onSurface)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            q['body'] as String? ?? '',
                            style: TextStyle(
                              color: q['status'] == 'answered' ? t.onSurfaceVariant : t.onSurface,
                            ),
                          ),
                          if (q['status'] != null && q['status'] != 'pending')
                            Text(
                              (q['status'] as String).toUpperCase(),
                              style: TextStyle(fontSize: 10, color: t.onSurfaceVariant),
                            ),
                          if (widget.isHost)
                            Row(
                              children: [
                                TextButton(
                                  onPressed: () => _setStatus(q['id'] as String, 'answered'),
                                  child: const Text('Answered', style: TextStyle(fontSize: 12)),
                                ),
                                TextButton(
                                  onPressed: () => _setStatus(q['id'] as String, 'dismissed'),
                                  child: Text('Dismiss',
                                      style: TextStyle(fontSize: 12, color: t.error)),
                                ),
                              ],
                            ),
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
