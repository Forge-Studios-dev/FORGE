import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';

class LiveScreen extends ConsumerStatefulWidget {
  const LiveScreen({super.key});

  @override
  ConsumerState<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends ConsumerState<LiveScreen> {
  List<Map<String, dynamic>> _streams = [];
  bool _loading = true;

  void Function(dynamic)? _onStreamStarted;
  void Function(dynamic)? _onStreamEnded;

  @override
  void initState() {
    super.initState();
    _load();
    _bindSocket();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/streams/live');
      final data = response.data['data'] as List;
      if (mounted) {
        setState(() {
          _streams = data.cast<Map<String, dynamic>>();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _bindSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinLiveFeed();
    _onStreamStarted = (_) => _load();
    _onStreamEnded = (_) => _load();
    ForgeSocket.on('stream:started', _onStreamStarted!);
    ForgeSocket.on('stream:ended', _onStreamEnded!);
  }

  @override
  void dispose() {
    if (_onStreamStarted != null) ForgeSocket.off('stream:started', _onStreamStarted);
    if (_onStreamEnded != null) ForgeSocket.off('stream:ended', _onStreamEnded);
    ForgeSocket.leaveLiveFeed();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _streams.isEmpty
              ? Center(
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
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _streams.length,
                  itemBuilder: (context, index) => _StreamCard(stream: _streams[index]),
                ),
    );
  }

  void _showGoLiveDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Go Live'),
        content: const Text('Use Studio on web to start a live stream with Mux.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
        ],
      ),
    );
  }
}

class _StreamCard extends StatelessWidget {
  final Map<String, dynamic> stream;
  const _StreamCard({required this.stream});

  @override
  Widget build(BuildContext context) {
    final title = stream['title'] as String? ?? 'Live';
    final viewerCount = stream['viewerCount'] as int? ?? 0;
    final thumb = stream['thumbnailUrl'] as String?;
    final id = stream['id'] as String?;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: id != null ? () => context.push('/live/$id') : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: thumb != null
                  ? CachedNetworkImage(imageUrl: thumb, fit: BoxFit.cover, width: double.infinity)
                  : Container(color: ForgeTokens.surfaceContainerHigh, child: const Icon(Icons.live_tv, size: 48)),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text('$viewerCount watching', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                    child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
