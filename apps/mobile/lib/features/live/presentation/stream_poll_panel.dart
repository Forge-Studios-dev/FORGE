import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/observability/capture_error.dart';
import '../../../core/socket/forge_socket.dart';

class StreamPollPanel extends ConsumerStatefulWidget {
  final String streamId;
  final bool isHost;
  const StreamPollPanel({super.key, required this.streamId, this.isHost = false});

  @override
  ConsumerState<StreamPollPanel> createState() => _StreamPollPanelState();
}

class _StreamPollPanelState extends ConsumerState<StreamPollPanel> {
  Map<String, dynamic>? _poll;
  bool _loading = true;
  bool _showCreate = false;
  final _questionCtrl = TextEditingController();
  final _optionCtrls = [TextEditingController(), TextEditingController()];
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPoll();
    ForgeSocket.on('stream:poll:updated', _onPollUpdated);
  }

  void _onPollUpdated(dynamic payload) {
    if (payload is! Map || payload['streamId'] != widget.streamId) return;
    if (!mounted) return;
    final poll = payload['poll'];
    setState(() {
      _poll = poll is Map ? Map<String, dynamic>.from(poll) : null;
      _loading = false;
    });
  }

  Future<void> _loadPoll() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/streams/${widget.streamId}/poll');
      if (!mounted) return;
      setState(() {
        _poll = res.data['data'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e, st) {
      captureError(e, st, 'loadPoll');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _vote(int index) async {
    if (_poll == null) return;
    try {
      await ref.read(apiClientProvider).dio.post(
            '/streams/${widget.streamId}/polls/${_poll!['id']}/vote',
            data: {'optionIndex': index},
          );
      await _loadPoll();
    } catch (e, st) { captureError(e, st, 'votePoll'); }
  }

  Future<void> _createPoll() async {
    final question = _questionCtrl.text.trim();
    final options = _optionCtrls.map((c) => c.text.trim()).where((o) => o.isNotEmpty).toList();
    if (question.isEmpty || options.length < 2) return;
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).dio.post(
            '/streams/${widget.streamId}/polls',
            data: {'question': question, 'options': options},
          );
      _questionCtrl.clear();
      for (final c in _optionCtrls) {
        c.clear();
      }
      setState(() => _showCreate = false);
      await _loadPoll();
    } catch (e, st) {
      captureError(e, st, 'createPoll');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _closePoll() async {
    if (_poll == null) return;
    try {
      await ref.read(apiClientProvider).dio.post(
            '/streams/${widget.streamId}/polls/${_poll!['id']}/close',
          );
      await _loadPoll();
    } catch (e, st) { captureError(e, st, 'closePoll'); }
  }

  @override
  void dispose() {
    ForgeSocket.off('stream:poll:updated', _onPollUpdated);
    _questionCtrl.dispose();
    for (final c in _optionCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();

    if (widget.isHost && (_poll == null || _poll!['isActive'] != true) && !_showCreate) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: OutlinedButton(onPressed: () => setState(() => _showCreate = true), child: const Text('Create poll')),
      );
    }

    if (widget.isHost && _showCreate && (_poll == null || _poll!['isActive'] != true)) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(controller: _questionCtrl, decoration: const InputDecoration(labelText: 'Question')),
            const SizedBox(height: 8),
            for (var i = 0; i < _optionCtrls.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TextField(
                  controller: _optionCtrls[i],
                  decoration: InputDecoration(labelText: 'Option ${i + 1}'),
                ),
              ),
            Row(
              children: [
                TextButton(
                  onPressed: _submitting ? null : _createPoll,
                  child: Text(_submitting ? 'Creating…' : 'Start poll'),
                ),
                TextButton(onPressed: () => setState(() => _showCreate = false), child: const Text('Cancel')),
              ],
            ),
          ],
        ),
      );
    }

    if (_poll == null || _poll!['isActive'] != true) return const SizedBox.shrink();

    final options = (_poll!['options'] as List?)?.cast<String>() ?? [];
    final counts = (_poll!['counts'] as List?)?.cast<int>() ?? List.filled(options.length, 0);
    final total = counts.fold<int>(0, (a, b) => a + b);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(_poll!['question'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
              if (widget.isHost)
                TextButton(onPressed: _closePoll, child: const Text('Close', style: TextStyle(color: Colors.redAccent))),
            ],
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < options.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                onTap: widget.isHost ? null : () => _vote(i),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white24),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(child: Text(options[i])),
                      Text(total > 0 ? '${((counts[i] / total) * 100).round()}%' : '0%'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
