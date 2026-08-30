import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../watch/data/watch_repository.dart';
import '../data/studio_repository.dart';

String _studioCommentHref(String videoId, String commentId) =>
    '/watch/$videoId?lc=${Uri.encodeComponent(commentId)}';

/// Studio comments inbox — pin / heart / reply / remove / held release (YouTube Studio parity).
class StudioCommentsScreen extends ConsumerStatefulWidget {
  const StudioCommentsScreen({super.key, this.initialFilter, this.initialQuery});

  /// Optional deep-link filter (`held` | `pinned` | `hearted` | `all`).
  final String? initialFilter;

  /// Optional deep-link search (`?q=`).
  final String? initialQuery;

  @override
  ConsumerState<StudioCommentsScreen> createState() => _StudioCommentsScreenState();
}

class _StudioCommentsScreenState extends ConsumerState<StudioCommentsScreen> {
  String? _replyingTo;
  final _replyCtrl = TextEditingController();
  final _searchCtrl = TextEditingController();
  late String _query;
  late String _debouncedQuery;
  Timer? _searchDebounce;
  late String _filter; // all | held | pinned | hearted
  bool _replyBusy = false;
  bool _releaseBusy = false;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasError = false;
  final List<Map<String, dynamic>> _comments = [];
  String? _nextCursor;
  bool _hasMore = false;

  static const _validFilters = {'all', 'held', 'pinned', 'hearted'};

  @override
  void initState() {
    super.initState();
    final f = widget.initialFilter;
    _filter = f != null && _validFilters.contains(f) ? f : 'all';
    final q = widget.initialQuery?.trim() ?? '';
    _query = q.length >= 2 ? q : '';
    _debouncedQuery = _query;
    if (_query.isNotEmpty) _searchCtrl.text = _query;
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _replyCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _hasError = false;
      _comments.clear();
      _nextCursor = null;
      _hasMore = false;
    });
    try {
      final page = await ref.read(studioRepositoryProvider).getStudioComments(
            filter: _filter,
            q: _debouncedQuery.length >= 2 ? _debouncedQuery : null,
            limit: 40,
          );
      if (!mounted) return;
      setState(() {
        _comments
          ..clear()
          ..addAll(page.items);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _hasError = true;
      });
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await ref.read(studioRepositoryProvider).getStudioComments(
            filter: _filter,
            q: _debouncedQuery.length >= 2 ? _debouncedQuery : null,
            limit: 40,
            cursor: _nextCursor,
          );
      if (!mounted) return;
      setState(() {
        _comments.addAll(page.items);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not load more comments')),
      );
    }
  }

  void _syncCommentsUrl({String? filter, String? q}) {
    final router = GoRouter.maybeOf(context);
    if (router == null) return;
    final nextFilter = filter ?? _filter;
    final nextQ = (q ?? _debouncedQuery).trim();
    final params = <String, String>{};
    if (nextFilter != 'all') params['filter'] = nextFilter;
    if (nextQ.length >= 2) params['q'] = nextQ;
    final qs = params.entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    router.replace(qs.isEmpty ? '/studio/comments' : '/studio/comments?$qs');
  }

  void _onSearchChanged(String v) {
    setState(() => _query = v);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      final next = v.trim();
      if (next == _debouncedQuery) return;
      setState(() => _debouncedQuery = next);
      _syncCommentsUrl(q: next);
      _reload();
    });
  }

  Future<void> _release(Map<String, dynamic> c) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null || _releaseBusy) return;
    setState(() => _releaseBusy = true);
    try {
      await ref.read(watchRepositoryProvider).approveComment(videoId, id);
      await _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Comment released')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not release comment')),
      );
    } finally {
      if (mounted) setState(() => _releaseBusy = false);
    }
  }

  Future<void> _pin(Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCommentPinned(videoId, id, isPinned: next);
    await _reload();
  }

  Future<void> _heart(Map<String, dynamic> c, bool next) async {
    final videoId = c['videoId'] as String?;
    final id = c['id'] as String?;
    if (videoId == null || id == null) return;
    await ref.read(watchRepositoryProvider).setCreatorHeart(videoId, id, creatorHearted: next);
    await _reload();
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
      await _reload();
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
      await _reload();
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Comments'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
        actions: [
          TextButton(
            onPressed: () => context.push('/studio/attention'),
            child: const Text('Attention'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _hasError
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Failed to load comments'),
                      const SizedBox(height: 12),
                      ForgeButton(label: 'Retry', onPressed: _reload),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: _onSearchChanged,
                        decoration: InputDecoration(
                          hintText: 'Search comments',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: _query.isEmpty
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.clear),
                                  tooltip: 'Clear search',
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    _onSearchChanged('');
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
                            ('held', 'Held for review'),
                            ('pinned', 'Pinned'),
                            ('hearted', 'Hearted'),
                          ])
                            ChoiceChip(
                              label: Text(f.$2),
                              selected: _filter == f.$1,
                              onSelected: (_) {
                                setState(() => _filter = f.$1);
                                _syncCommentsUrl(filter: f.$1);
                                _reload();
                              },
                            ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _comments.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                children: [
                                  ForgeCard(
                                    child: Text(
                                      _debouncedQuery.length >= 2
                                          ? 'No comments match "$_debouncedQuery"'
                                          : _filter == 'all'
                                              ? 'When viewers comment on your videos, they will appear here.'
                                              : 'No comments in this filter',
                                      style: TextStyle(
                                        color: ForgeTokens.of(context).onSurfaceVariant,
                                        height: 1.5,
                                      ),
                                    ),
                                  ),
                                  if (_filter == 'all' && _debouncedQuery.length < 2) ...[
                                    const SizedBox(height: 16),
                                    ForgeButton(
                                      label: 'Upload video',
                                      onPressed: () => context.push('/upload'),
                                    ),
                                  ],
                                ],
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(20),
                              itemCount: _comments.length + (_hasMore ? 1 : 0),
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (_, i) {
                                if (i >= _comments.length) {
                                  return Center(
                                    child: TextButton(
                                      onPressed: _loadingMore ? null : _loadMore,
                                      child: Text(_loadingMore ? 'Loading…' : 'Load more'),
                                    ),
                                  );
                                }
                                final c = _comments[i];
                                final user = c['user'] as Map<String, dynamic>?;
                                final isDeleted = c['isDeleted'] == true;
                                final pinned = c['isPinned'] == true;
                                final hearted = c['creatorHearted'] == true;
                                final held = c['moderationStatus'] == 'held';
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
                                            if (held)
                                              Text(
                                                'Held for review',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: t.error,
                                                ),
                                              ),
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
                                            if (isDeleted)
                                              Text(
                                                '[deleted]',
                                                style: TextStyle(
                                                  fontStyle: FontStyle.italic,
                                                  color: t.onSurfaceVariant,
                                                ),
                                              )
                                            else ...[
                                              Text(
                                                c['content'] as String? ?? '',
                                                style: TextStyle(color: t.onSurface),
                                              ),
                                              const SizedBox(height: 8),
                                              Text(
                                                '@${user?['username'] ?? 'user'}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: t.onSurfaceVariant,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Wrap(
                                        spacing: 4,
                                        children: [
                                          if (!isDeleted && held)
                                            TextButton(
                                              onPressed: _releaseBusy ? null : () => _release(c),
                                              child: const Text('Release'),
                                            ),
                                          if (!isDeleted && c['parentId'] == null)
                                            TextButton(
                                              onPressed: () async {
                                                try {
                                                  await _pin(c, !pinned);
                                                } catch (_) {
                                                  if (mounted) {
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      const SnackBar(
                                                        content: Text('Could not update pin'),
                                                      ),
                                                    );
                                                  }
                                                }
                                              },
                                              child: Text(pinned ? 'Unpin' : 'Pin'),
                                            ),
                                          if (!isDeleted)
                                            TextButton(
                                              onPressed: () async {
                                                try {
                                                  await _heart(c, !hearted);
                                                } catch (_) {
                                                  if (mounted) {
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      const SnackBar(
                                                        content: Text('Could not update heart'),
                                                      ),
                                                    );
                                                  }
                                                }
                                              },
                                              child: Text(hearted ? 'Remove heart' : 'Heart'),
                                            ),
                                          if (!isDeleted)
                                            TextButton(
                                              onPressed: () => _remove(c),
                                              child: Text(
                                                'Remove',
                                                style: TextStyle(color: t.error),
                                              ),
                                            ),
                                          if (!isDeleted)
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
                                          TextButton(
                                            onPressed: commentHref == null
                                                ? null
                                                : () async {
                                                    final url =
                                                        '${AppConstants.webBaseUrl}$commentHref';
                                                    await Clipboard.setData(
                                                      ClipboardData(text: url),
                                                    );
                                                    if (!mounted) return;
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      const SnackBar(
                                                        content: Text('Comment link copied'),
                                                      ),
                                                    );
                                                  },
                                            child: const Text('Copy link'),
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
                ),
    );
  }
}
