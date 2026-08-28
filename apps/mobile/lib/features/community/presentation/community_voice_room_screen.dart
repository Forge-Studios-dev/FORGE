import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';
import '../data/community_repository.dart';
import 'community_stage_raise_hand_panel.dart';

class CommunityVoiceRoomScreen extends ConsumerStatefulWidget {
  const CommunityVoiceRoomScreen({
    super.key,
    required this.communityId,
    required this.roomId,
  });

  final String communityId;
  final String roomId;

  @override
  ConsumerState<CommunityVoiceRoomScreen> createState() => _CommunityVoiceRoomScreenState();
}

class _CommunityVoiceRoomScreenState extends ConsumerState<CommunityVoiceRoomScreen> {
  Room? _room;
  String? _roomName;
  String? _roomType;
  bool _isHost = false;
  bool _canPublish = false;
  String? _error;
  bool _loading = true;
  bool _connecting = false;
  bool _joinInFlight = false;
  int _tokenGeneration = 0;

  @override
  void initState() {
    super.initState();
    _join();
  }

  @override
  void dispose() {
    _room?.disconnect();
    _room?.dispose();
    super.dispose();
  }

  String get _title {
    if (_roomType == 'stage') return 'Stage room';
    if (_roomType == 'breakout') return 'Breakout room';
    return 'Voice room';
  }

  Future<void> _join() async {
    // Reachable from initState, the Retry button, and a host-approval socket
    // event — without this guard two concurrent calls can each dispose
    // `_room` and race to reconnect, leaving it pointing at a connection the
    // other call already tore down.
    if (_joinInFlight) return;
    _joinInFlight = true;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(communityRepositoryProvider)
          .getVoiceRoomToken(widget.communityId, widget.roomId);
      if (data == null) throw Exception('No join payload');

      final roomName = data['roomName'] as String?;
      final roomType = data['roomType'] as String?;
      final token = data['token'] as String?;
      final url = data['livekitUrl'] as String?;
      final canPublish = data['canPublish'] as bool? ?? false;
      final isHost = data['isHost'] as bool? ?? false;
      if (token == null || url == null) throw Exception('Missing LiveKit credentials');

      await _room?.disconnect();
      _room?.dispose();

      final room = Room();
      await room.connect(
        url,
        token,
        roomOptions: const RoomOptions(adaptiveStream: true, dynacast: true),
      );
      if (canPublish) {
        await room.localParticipant?.setMicrophoneEnabled(true);
      } else {
        await room.localParticipant?.setMicrophoneEnabled(false);
      }
      if (!mounted) {
        await room.disconnect();
        room.dispose();
        return;
      }
      setState(() {
        _room = room;
        _roomName = roomName;
        _roomType = roomType;
        _canPublish = canPublish;
        _isHost = isHost;
        _loading = false;
        _tokenGeneration++;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not join voice room. Check membership and LiveKit config.';
          _loading = false;
        });
      }
    } finally {
      _joinInFlight = false;
    }
  }

  Future<void> _leave() async {
    await _room?.disconnect();
    _room?.dispose();
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final participants = _room?.remoteParticipants.values.toList() ?? [];
    final local = _room?.localParticipant;
    final isStage = _roomType == 'stage';

    return Scaffold(
      appBar: AppBar(
        title: Text(_roomName ?? _title),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Leave room',
          onPressed: _leave,
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _join, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _title,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      if (_roomName != null)
                        Text(
                          _roomName!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      const SizedBox(height: 12),
                      if (isStage)
                        CommunityStageRaiseHandPanel(
                          key: ValueKey('raise-hand-$_tokenGeneration'),
                          communityId: widget.communityId,
                          roomId: widget.roomId,
                          isHost: _isHost,
                          canPublish: _canPublish,
                          onSpeakerApproved: _join,
                          onCanPublishGranted: _join,
                        ),
                      Text(
                        '${participants.length + (local != null ? 1 : 0)} participant(s)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      if (local != null)
                        ListTile(
                          leading: Icon(
                            local.isMicrophoneEnabled() ? Icons.mic : Icons.mic_off,
                          ),
                          title: Text(local.identity),
                          subtitle: const Text('You'),
                        ),
                      Expanded(
                        child: ListView.builder(
                          itemCount: participants.length,
                          itemBuilder: (_, i) {
                            final p = participants[i];
                            return ListTile(
                              leading: Icon(
                                p.isMicrophoneEnabled() ? Icons.mic : Icons.mic_off,
                              ),
                              title: Text(p.identity),
                            );
                          },
                        ),
                      ),
                      if (_canPublish)
                        FilledButton.icon(
                          onPressed: _connecting
                              ? null
                              : () async {
                                  setState(() => _connecting = true);
                                  final enabled = local?.isMicrophoneEnabled() ?? false;
                                  await local?.setMicrophoneEnabled(!enabled);
                                  if (mounted) setState(() => _connecting = false);
                                },
                          icon: Icon(
                            (local?.isMicrophoneEnabled() ?? false) ? Icons.mic : Icons.mic_off,
                          ),
                          label: Text(
                            (local?.isMicrophoneEnabled() ?? false) ? 'Mute' : 'Unmute',
                          ),
                        ),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: _leave, child: const Text('Leave room')),
                    ],
                  ),
                ),
    );
  }
}
