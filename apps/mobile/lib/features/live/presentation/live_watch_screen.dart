import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import 'stream_chat_panel.dart';

class LiveWatchScreen extends ConsumerStatefulWidget {
  final String streamId;
  const LiveWatchScreen({super.key, required this.streamId});

  @override
  ConsumerState<LiveWatchScreen> createState() => _LiveWatchScreenState();
}

class _LiveWatchScreenState extends ConsumerState<LiveWatchScreen> {
  Map<String, dynamic>? _stream;
  bool _loading = true;
  String? _error;
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    _loadStream();
    _setupSocket();
  }

  Future<void> _loadStream() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/streams/${widget.streamId}');
      final stream = response.data['data'] as Map<String, dynamic>;
      setState(() {
        _stream = stream;
        _loading = false;
      });

      final playbackUrl = stream['playbackUrl'] as String?;
      final accessDenied = stream['accessDenied'] == true;
      if (playbackUrl != null && !accessDenied) {
        _videoController = VideoPlayerController.networkUrl(Uri.parse(playbackUrl));
        await _videoController!.initialize();
        _chewieController = ChewieController(
          videoPlayerController: _videoController!,
          autoPlay: true,
          looping: false,
          aspectRatio: _videoController!.value.aspectRatio,
        );
        setState(() {});
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load stream';
        _loading = false;
      });
    }
  }

  Future<void> _setupSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinStreamChat(widget.streamId);
    ForgeSocket.on('stream:chat:message', (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    ForgeSocket.leaveStreamChat(widget.streamId);
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null || _stream == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Live')),
        body: Center(child: Text(_error ?? 'Stream unavailable')),
      );
    }

    final accessDenied = _stream!['accessDenied'] == true;
    final title = _stream!['title'] as String? ?? 'Live';

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: accessDenied
                ? Container(
                    color: Colors.black87,
                    child: Center(
                      child: Text(
                        _accessMessage(_stream!['accessReason'] as String?),
                        style: const TextStyle(color: Colors.white70),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : _chewieController != null
                    ? Chewie(controller: _chewieController!)
                    : Container(
                        color: Colors.black87,
                        child: const Center(
                          child: Text('Waiting for broadcast…', style: TextStyle(color: Colors.white70)),
                        ),
                      ),
          ),
          if (_stream!['chatEnabled'] != false)
            Expanded(child: StreamChatPanel(streamId: widget.streamId)),
        ],
      ),
    );
  }

  String _accessMessage(String? reason) {
    switch (reason) {
      case 'login_required':
        return 'Sign in to watch this stream.';
      case 'follow_required':
        return 'Follow this creator to watch.';
      case 'subscription_required':
        return 'Membership required.';
      case 'tier_required':
        return 'Higher tier membership required.';
      default:
        return 'You cannot watch this stream.';
    }
  }
}
