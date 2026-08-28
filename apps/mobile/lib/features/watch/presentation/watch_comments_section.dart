import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';
import '../data/watch_repository.dart';
import 'expandable_description.dart';

class WatchCommentsSection extends ConsumerStatefulWidget {
  final String videoId;
  final String videoOwnerId;
  final String? highlightCommentId;
  const WatchCommentsSection({
    required this.videoId,
    required this.videoOwnerId,
    this.highlightCommentId,
  });

  @override
  ConsumerState<WatchCommentsSection> createState() => _WatchCommentsSectionState();
}

class _WatchCommentsSectionState extends ConsumerState<WatchCommentsSection> {
  final _ctrl = TextEditingController();
  List<dynamic> _comments = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _nextCursor;
  bool _hasMore = false;
  String? _replyToId;
  String? _viewerId;
  String _sort = 'top';
  final Map<String, List<dynamic>> _replies = {};
  final Set<String> _expandedReplies = {};
  final Set<String> _loadingReplies = {};
  final Map<String, GlobalKey> _commentKeys = {};
  String? _editingId;
  final _editCtrl = TextEditingController();
  bool _highlightScrolled = false;

  void Function(dynamic)? _onNewComment;

  @override
  void initState() {
    super.initState();
    _loadViewer();
    _load();
    _bindSocket();
  }

  @override
  void dispose() {
    if (_onNewComment != null) {
      ForgeSocket.off('comment:new', _onNewComment);
    }
    ForgeSocket.leaveVideo(widget.videoId);
    _ctrl.dispose();
    _editCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadViewer() async {
    try {
      final client = ref.read(apiClientProvider);
      final me = await client.dio.get('/users/me');
      final data = me.data['data'] as Map<String, dynamic>?;
      if (mounted) setState(() => _viewerId = data?['id'] as String?);
    } catch (_) {}
  }

  Future<void> _load({String? cursor}) async {
    try {
      final page = await ref.read(watchRepositoryProvider).getComments(
            widget.videoId,
            cursor: cursor,
            sort: _sort,
          );
      if (!mounted) return;
      var comments = cursor != null ? [..._comments, ...page.comments] : page.comments;
      final highlightId = widget.highlightCommentId;
      if (highlightId != null &&
          cursor == null &&
          !comments.any((c) => (c as Map)['id'] == highlightId)) {
        try {
          final highlighted = await ref.read(watchRepositoryProvider).getComment(
                widget.videoId,
                highlightId,
              );
          if (highlighted != null) {
            comments = [highlighted, ...comments];
          }
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _comments = comments;
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
      });
      _scrollToHighlight();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollToHighlight() {
    final id = widget.highlightCommentId;
    if (id == null || _highlightScrolled) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _highlightScrolled) return;
      final key = _commentKeys[id];
      final ctx = key?.currentContext;
      if (ctx != null) {
        _highlightScrolled = true;
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 350),
          alignment: 0.2,
        );
      }
    });
  }

  Future<void> _editComment(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    _editCtrl.text = m['content'] as String? ?? '';
    setState(() => _editingId = id);
  }

  Future<void> _saveEdit() async {
    final id = _editingId;
    final text = _editCtrl.text.trim();
    if (id == null || text.isEmpty) return;
    try {
      await ref.read(watchRepositoryProvider).updateComment(
            widget.videoId,
            id,
            content: text,
          );
      setState(() => _editingId = null);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not edit comment')),
        );
      }
    }
  }

  Future<void> _deleteComment(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    final authorId = m['userId'] as String? ?? (m['user'] as Map<String, dynamic>?)?['id'] as String?;
    final isMine = _viewerId != null && authorId == _viewerId;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isMine ? 'Delete comment?' : 'Remove comment?'),
        content: Text(
          isMine
              ? 'This cannot be undone.'
              : 'Remove this comment from your video? This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isMine ? 'Delete' : 'Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(watchRepositoryProvider).deleteComment(widget.videoId, id);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete comment')),
        );
      }
    }
  }

  Future<void> _setSort(String sort) async {
    if (_sort == sort) return;
    setState(() {
      _sort = sort;
      _loading = true;
      _comments = [];
      _nextCursor = null;
      _hasMore = false;
    });
    await _load();
  }

  Future<void> _reportComment(Map<String, dynamic> m) async {
    const reasons = [
      'Spam or misleading',
      'Hate speech or harassment',
      'Sexual content',
      'Violence or threats',
      'Child abuse',
      'Privacy violation',
      'Other',
    ];
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('Report comment', style: TextStyle(fontWeight: FontWeight.w600))),
            ...reasons.map(
              (r) => ListTile(
                title: Text(r),
                onTap: () => Navigator.pop(ctx, r),
              ),
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;
    final id = m['id'] as String?;
    if (id == null) return;
    try {
      await ref.read(watchRepositoryProvider).reportComment(commentId: id, reason: reason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report comments')),
        );
      }
    }
  }

  Future<void> _startReply(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    final user = m['user'] as Map<String, dynamic>?;
    final username = user?['username'] as String?;
    setState(() => _replyToId = id);
    if (username != null && username.isNotEmpty) {
      final mention = '@$username ';
      final current = _ctrl.text;
      if (!current.contains(mention) && !current.trim().startsWith('@$username')) {
        _ctrl.text = '$mention$current';
        _ctrl.selection = TextSelection.collapsed(offset: _ctrl.text.length);
      }
    }
  }

  Future<void> _toggleReplies(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    if (_expandedReplies.contains(id)) {
      setState(() => _expandedReplies.remove(id));
      return;
    }
    setState(() {
      _expandedReplies.add(id);
      _loadingReplies.add(id);
    });
    try {
      final replies = await ref.read(watchRepositoryProvider).getCommentReplies(
            widget.videoId,
            id,
          );
      if (!mounted) return;
      setState(() {
        _replies[id] = replies;
        _loadingReplies.remove(id);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _expandedReplies.remove(id);
        _loadingReplies.remove(id);
      });
    }
  }

  Future<void> _bindSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinVideo(widget.videoId);
    _onNewComment = (_) {
      if (mounted) _load();
    };
    ForgeSocket.on('comment:new', _onNewComment!);
  }

  Future<void> _post() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    try {
      await ref.read(watchRepositoryProvider).postComment(
            widget.videoId,
            content: text,
            parentId: _replyToId,
          );
      _ctrl.clear();
      setState(() => _replyToId = null);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to comment')),
        );
      }
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final liked = comment['viewerLiked'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCommentLiked(
            widget.videoId,
            id,
            liked: liked,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update like')),
        );
      }
    }
  }

  Future<void> _toggleDislike(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final disliked = comment['viewerDisliked'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCommentDisliked(
            widget.videoId,
            id,
            disliked: disliked,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update dislike')),
        );
      }
    }
  }

  Future<void> _togglePin(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final pinned = comment['isPinned'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCommentPinned(
            widget.videoId,
            id,
            isPinned: !pinned,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update pin')),
        );
      }
    }
  }

  Future<void> _toggleHeart(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final hearted = comment['creatorHearted'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCreatorHeart(
            widget.videoId,
            id,
            creatorHearted: !hearted,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update heart')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = _viewerId != null && _viewerId == widget.videoOwnerId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('Comments', style: Theme.of(context).textTheme.titleMedium),
            ),
            PopupMenuButton<String>(
              tooltip: 'Sort comments',
              initialValue: _sort,
              onSelected: _setSort,
              itemBuilder: (context) => const [
                PopupMenuItem(value: 'top', child: Text('Top')),
                PopupMenuItem(value: 'newest', child: Text('Newest')),
                PopupMenuItem(value: 'oldest', child: Text('Oldest')),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _sort == 'newest'
                          ? 'Newest'
                          : _sort == 'oldest'
                              ? 'Oldest'
                              : 'Top',
                      style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).primary),
                    ),
                    Icon(Icons.arrow_drop_down, size: 18, color: ForgeTokens.of(context).primary),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (_replyToId != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: TextButton(
              onPressed: () => setState(() => _replyToId = null),
              child: const Text('Cancel reply'),
            ),
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                decoration: const InputDecoration(
                  hintText: 'Add a comment…',
                  isDense: true,
                ),
              ),
            ),
            IconButton(tooltip: 'Post comment', onPressed: _post, icon: Icon(Icons.send)),
          ],
        ),
        if (_loading)
          const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())
        else if (_comments.isEmpty)
          Text('No comments yet', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant))
        else ...[
          ..._comments.map((c) {
            final m = c as Map<String, dynamic>;
            final user = m['user'] as Map<String, dynamic>?;
            final likeCount = m['likeCount'] as int? ?? 0;
            final liked = m['viewerLiked'] == true;
            final disliked = m['viewerDisliked'] == true;
            final pinned = m['isPinned'] == true;
            final hearted = m['creatorHearted'] == true;
            final parentId = m['parentId'];
            final replyCount = m['replyCount'] as int? ?? 0;
            final isDeleted = m['isDeleted'] == true;
            final commentId = m['id'] as String? ?? '';
            final repliesExpanded = _expandedReplies.contains(commentId);
            final authorId = m['userId'] as String? ?? user?['id'] as String?;
            final isMine = _viewerId != null && authorId == _viewerId;
            final isHighlighted = widget.highlightCommentId != null && widget.highlightCommentId == commentId;
            final key = _commentKeys.putIfAbsent(commentId, GlobalKey.new);
            final editing = _editingId == commentId;
            return Container(
              key: key,
              decoration: isHighlighted
                  ? BoxDecoration(
                      color: ForgeTokens.of(context).primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    )
                  : null,
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (pinned)
                  Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Pinned',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: ForgeTokens.of(context).onSurfaceVariant,
                      ),
                    ),
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: isDeleted
                      ? null
                      : Row(
                          children: [
                            Expanded(child: Text(user?['displayName'] as String? ?? 'User')),
                            if (hearted)
                              Icon(Icons.favorite, size: 14, color: ForgeTokens.of(context).error),
                          ],
                        ),
                  subtitle: isDeleted
                      ? Text(
                          '[deleted]',
                          style: TextStyle(
                            fontStyle: FontStyle.italic,
                            color: ForgeTokens.of(context).onSurfaceVariant,
                          ),
                        )
                      : editing
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                TextField(
                                  controller: _editCtrl,
                                  maxLines: 3,
                                  decoration: const InputDecoration(isDense: true),
                                ),
                                Row(
                                  children: [
                                    TextButton(
                                      onPressed: () => setState(() => _editingId = null),
                                      child: const Text('Cancel'),
                                    ),
                                    FilledButton(
                                      onPressed: _saveEdit,
                                      child: const Text('Save'),
                                    ),
                                  ],
                                ),
                              ],
                            )
                          : LinkifiedText(
                              text: m['content'] as String? ?? '',
                              videoId: widget.videoId,
                              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                            ),
                  trailing: isDeleted
                      ? null
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              tooltip: liked ? 'Unlike comment' : 'Like comment',
                              icon: Icon(liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18),
                              onPressed: () => _toggleLike(m),
                            ),
                            if (likeCount > 0) Text('$likeCount', style: TextStyle(fontSize: 12)),
                            IconButton(
                              tooltip: disliked ? 'Remove dislike' : 'Dislike',
                              icon: Icon(disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18),
                              onPressed: () => _toggleDislike(m),
                            ),
                            if (isOwner && parentId == null)
                              IconButton(
                                tooltip: pinned ? 'Unpin' : 'Pin',
                                icon: Icon(pinned ? Icons.push_pin : Icons.push_pin_outlined, size: 18),
                                onPressed: () => _togglePin(m),
                              ),
                            if (isOwner)
                              IconButton(
                                tooltip: hearted ? 'Remove heart' : 'Heart',
                                icon: Icon(
                                  hearted ? Icons.favorite : Icons.favorite_border,
                                  size: 18,
                                  color: hearted ? ForgeTokens.of(context).error : null,
                                ),
                                onPressed: () => _toggleHeart(m),
                              ),
                            IconButton(
                              tooltip: 'Reply',
                              icon: const Icon(Icons.reply, size: 18),
                              onPressed: () => _startReply(m),
                            ),
                            PopupMenuButton<String>(
                              tooltip: 'More',
                              onSelected: (value) async {
                                if (value == 'copy') {
                                  final id = m['id'] as String?;
                                  if (id == null) return;
                                  final url =
                                      '${AppConstants.webBaseUrl}/watch/${widget.videoId}?lc=$id';
                                  await SharePlus.instance.share(ShareParams(text: url));
                                } else if (value == 'report') {
                                  await _reportComment(m);
                                } else if (value == 'edit') {
                                  await _editComment(m);
                                } else if (value == 'delete') {
                                  await _deleteComment(m);
                                }
                              },
                              itemBuilder: (context) => [
                                const PopupMenuItem(value: 'copy', child: Text('Copy link')),
                                if (isMine) ...[
                                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
                                ],
                                if (isOwner && !isMine)
                                  const PopupMenuItem(value: 'delete', child: Text('Remove')),
                                if (!isMine)
                                  const PopupMenuItem(value: 'report', child: Text('Report')),
                              ],
                            ),
                          ],
                        ),
                ),
                if (parentId == null && replyCount > 0)
                  TextButton(
                    onPressed: () => _toggleReplies(m),
                    child: Text(
                      repliesExpanded
                          ? 'Hide replies'
                          : 'View $replyCount ${replyCount == 1 ? 'reply' : 'replies'}',
                    ),
                  ),
                if (repliesExpanded) ...[
                  if (_loadingReplies.contains(commentId))
                    const Padding(
                      padding: EdgeInsets.only(left: 24, bottom: 8),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  else
                    ...(_replies[commentId] ?? []).map((raw) {
                      final r = raw as Map<String, dynamic>;
                      final ru = r['user'] as Map<String, dynamic>?;
                      return Padding(
                        padding: const EdgeInsets.only(left: 24, bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ru?['displayName'] as String? ?? 'User',
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              r['content'] as String? ?? '',
                              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                            ),
                            TextButton(
                              onPressed: () => _startReply(r),
                              child: const Text('Reply'),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ],
            ),
            );
          }),
          if (_hasMore)
            TextButton(
              onPressed: _loadingMore
                  ? null
                  : () async {
                      setState(() => _loadingMore = true);
                      await _load(cursor: _nextCursor);
                      if (mounted) setState(() => _loadingMore = false);
                    },
              child: Text(_loadingMore ? 'Loading…' : 'Load more'),
            ),
        ],
      ],
    );
  }
}
