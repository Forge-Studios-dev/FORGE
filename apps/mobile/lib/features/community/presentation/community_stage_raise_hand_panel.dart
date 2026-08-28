import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/observability/capture_error.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../data/community_repository.dart';

class CommunityStageRaiseHandPanel extends ConsumerStatefulWidget {
  const CommunityStageRaiseHandPanel({
    super.key,
    required this.communityId,
    required this.roomId,
    required this.isHost,
    required this.canPublish,
    this.onSpeakerApproved,
    this.onCanPublishGranted,
  });

  final String communityId;
  final String roomId;
  final bool isHost;
  final bool canPublish;
  final VoidCallback? onSpeakerApproved;
  final VoidCallback? onCanPublishGranted;

  @override
  ConsumerState<CommunityStageRaiseHandPanel> createState() =>
      _CommunityStageRaiseHandPanelState();
}

class _CommunityStageRaiseHandPanelState extends ConsumerState<CommunityStageRaiseHandPanel> {
  List<Map<String, dynamic>> _raisedHands = [];
  bool _handRaised = false;
  bool _busy = false;
  Timer? _offlinePollTimer;

  @override
  void initState() {
    super.initState();
    unawaited(_ensureConnected());
    if (widget.isHost) {
      unawaited(_pollRaisedHands());
    }
  }

  @override
  void didUpdateWidget(covariant CommunityStageRaiseHandPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isHost != widget.isHost ||
        oldWidget.canPublish != widget.canPublish ||
        oldWidget.roomId != widget.roomId) {
      unawaited(_ensureConnected());
      if (widget.isHost) {
        unawaited(_pollRaisedHands());
      }
    }
  }

  Future<void> _ensureConnected() async {
    await ForgeSocket.connect();
    if (!mounted) return;
    _bindSockets();
    _startOfflineFallback();
  }

  @override
  void dispose() {
    _offlinePollTimer?.cancel();
    ForgeSocket.off('room:raise-hand', _onRaiseHand);
    ForgeSocket.off('room:speaker:approved', _onSpeakerApproved);
    ForgeSocket.leaveRoom(widget.roomId);
    super.dispose();
  }

  void _bindSockets() {
    ForgeSocket.off('room:raise-hand', _onRaiseHand);
    ForgeSocket.off('room:speaker:approved', _onSpeakerApproved);
    ForgeSocket.joinRoom(widget.roomId);
    ForgeSocket.on('room:raise-hand', _onRaiseHand);
    ForgeSocket.on('room:speaker:approved', _onSpeakerApproved);
  }

  void _startOfflineFallback() {
    _offlinePollTimer?.cancel();
    // Socket-first: host list only polls when the socket is down.
    if (!widget.isHost) return;
    _offlinePollTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (ForgeSocket.isConnected) return;
      unawaited(_pollRaisedHands());
    });
  }

  void _onRaiseHand(dynamic raw) {
    final data = raw is Map ? raw.cast<String, dynamic>() : <String, dynamic>{};
    if (data['roomId'] != widget.roomId) return;
    if (widget.isHost) {
      unawaited(_pollRaisedHands());
    } else if (data['userId'] != null) {
      // Viewer only tracks own hand state from the event.
      final raised = data['raised'] == true;
      if (mounted) setState(() => _handRaised = raised);
    }
  }

  void _onSpeakerApproved(dynamic raw) {
    final data = raw is Map ? raw.cast<String, dynamic>() : <String, dynamic>{};
    if (data['roomId'] != widget.roomId) return;
    if (widget.isHost) {
      unawaited(_pollRaisedHands());
      widget.onSpeakerApproved?.call();
    } else {
      widget.onCanPublishGranted?.call();
    }
  }

  Future<void> _pollRaisedHands() async {
    if (!widget.isHost) return;
    try {
      final hands = await ref
          .read(communityRepositoryProvider)
          .getRaisedHands(widget.communityId, widget.roomId);
      if (!mounted) return;
      setState(() {
        _raisedHands = hands;
      });
    } catch (e, st) { captureError(e, st, 'pollRaisedHands'); }
  }

  Future<void> _toggleHand() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final repo = ref.read(communityRepositoryProvider);
      if (_handRaised) {
        await repo.lowerHand(widget.communityId, widget.roomId);
        if (mounted) setState(() => _handRaised = false);
      } else {
        await repo.raiseHand(widget.communityId, widget.roomId);
        if (mounted) setState(() => _handRaised = true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update raise hand')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approveSpeaker(String targetUserId) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(communityRepositoryProvider).approveSpeaker(
            widget.communityId,
            widget.roomId,
            targetUserId,
          );
      await _pollRaisedHands();
      widget.onSpeakerApproved?.call();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not approve speaker')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isHost) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(color: ForgeTokens.of(context).outline.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Raised hands',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ForgeTokens.of(context).outline),
            ),
            const SizedBox(height: 8),
            if (_raisedHands.isEmpty)
              Text(
                'No raised hands yet.',
                style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant),
              )
            else
              ..._raisedHands.map((hand) {
                final userId = hand['userId'] as String? ?? '';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          userId.length > 8 ? '${userId.substring(0, 8)}…' : userId,
                          style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                        ),
                      ),
                      TextButton(
                        onPressed: _busy ? null : () => _approveSpeaker(userId),
                        child: const Text('Invite to speak'),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      );
    }

    if (widget.canPublish) {
      return Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: Text(
          'You are approved to speak on stage.',
          style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ForgeButton(
        label: _handRaised ? 'Lower hand' : 'Raise hand to speak',
        primary: false,
        onPressed: _busy ? null : _toggleHand,
      ),
    );
  }
}
