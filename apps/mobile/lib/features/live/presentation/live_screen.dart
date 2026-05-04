import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/network/api_client.dart';

final liveStreamsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/streams/live');
  final data = response.data['data'] as List;
  return data.cast<Map<String, dynamic>>();
});

class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streamsAsync = ref.watch(liveStreamsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Now'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () => _showGoLiveDialog(context),
          ),
        ],
      ),
      body: streamsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load streams')),
        data: (streams) {
          if (streams.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.live_tv, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No live streams right now', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => _showGoLiveDialog(context),
                    icon: const Icon(Icons.stream),
                    label: const Text('Go Live'),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: streams.length,
            itemBuilder: (context, index) {
              final stream = streams[index];
              return _StreamCard(stream: stream);
            },
          );
        },
      ),
    );
  }

  void _showGoLiveDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1A1A24),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _GoLiveSheet(),
    );
  }
}

class _StreamCard extends StatelessWidget {
  final Map<String, dynamic> stream;
  const _StreamCard({required this.stream});

  @override
  Widget build(BuildContext context) {
    final user = stream['user'] as Map<String, dynamic>?;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A24),
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: stream['thumbnailUrl'] != null
                ? CachedNetworkImage(imageUrl: stream['thumbnailUrl'] as String, fit: BoxFit.cover)
                : Container(
                    color: const Color(0xFF0A0A0F),
                    child: const Icon(Icons.live_tv, color: Colors.grey, size: 48),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: const Color(0xFF4F6EF7),
                  child: Text((user?['displayName'] as String? ?? 'U')[0],
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(stream['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(user?['displayName'] as String? ?? '', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GoLiveSheet extends ConsumerStatefulWidget {
  const _GoLiveSheet();

  @override
  ConsumerState<_GoLiveSheet> createState() => _GoLiveSheetState();
}

class _GoLiveSheetState extends ConsumerState<_GoLiveSheet> {
  final _titleCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _startStream() async {
    if (_titleCtrl.text.isEmpty) return;
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/streams/start', data: {'title': _titleCtrl.text.trim()});
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to start stream')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Go Live', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(labelText: 'Stream title', hintText: 'What are you teaching today?'),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _loading ? null : _startStream,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: _loading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Start Streaming'),
          ),
        ],
      ),
    );
  }
}
