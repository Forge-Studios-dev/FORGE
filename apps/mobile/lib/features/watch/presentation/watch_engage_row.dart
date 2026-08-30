import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../shared/models/video.dart';
import '../data/watch_repository.dart';
import 'save_to_playlist_sheet.dart';
import 'watch_screen.dart';

class WatchEngageRow extends ConsumerStatefulWidget {
  final VideoModel video;
  const WatchEngageRow({super.key, required this.video});

  @override
  ConsumerState<WatchEngageRow> createState() => _WatchEngageRowState();
}

class _WatchEngageRowState extends ConsumerState<WatchEngageRow> {
  late bool _liked;
  late bool _disliked;
  late int _likeCount;
  late bool _subscribed;
  bool _inWatchLater = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _liked = widget.video.viewerLiked;
    _disliked = widget.video.viewerDisliked;
    _likeCount = widget.video.likeCount;
    _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
    _loadWatchLater();
  }

  @override
  void didUpdateWidget(covariant WatchEngageRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.id != widget.video.id) {
      _liked = widget.video.viewerLiked;
      _disliked = widget.video.viewerDisliked;
      _likeCount = widget.video.likeCount;
      _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
      _inWatchLater = false;
      _loadWatchLater();
    }
  }

  Future<void> _loadWatchLater() async {
    try {
      final inList = await ref.read(watchRepositoryProvider).isInWatchLater(widget.video.id);
      if (mounted) setState(() => _inWatchLater = inList);
    } catch (_) {}
  }

  Future<void> _toggleWatchLater() async {
    if (_busy) return;
    final next = !_inWatchLater;
    setState(() {
      _busy = true;
      _inWatchLater = next;
    });
    try {
      final repo = ref.read(watchRepositoryProvider);
      if (next) {
        await repo.addToWatchLater(widget.video.id);
      } else {
        await repo.removeFromWatchLater(widget.video.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next ? 'Saved to Watch later' : 'Removed from Watch later')),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _inWatchLater = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to use Watch later')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share() async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final base = '${AppConstants.webBaseUrl}/watch/${widget.video.id}';
    final url = pos > 0 ? '$base?t=$pos' : base;
    await SharePlus.instance.share(ShareParams(text: '${widget.video.title}\n$url'));
    unawaited(ref.read(watchRepositoryProvider).recordShare(widget.video.id));
  }

  Future<void> _copyWatchLink({bool atTime = false}) async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final base = '${AppConstants.webBaseUrl}/watch/${widget.video.id}';
    final url = atTime && pos > 0 ? '$base?t=$pos' : base;
    await Clipboard.setData(ClipboardData(text: url));
    unawaited(
      ref.read(watchRepositoryProvider).recordShare(widget.video.id, channel: 'copy_link'),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(atTime && pos > 0 ? 'Link at $pos s copied' : 'Link copied')),
    );
  }

  Future<void> _copyEmbed() async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final src = pos > 0
        ? '${AppConstants.webBaseUrl}/embed/${widget.video.id}?t=$pos'
        : '${AppConstants.webBaseUrl}/embed/${widget.video.id}';
    final title = widget.video.title.replaceAll('"', '');
    final snippet =
        '<iframe width="560" height="315" src="$src" title="$title" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    await Clipboard.setData(ClipboardData(text: snippet));
    unawaited(
      ref.read(watchRepositoryProvider).recordShare(widget.video.id, channel: 'embed'),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(pos > 0 ? 'Embed code copied at current time' : 'Embed code copied')),
    );
  }

  Future<void> _notInterested() async {
    try {
      await ref.read(watchRepositoryProvider).markNotInterested(widget.video.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('We\'ll show fewer videos like this')),
        );
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preferences')),
        );
      }
    }
  }

  Future<void> _dontRecommendChannel() async {
    try {
      await ref.read(watchRepositoryProvider).dontRecommendChannel(widget.video.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Channel won\'t be recommended')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preferences')),
        );
      }
    }
  }

  Future<void> _blockCreator() async {
    final userId = widget.video.user.id;
    if (userId.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Block ${widget.video.user.displayName}?'),
        content: const Text(
          'They won’t be able to message you. Their comments will be hidden, and their channel won’t be recommended.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Block')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(watchRepositoryProvider).blockUser(userId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User blocked')),
      );
      context.go('/');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to block users')),
        );
      }
    }
  }

  Future<void> _openSaveToPlaylist() async {
    await showSaveToPlaylistSheet(
      context: context,
      ref: ref,
      videoId: widget.video.id,
    );
  }

  Future<void> _toggleLike() async {
    if (_busy) return;
    final next = !_liked;
    final wasDisliked = _disliked;
    setState(() {
      _busy = true;
      _liked = next;
      _likeCount = (_likeCount + (next ? 1 : -1)).clamp(0, 1 << 30);
      if (next) _disliked = false;
    });
    try {
      await ref.read(watchRepositoryProvider).setVideoLiked(widget.video.id, liked: next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _liked = !next;
          _likeCount = (_likeCount + (next ? -1 : 1)).clamp(0, 1 << 30);
          _disliked = wasDisliked;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update like')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleDislike() async {
    if (_busy) return;
    final next = !_disliked;
    final wasLiked = _liked;
    final prevCount = _likeCount;
    setState(() {
      _busy = true;
      _disliked = next;
      if (next && _liked) {
        _liked = false;
        _likeCount = (_likeCount - 1).clamp(0, 1 << 30);
      }
    });
    try {
      await ref.read(watchRepositoryProvider).setVideoDisliked(widget.video.id, disliked: next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _disliked = !next;
          _liked = wasLiked;
          _likeCount = prevCount;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update dislike')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleSubscribe() async {
    if (_busy || widget.video.user.id.isEmpty) return;
    final next = !_subscribed;
    setState(() {
      _busy = true;
      _subscribed = next;
    });
    try {
      await ref.read(watchRepositoryProvider).setSubscribed(
            widget.video.user.id,
            subscribed: next,
          );
    } catch (_) {
      if (mounted) {
        setState(() => _subscribed = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update subscription')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setNotify(String level) async {
    if (widget.video.user.id.isEmpty) return;
    try {
      await ref.read(watchRepositoryProvider).setNotifyLevel(
            widget.video.user.id,
            notifyLevel: level,
          );
      if (mounted) {
        final label = switch (level) {
          'all' => 'All notifications',
          'personalized' => 'Personalized',
          _ => 'None',
        };
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(label)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update notifications')),
        );
      }
    }
  }

  Future<void> _openSuperThanks() async {
    const presets = [100, 200, 500, 1000, 2000];
    int selected = 200;
    final messageCtrl = TextEditingController();
    var sending = false;
    String? hint;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Super Thanks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 8),
                  Text(
                    'Send Super Thanks to ${widget.video.user.displayName} (USD).',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: presets
                        .map(
                          (cents) => ChoiceChip(
                            label: Text('\$${(cents / 100).toStringAsFixed(0)}'),
                            selected: selected == cents,
                            onSelected: sending
                                ? null
                                : (_) => setLocal(() => selected = cents),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: messageCtrl,
                    maxLength: 200,
                    enabled: !sending,
                    decoration: const InputDecoration(
                      hintText: 'Optional message…',
                      isDense: true,
                    ),
                  ),
                  if (hint != null) ...[
                    const SizedBox(height: 8),
                    Text(hint!, style: TextStyle(color: ForgeTokens.of(context).warning)),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: sending
                        ? null
                        : () async {
                            setLocal(() {
                              sending = true;
                              hint = null;
                            });
                            try {
                              final payload = await ref.read(watchRepositoryProvider).sendSuperThanks(
                                    videoId: widget.video.id,
                                    amountCents: selected,
                                    body: messageCtrl.text.trim(),
                                  );
                              final checkoutUrl = payload['checkoutUrl'] as String?;
                              final requiresCheckout = payload['requiresCheckout'] == true;
                              if (requiresCheckout && checkoutUrl != null && checkoutUrl.isNotEmpty) {
                                await launchUrl(
                                  Uri.parse(checkoutUrl),
                                  mode: LaunchMode.externalApplication,
                                );
                                if (ctx.mounted) Navigator.pop(ctx);
                                return;
                              }
                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Thanks sent!')),
                                );
                              }
                            } catch (_) {
                              setLocal(() {
                                sending = false;
                                hint = 'Could not send Super Thanks';
                              });
                            }
                          },
                    child: Text(sending ? 'Sending…' : 'Send \$${(selected / 100).toStringAsFixed(0)}'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    messageCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Wrapped in a horizontal SingleChildScrollView: ~8 action buttons plus
    // the subscribe control overflow a plain unscrollable Row on real phone
    // widths (~360-430dp) — confirmed via a RenderFlex overflow, not just a
    // narrow-test-viewport artifact.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
        FilledButton.tonalIcon(
          onPressed: _busy ? null : _toggleLike,
          icon: Icon(_liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18),
          label: Text(_likeCount > 0 ? '$_likeCount' : 'Like'),
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _toggleDislike,
          icon: Icon(_disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18),
          tooltip: _disliked ? 'Remove dislike' : 'Dislike',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _openSuperThanks,
          icon: const Icon(Icons.volunteer_activism_outlined, size: 18),
          tooltip: 'Super Thanks',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _toggleWatchLater,
          icon: Icon(_inWatchLater ? Icons.watch_later : Icons.watch_later_outlined, size: 18),
          tooltip: _inWatchLater ? 'Remove from Watch later' : 'Save to Watch later',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _openSaveToPlaylist,
          icon: const Icon(Icons.playlist_add, size: 18),
          tooltip: 'Save to playlist',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _share,
          icon: const Icon(Icons.share_outlined, size: 18),
          tooltip: 'Share',
        ),
        PopupMenuButton<String>(
          tooltip: 'Copy link',
          onSelected: (value) {
            if (value == 'link') _copyWatchLink();
            if (value == 'time') _copyWatchLink(atTime: true);
            if (value == 'embed') _copyEmbed();
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'link', child: Text('Copy link')),
            PopupMenuItem(value: 'time', child: Text('Copy link at current time')),
            PopupMenuItem(value: 'embed', child: Text('Copy embed code')),
          ],
          icon: const Icon(Icons.link, size: 20),
        ),
        const SizedBox(width: 8),
        PopupMenuButton<String>(
          tooltip: 'More',
          onSelected: (value) {
            if (value == 'not_interested') _notInterested();
            if (value == 'dont_recommend') _dontRecommendChannel();
            if (value == 'block') _blockCreator();
          },
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'not_interested', child: Text('Not interested')),
            const PopupMenuItem(value: 'dont_recommend', child: Text("Don't recommend channel")),
            if (widget.video.user.id.isNotEmpty)
              const PopupMenuItem(value: 'block', child: Text('Block user')),
          ],
          icon: const Icon(Icons.more_vert, size: 20),
        ),
        const SizedBox(width: 8),
        if (widget.video.user.id.isNotEmpty)
          _subscribed
              ? PopupMenuButton<String>(
                  tooltip: 'Subscription options',
                  onSelected: (value) async {
                    if (value == 'unsubscribe') {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Unsubscribe?'),
                          content: const Text(
                            'You will stop receiving updates from this channel.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Cancel'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text('Unsubscribe'),
                            ),
                          ],
                        ),
                      );
                      if (ok == true) await _toggleSubscribe();
                    } else {
                      await _setNotify(value);
                    }
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'all', child: Text('All')),
                    PopupMenuItem(value: 'personalized', child: Text('Personalized')),
                    PopupMenuItem(value: 'none', child: Text('None')),
                    PopupMenuDivider(),
                    PopupMenuItem(value: 'unsubscribe', child: Text('Unsubscribe')),
                  ],
                  child: Material(
                    color: ForgeTokens.of(context).surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(20),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.notifications_active, size: 18),
                          SizedBox(width: 6),
                          Text('Subscribed'),
                          SizedBox(width: 2),
                          Icon(Icons.arrow_drop_down, size: 18),
                        ],
                      ),
                    ),
                  ),
                )
              : FilledButton(
                  onPressed: _busy ? null : _toggleSubscribe,
                  style: FilledButton.styleFrom(
                    backgroundColor: ForgeTokens.of(context).onSurface,
                    foregroundColor: ForgeTokens.of(context).background,
                  ),
                  child: const Text('Subscribe'),
                ),
            ],
          ),
        ),
        if (widget.video.user.username.isNotEmpty) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.push('/profile/${widget.video.user.username}'),
            child: Text(widget.video.user.displayName),
          ),
        ],
      ],
    );
  }
}
