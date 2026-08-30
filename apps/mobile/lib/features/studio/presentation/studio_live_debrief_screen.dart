import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioLiveDebriefScreen extends ConsumerStatefulWidget {
  final String streamId;

  const StudioLiveDebriefScreen({super.key, required this.streamId});

  @override
  ConsumerState<StudioLiveDebriefScreen> createState() => _StudioLiveDebriefScreenState();
}

class _StudioLiveDebriefScreenState extends ConsumerState<StudioLiveDebriefScreen> {
  Map<String, dynamic>? _stream;
  Map<String, dynamic>? _analytics;
  Map<String, dynamic>? _replay;
  String? _summary;
  String? _error;
  bool _loading = true;
  bool _summaryLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final streamRes = await client.dio.get('/streams/${widget.streamId}');
      final stream = (streamRes.data['data'] as Map<String, dynamic>?) ?? {};
      Map<String, dynamic>? analytics;
      Map<String, dynamic>? replay;
      try {
        final analyticsRes =
            await client.dio.get('/creators/me/streams/${widget.streamId}/analytics');
        analytics = analyticsRes.data['data'] as Map<String, dynamic>?;
      } catch (_) {}
      try {
        final replayRes = await client.dio.get('/streams/${widget.streamId}/replay');
        replay = replayRes.data['data'] as Map<String, dynamic>?;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _stream = stream;
        _analytics = analytics;
        _replay = replay;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load debrief.';
        _loading = false;
      });
    }
  }

  Future<void> _loadSummary() async {
    setState(() => _summaryLoading = true);
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/streams/${widget.streamId}/ai-summary');
      final payload = res.data['data'] as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        _summary = payload['summary'] as String? ?? '';
        _summaryLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not generate AI summary.';
        _summaryLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = _stream?['title'] as String? ?? 'Post-stream debrief';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stream debrief'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.go('/studio/live'),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: ForgeTokens.of(context).onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Review metrics, replay, and an AI summary for this session.',
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, height: 1.4),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                ],
                const SizedBox(height: 20),
                if (_analytics != null) ...[
                  Text(
                    'Session metrics',
                    style: TextStyle(fontWeight: FontWeight.w700, color: ForgeTokens.of(context).onSurface),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _metric('Peak', '${_analytics!['peakViewers'] ?? 0}'),
                      _metric('Avg', '${_analytics!['avgViewers'] ?? 0}'),
                      _metric('Unique', '${_analytics!['uniqueViewers'] ?? 0}'),
                      _metric('Chat', '${_analytics!['totalChatMessages'] ?? 0}'),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
                if (_replay != null && _replay!['id'] != null) ...[
                  ForgeCard(
                    onTap: () => context.push('/watch/${_replay!['id']}'),
                    child: Row(
                      children: [
                        Icon(Icons.replay, color: ForgeTokens.of(context).primary),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Open replay VOD',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                ForgeButton(
                  label: _summaryLoading ? 'Generating…' : 'Generate AI summary',
                  onPressed: _summaryLoading ? null : _loadSummary,
                ),
                if (_summary != null && _summary!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  ForgeCard(
                    child: Text(
                      _summary!,
                      style: TextStyle(height: 1.45, color: ForgeTokens.of(context).onSurface),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                TextButton(
                  onPressed: () => context.go('/studio/live'),
                  child: const Text('Back to Live setup'),
                ),
              ],
            ),
    );
  }

  Widget _metric(String label, String value) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ForgeTokens.of(context).surfaceContainerHigh,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant)),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: ForgeTokens.of(context).onSurface,
            ),
          ),
        ],
      ),
    );
  }
}
