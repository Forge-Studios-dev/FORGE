import 'dart:async';

import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import 'stream_chat_panel.dart';
import 'stream_poll_panel.dart';
import 'stream_qa_panel.dart';

class LiveWatchScreen extends ConsumerStatefulWidget {
  final String streamId;
  const LiveWatchScreen({super.key, required this.streamId});

  @override
  ConsumerState<LiveWatchScreen> createState() => _LiveWatchScreenState();
}

class _LiveWatchScreenState extends ConsumerState<LiveWatchScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? _stream;
  Map<String, dynamic>? _replay;
  Map<String, dynamic>? _health;
  Map<String, dynamic>? _rsvp;
  bool _loading = true;
  String? _error;
  int _viewerCount = 0;
  String? _myUserId;
  int _countdownMs = 0;
  Timer? _countdownTimer;
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  final Map<String, int> _reactionCounts = {};
  bool _handRaised = false;
  bool _raisingHand = false;

  void Function(dynamic)? _onViewerCount;
  void Function(dynamic)? _onChatMessage;
  void Function(dynamic)? _onStreamStarted;
  void Function(dynamic)? _onStreamEnded;
  void Function(dynamic)? _onReaction;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadStream();
    _setupSocket();
  }

  /// HIGH-08 (partial — video only): pause decoding/buffering when
  /// backgrounded. Not disconnecting ForgeSocket here: it's a global
  /// singleton also bound independently by StreamChatPanel/StreamPollPanel/
  /// StreamQaPanel with no shared reconnect coordination, so a forced
  /// disconnect+reconnect here would silently break their listeners after a
  /// background/foreground cycle. That needs a coordinated fix across all
  /// four widgets plus real-device verification, not a blind one-file patch.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _videoController?.pause();
    }
  }

  Future<void> _loadStream() async {
    try {
      final client = ref.read(apiClientProvider);
      final me = await client.dio.get('/users/me');
      _myUserId = me.data['data']?['id'] as String?;

      final response = await client.dio.get('/streams/${widget.streamId}');
      final stream = response.data['data'] as Map<String, dynamic>;

      Map<String, dynamic>? replay;
      if (stream['status'] == 'ended') {
        try {
          final replayRes = await client.dio.get('/streams/${widget.streamId}/replay');
          replay = replayRes.data['data'] as Map<String, dynamic>?;
        } catch (_) {}
      }

      Map<String, dynamic>? rsvp;
      if (stream['scheduledAt'] != null) {
        try {
          final rsvpRes = await client.dio.get('/streams/${widget.streamId}/rsvp');
          rsvp = rsvpRes.data['data'] as Map<String, dynamic>?;
        } catch (_) {}
      }

      Map<String, dynamic>? health;
      if (_myUserId != null && stream['userId'] == _myUserId) {
        try {
          final healthRes = await client.dio.get('/creators/me/streams/${widget.streamId}/health');
          health = healthRes.data['data'] as Map<String, dynamic>?;
        } catch (_) {}
      }

      setState(() {
        _stream = stream;
        _replay = replay;
        _rsvp = rsvp;
        _health = health;
        _loading = false;
        _viewerCount = stream['viewerCount'] as int? ?? 0;
      });

      _startCountdown(stream);
      await _initPlayer(stream);
    } catch (e) {
      setState(() {
        _error = 'Failed to load stream';
        _loading = false;
      });
    }
  }

  void _startCountdown(Map<String, dynamic> stream) {
    _countdownTimer?.cancel();
    final scheduledAt = stream['scheduledAt'] as String?;
    final status = stream['status'] as String? ?? 'idle';
    if (scheduledAt == null || status == 'live') return;
    final target = DateTime.parse(scheduledAt);
    void tick() {
      if (!mounted) return;
      setState(() => _countdownMs = target.difference(DateTime.now()).inMilliseconds);
    }
    tick();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  Future<void> _initPlayer(Map<String, dynamic> stream) async {
    await _videoController?.dispose();
    _chewieController?.dispose();
    _videoController = null;
    _chewieController = null;

    final playbackUrl = stream['playbackUrl'] as String?;
    final accessDenied = stream['accessDenied'] == true;
    if (playbackUrl != null && !accessDenied && stream['status'] == 'live') {
      _videoController = VideoPlayerController.networkUrl(Uri.parse(playbackUrl));
      await _videoController!.initialize();
      _chewieController = ChewieController(
        videoPlayerController: _videoController!,
        autoPlay: true,
        looping: false,
        aspectRatio: _videoController!.value.aspectRatio,
      );
      if (mounted) setState(() {});
    }
  }

  Future<void> _setupSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinStream(widget.streamId);
    ForgeSocket.joinStreamChat(widget.streamId);

    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/streams/${widget.streamId}/reactions');
      final counts = res.data['data'] as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _reactionCounts
            ..clear()
            ..addAll(counts.map((k, v) => MapEntry(k, (v as num).toInt())));
        });
      }
    } catch (_) {}

    _onViewerCount = (payload) {
      if (payload is Map && payload['streamId'] == widget.streamId && mounted) {
        setState(() => _viewerCount = payload['viewerCount'] as int? ?? _viewerCount);
      }
    };
    _onChatMessage = (_) {
      if (mounted) setState(() {});
    };
    _onStreamStarted = (payload) {
      if (payload is Map && payload['streamId'] == widget.streamId && mounted) {
        _loadStream();
      }
    };
    _onStreamEnded = (payload) {
      if (payload is Map && payload['streamId'] == widget.streamId && mounted) {
        _loadStream();
      }
    };
    _onReaction = (payload) {
      if (payload is! Map || payload['streamId'] != widget.streamId || !mounted) return;
      final reaction = payload['reaction'] as String?;
      final count = payload['count'] as int?;
      if (reaction == null || count == null) return;
      setState(() => _reactionCounts[reaction] = count);
    };

    ForgeSocket.on('stream:viewer-count', _onViewerCount!);
    ForgeSocket.on('stream:chat:message', _onChatMessage!);
    ForgeSocket.on('stream:started', _onStreamStarted!);
    ForgeSocket.on('stream:ended', _onStreamEnded!);
    ForgeSocket.on('stream:reaction', _onReaction!);
  }

  Future<void> _endStream() async {
    final client = ref.read(apiClientProvider);
    await client.dio.post('/streams/${widget.streamId}/end');
    await _loadStream();
  }

  Future<void> _acknowledgeAge() async {
    final client = ref.read(apiClientProvider);
    await client.dio.post('/users/me/mature-content/acknowledge');
    await _loadStream();
  }

  Future<void> _toggleRsvp() async {
    final client = ref.read(apiClientProvider);
    if (_rsvp?['hasRsvp'] == true) {
      await client.dio.post('/streams/${widget.streamId}/rsvp/cancel');
    } else {
      await client.dio.post('/streams/${widget.streamId}/rsvp');
    }
    await _loadStream();
  }

  Future<void> _toggleRaiseHand() async {
    if (_raisingHand) return;
    setState(() => _raisingHand = true);
    try {
      final client = ref.read(apiClientProvider);
      if (_handRaised) {
        await client.dio.delete('/streams/${widget.streamId}/raise-hand');
        setState(() => _handRaised = false);
      } else {
        await client.dio.post('/streams/${widget.streamId}/raise-hand');
        setState(() => _handRaised = true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update raise hand')),
        );
      }
    } finally {
      if (mounted) setState(() => _raisingHand = false);
    }
  }

  Widget _buildReactionBar() {
    const reactions = {'heart': '❤️', 'fire': '🔥', 'clap': '👏', '100': '💯'};
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ...reactions.entries.map((e) {
          final count = _reactionCounts[e.key] ?? 0;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Material(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(20),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => ForgeSocket.reactStream(widget.streamId, e.key),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Text(
                    count > 0 ? '${e.value} $count' : e.value,
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  String _formatCountdown(int ms) {
    if (ms <= 0) return 'Starting soon';
    final totalSec = ms ~/ 1000;
    final h = totalSec ~/ 3600;
    final m = (totalSec % 3600) ~/ 60;
    final s = totalSec % 60;
    if (h > 0) return '${h}h ${m}m ${s}s';
    if (m > 0) return '${m}m ${s}s';
    return '${s}s';
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    if (_onViewerCount != null) ForgeSocket.off('stream:viewer-count', _onViewerCount);
    if (_onChatMessage != null) ForgeSocket.off('stream:chat:message', _onChatMessage);
    if (_onStreamStarted != null) ForgeSocket.off('stream:started', _onStreamStarted);
    if (_onStreamEnded != null) ForgeSocket.off('stream:ended', _onStreamEnded);
    if (_onReaction != null) ForgeSocket.off('stream:reaction', _onReaction);
    ForgeSocket.leaveStream(widget.streamId);
    ForgeSocket.leaveStreamChat(widget.streamId);
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  bool get _isOwner =>
      _myUserId != null && _stream != null && _stream!['userId'] == _myUserId;

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
    final accessReason = _stream!['accessReason'] as String?;
    final title = _stream!['title'] as String? ?? 'Live';
    final status = _stream!['status'] as String? ?? 'idle';
    final scheduledAt = _stream!['scheduledAt'] as String?;
    final isScheduledFuture = scheduledAt != null &&
        status != 'live' &&
        DateTime.parse(scheduledAt).isAfter(DateTime.now());
    final hasReplay = _replay != null && _replay!['accessDenied'] != true;

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (_viewerCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(child: Text('$_viewerCount viewers')),
            ),
        ],
      ),
      body: Column(
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: accessDenied
                ? Container(
                    color: Colors.black87,
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _accessMessage(accessReason),
                            style: const TextStyle(color: Colors.white70),
                            textAlign: TextAlign.center,
                          ),
                          if (accessReason == 'age_confirmation_required') ...[
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: _acknowledgeAge,
                              child: const Text('I am 18 or older'),
                            ),
                          ],
                          if (accessReason == 'paid_event') ...[
                            const SizedBox(height: 12),
                            const Text(
                              'Contact the creator if you need access.',
                              style: TextStyle(color: Colors.white54, fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ],
                      ),
                    ),
                  )
                : isScheduledFuture
                    ? Container(
                        color: Colors.black87,
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('Scheduled session', style: TextStyle(color: Colors.white70)),
                              const SizedBox(height: 8),
                              Text(title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 12),
                              Text(
                                _formatCountdown(_countdownMs),
                                style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Starts ${DateTime.parse(scheduledAt).toLocal()}',
                                style: const TextStyle(color: Colors.white54),
                                textAlign: TextAlign.center,
                              ),
                              if (_rsvp?['rsvpCount'] != null && (_rsvp!['rsvpCount'] as int) > 0)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    '${_rsvp!['rsvpCount']} waiting',
                                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                                  ),
                                ),
                              if (_myUserId != null) ...[
                                const SizedBox(height: 12),
                                FilledButton(
                                  onPressed: _toggleRsvp,
                                  child: Text(_rsvp?['hasRsvp'] == true ? 'Cancel reminder' : 'Remind me'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      )
                    : _chewieController != null
                        ? Stack(
                            fit: StackFit.expand,
                            children: [
                              Chewie(controller: _chewieController!),
                              if (status == 'live')
                                Positioned(
                                  left: 8,
                                  right: 8,
                                  bottom: 8,
                                  child: _buildReactionBar(),
                                ),
                            ],
                          )
                        : Container(
                            color: Colors.black87,
                            padding: const EdgeInsets.all(16),
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    status == 'ended' ? 'Stream ended' : 'Waiting for broadcast…',
                                    style: const TextStyle(color: Colors.white70),
                                  ),
                                  if (status == 'ended' && hasReplay) ...[
                                    const SizedBox(height: 12),
                                    FilledButton(
                                      onPressed: () => context.push('/watch/${_replay!['id']}'),
                                      child: const Text('Watch replay'),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
          ),
          if (_isOwner && status != 'ended')
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_health != null) ...[
                    Text(
                      'Mux: ${_health!['muxStatus'] ?? '—'}${_health!['reconnecting'] == true ? ' (reconnecting)' : ''}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 4),
                  ],
                  Text('RTMP: ${_stream!['rtmpUrl'] ?? 'rtmps://global-live.mux.com:443/app'}'),
                  Text('Key: ${_stream!['streamKey'] ?? '—'}'),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _endStream, child: const Text('End stream')),
                ],
              ),
            ),
          StreamPollPanel(streamId: widget.streamId, isHost: _isOwner),
          StreamQaPanel(streamId: widget.streamId, isHost: _isOwner),
          if (!_isOwner && (_stream?['status'] as String?) == 'live' && _myUserId != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: OutlinedButton(
                onPressed: _raisingHand ? null : _toggleRaiseHand,
                child: Text(_handRaised ? 'Lower hand' : 'Raise hand'),
              ),
            ),
          if (_stream!['chatEnabled'] != false)
            Expanded(
              child: StreamChatPanel(
                streamId: widget.streamId,
                streamOwnerId: _stream!['userId'] as String?,
                chatEnabled: _stream!['chatEnabled'] != false,
                chatMode: (_stream!['chatMode'] as String?) ?? 'all',
              ),
            ),
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
      case 'paid_event':
        return 'This is a paid event. Access is granted by the creator or admin.';
      case 'age_confirmation_required':
        return 'Confirm you are 18 or older to watch.';
      case 'private':
        return 'This is a private stream.';
      default:
        return 'You cannot watch this stream.';
    }
  }
}
