import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../watch/data/watch_repository.dart';
import '../data/studio_repository.dart';

String _studioCommentHref(String videoId, String commentId) =>
    '/watch/$videoId?lc=${Uri.encodeComponent(commentId)}';

final studioCommentsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(studioRepositoryProvider).getRecentComments();
});

/// Studio comments inbox — pin / heart / reply / remove (YouTube Studio parity).
class StudioCommentsScreen extends ConsumerStatefulWidget {
  const StudioCommentsScreen({super.key});

  @override
  ConsumerState<StudioCommentsScreen> createState() => _StudioCommentsScreenState();
}

class _StudioCommentsScreenState extends ConsumerState<StudioCommentsScreen> {
  String? _replyingTo;
  final _replyCtrl = TextEditingController();
  final _searchCtrl = TextEditingController();
  String _query = '';
  String _filter = 'all'; // all | pinned | hearted
  bool _replyBusy = false;

  @override
  void dispose() {
    _replyCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _filtered(List<Map<String, dynamic>> comments) {
    final q = _query.trim().toLowerCase();
    return comments.where((c) {
      if (_filter == 'pinned' && c['isPinned'] != true) return false;
      if (_filter == 'hearted' && c['creatorHearted'] != true) return false;
      if (q.isEmpty) return true;
      final content = (c['content'] as String? ?? '').toLowerCase();
      final title = (c['videoTitle'] as String? ?? '').toLowerCase();
      final user = c['user'] as Map<String, dynamic>?;
      final username = (user?['username'] as String? ?? '').toLowerCase();
      final display = (user?['displayName'] as String? ?? '').toLowerCase();
      return content.contains(q) ||
          title.contains(q) ||
          username.contains(q) ||
          display.contains(q);
    }).toList();
  }

  Future<void> _pin(Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCommentPinned(videoId, id, isPinned: next);
    ref.invalidate(studioCommentsProvider);
  }

  Future<void> _heart(Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCreatorHeart(videoId, id, creatorHearted: next);
    ref.invalidate(studioCommentsProvider);
  }

  Future<void> _remove(Map<String, dynamic> c) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove comment?'),
        content: const Text('This removes the comment from your video.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(watchRepositoryProvider).deleteComment(videoId, id);
      if (_replyingTo == id) {
        setState(() {
          _replyingTo = null;
          _replyCtrl.clear();
        });
      }
      ref.invalidate(studioCommentsProvider);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove comment')),
      );
    }
  }

  Future<void> _postReply(Map<String, dynamic> c) async {
    final text = _replyCtrl.text.trim();
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (text.isEmpty || videoId == null || id == null || _replyBusy) return;
    setState(() => _replyBusy = true);
    try {
      await ref.read(watchRepositoryProvider).postComment(
            videoId,
            content: text,
            parentId: id,
          );
      _replyCtrl.clear();
      setState(() => _replyingTo = null);
      ref.invalidate(studioCommentsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reply posted')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not post reply')),
      );
    } finally {
      if (mounted) setState(() => _replyBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(studioCommentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Comments'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
        actions: [
          TextButton(
            onPressed: () => context.push('/studio/attention'),
            child: const Text('Attention'),
          ),
        ],
      ),
      body: commentsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load comments')),
        data: (comments) {
          if (comments.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  ForgeCard(
                    child: Text(
                      'When viewers comment on your videos, they will appear here.',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload video', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }

          final filtered = _filtered(comments);

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (v) => setState(() => _query = v),
                  decoration: InputDecoration(
                    hintText: 'Search comments',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                          ),
                    filled: true,
                    fillColor: ForgeTokens.of(context).surfaceContainerLow,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Wrap(
                  spacing: 8,
                  children: [
                    for (final f in const [
                      ('all', 'Published'),
                      ('pinned', 'Pinned'),
                      ('hearted', 'Hearted'),
                    ])
                      ChoiceChip(
                        label: Text(f.$2),
                        selected: _filter == f.$1,
                        onSelected: (_) => setState(() => _filter = f.$1),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          _query.isNotEmpty
                              ? 'No comments match "$_query"'
                              : 'No comments in this filter',
                          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(20),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) {
                          final c = filtered[i];
                          final user = c['user'] as Map<String, dynamic>?;
                          final pinned = c['isPinned'] == true;
                          final hearted = c['creatorHearted'] == true;
                          final id = c['id'] as String?;
                          final videoId = c['videoId'] as String?;
                          final isShort = c['videoType'] == 'short';
                          final commentHref = (videoId != null && id != null)
                              ? _studioCommentHref(videoId, id)
                              : null;
                          final replying = id != null && _replyingTo == id;
                          final t = ForgeTokens.of(context);

                          return ForgeCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                InkWell(
                                  onTap: commentHref == null
                                      ? null
                                      : () => context.push(commentHref),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (pinned)
                                        Text(
                                          'Pinned',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: t.onSurfaceVariant,
                                          ),
                                        ),
                                      if (isShort)
                                        Text(
                                          'Short',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: t.onSurfaceVariant,
                                          ),
                                        ),
                                      Text(
                                        c['videoTitle'] as String? ?? 'Video',
                                        style: TextStyle(fontSize: 12, color: t.primary),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        c['content'] as String? ?? '',
                                        style: TextStyle(color: t.onSurface),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        '@${user?['username'] ?? 'user'}',
                                        style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 4,
                                  children: [
                                    if (c['parentId'] == null)
                                      TextButton(
                                        onPressed: () async {
                                          try {
                                            await _pin(c, !pinned);
                                          } catch (_) {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(content: Text('Could not update pin')),
                                              );
                                            }
                                          }
                                        },
                                        child: Text(pinned ? 'Unpin' : 'Pin'),
                                      ),
                                    TextButton(
                                      onPressed: () async {
                                        try {
                                          await _heart(c, !hearted);
                                        } catch (_) {
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(content: Text('Could not update heart')),
                                            );
                                          }
                                        }
                                      },
                                      child: Text(hearted ? 'Remove heart' : 'Heart'),
                                    ),
                                    TextButton(
                                      onPressed: () => _remove(c),
                                      child: Text('Remove', style: TextStyle(color: t.error)),
                                    ),
                                    TextButton(
                                      onPressed: id == null
                                          ? null
                                          : () => setState(() {
                                                if (replying) {
                                                  _replyingTo = null;
                                                  _replyCtrl.clear();
                                                } else {
                                                  _replyingTo = id;
                                                  _replyCtrl.clear();
                                                }
                                              }),
                                      child: Text(replying ? 'Cancel' : 'Reply'),
                                    ),
                                    TextButton(
                                      onPressed: commentHref == null
                                          ? null
                                          : () => context.push(commentHref),
                                      child: const Text('View comment'),
                                    ),
                                  ],
                                ),
                                if (replying) ...[
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _replyCtrl,
                                    maxLines: 3,
                                    decoration: const InputDecoration(
                                      hintText: 'Write a helpful reply…',
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: ForgeButton(
                                      label: _replyBusy ? 'Posting…' : 'Post reply',
                                      onPressed: _replyBusy ? null : () => _postReply(c),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
