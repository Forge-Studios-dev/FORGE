import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/studio_repository.dart';

class StudioVideosScreen extends ConsumerStatefulWidget {
  const StudioVideosScreen({
    super.key,
    this.initialStatus,
    this.initialScheduled = false,
  });

  final String? initialStatus;
  final bool initialScheduled;

  @override
  ConsumerState<StudioVideosScreen> createState() => _StudioVideosScreenState();
}

class _StudioVideosScreenState extends ConsumerState<StudioVideosScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String _sort = 'recent';
  late String _status;
  String _visibility = '';
  String _videoType = '';
  String _categoryId = '';
  List<Map<String, dynamic>> _categories = [];
  late bool _scheduledOnly;
  final List<VideoModel> _videos = [];
  int _page = 1;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    final status = widget.initialStatus?.trim() ?? '';
    _status = const {'ready', 'processing', 'failed', 'uploading', 'pending'}.contains(status)
        ? status
        : '';
    _scheduledOnly = widget.initialScheduled;
    _loadCategories();
    _load();
  }

  Future<void> _loadCategories() async {
    try {
      final cats = await ref.read(studioRepositoryProvider).getUploadCategoryOptions();
      if (!mounted) return;
      setState(() => _categories = cats);
    } catch (_) {
      /* optional filter */
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool append = false}) async {
    if (append) {
      if (_loadingMore || !_hasMore) return;
      setState(() => _loadingMore = true);
    } else {
      setState(() {
        _loading = true;
        _error = false;
        _page = 1;
      });
    }
    try {
      final nextPage = append ? _page + 1 : 1;
      final result = await ref.read(studioRepositoryProvider).getMyVideos(
            search: _search,
            sort: _sort,
            status: _status.isEmpty ? null : _status,
            visibility: _visibility.isEmpty ? null : _visibility,
            videoType: _videoType.isEmpty ? null : _videoType,
            categoryId: _categoryId.isEmpty ? null : _categoryId,
            scheduled: _scheduledOnly,
            page: nextPage,
            limit: 24,
          );
      if (!mounted) return;
      setState(() {
        if (append) {
          _videos.addAll(result.items);
        } else {
          _videos
            ..clear()
            ..addAll(result.items);
        }
        _page = result.page;
        _hasMore = result.hasMore;
        _loading = false;
        _loadingMore = false;
        _error = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        if (!append) _error = true;
      });
    }
  }

  void _scheduleSearch(String raw) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _search = raw.trim());
      _load();
    });
  }

  Widget _filterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      visualDensity: VisualDensity.compact,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your videos'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) {
                setState(() {});
                _scheduleSearch(v);
              },
              decoration: InputDecoration(
                hintText: 'Search your videos by title',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        tooltip: 'Clear search',
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _search = '');
                          _load();
                        },
                      ),
                filled: true,
                fillColor: t.surfaceContainerLow,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                _filterChip(
                  label: 'Newest',
                  selected: _sort == 'recent',
                  onTap: () {
                    setState(() => _sort = 'recent');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Oldest',
                  selected: _sort == 'oldest',
                  onTap: () {
                    setState(() => _sort = 'oldest');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Views',
                  selected: _sort == 'views',
                  onTap: () {
                    setState(() => _sort = 'views');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Title',
                  selected: _sort == 'title',
                  onTap: () {
                    setState(() => _sort = 'title');
                    _load();
                  },
                ),
                const SizedBox(width: 12),
                _filterChip(
                  label: 'Published',
                  selected: _status == 'ready',
                  onTap: () {
                    setState(() => _status = _status == 'ready' ? '' : 'ready');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Processing',
                  selected: _status == 'processing',
                  onTap: () {
                    setState(() => _status = _status == 'processing' ? '' : 'processing');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Failed',
                  selected: _status == 'failed',
                  onTap: () {
                    setState(() => _status = _status == 'failed' ? '' : 'failed');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Scheduled',
                  selected: _scheduledOnly,
                  onTap: () {
                    setState(() => _scheduledOnly = !_scheduledOnly);
                    _load();
                  },
                ),
                const SizedBox(width: 12),
                _filterChip(
                  label: 'Videos',
                  selected: _videoType == 'video',
                  onTap: () {
                    setState(() => _videoType = _videoType == 'video' ? '' : 'video');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Shorts',
                  selected: _videoType == 'short',
                  onTap: () {
                    setState(() => _videoType = _videoType == 'short' ? '' : 'short');
                    _load();
                  },
                ),
                if (_categories.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  for (final c in _categories) ...[
                    _filterChip(
                      label: (c['name'] as String?) ?? 'Category',
                      selected: _categoryId == (c['id'] as String? ?? ''),
                      onTap: () {
                        final id = c['id'] as String? ?? '';
                        setState(() => _categoryId = _categoryId == id ? '' : id);
                        _load();
                      },
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
                const SizedBox(width: 12),
                _filterChip(
                  label: 'Public',
                  selected: _visibility == 'public',
                  onTap: () {
                    setState(() => _visibility = _visibility == 'public' ? '' : 'public');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Unlisted',
                  selected: _visibility == 'unlisted',
                  onTap: () {
                    setState(() => _visibility = _visibility == 'unlisted' ? '' : 'unlisted');
                    _load();
                  },
                ),
                const SizedBox(width: 6),
                _filterChip(
                  label: 'Private',
                  selected: _visibility == 'private',
                  onTap: () {
                    setState(() => _visibility = _visibility == 'private' ? '' : 'private');
                    _load();
                  },
                ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Failed to load videos', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
            const SizedBox(height: 12),
            TextButton(onPressed: () => _load(), child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_videos.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            ForgeCard(
              child: Text(
                _search.isNotEmpty ||
                        _status.isNotEmpty ||
                        _visibility.isNotEmpty ||
                        _videoType.isNotEmpty ||
                        _categoryId.isNotEmpty ||
                        _scheduledOnly
                    ? 'No videos match these filters.'
                    : 'No videos yet. Upload your first video.',
                style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
              ),
            ),
            const SizedBox(height: 16),
            ForgeButton(label: 'Upload video', onPressed: () => context.push('/upload')),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _videos.length + 2,
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: ForgeButton(label: 'New upload', onPressed: () => context.push('/upload')),
          );
        }
        if (i == _videos.length + 1) {
          if (!_hasMore) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: TextButton(
              onPressed: _loadingMore ? null : () => _load(append: true),
              child: Text(_loadingMore ? 'Loading…' : 'Load more'),
            ),
          );
        }
        final v = _videos[i - 1];
        final scheduledFuture =
            v.scheduledPublishAt != null && v.scheduledPublishAt!.isAfter(DateTime.now());
        final canCopy = v.status == 'ready' || v.visibility == 'unlisted';
        final canDelete = v.status != 'uploading';
        final canCancelUpload = v.status == 'uploading' ||
            v.status == 'processing' ||
            v.status == 'failed' ||
            v.status == 'pending';
        final canRetry = v.status == 'failed';
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ForgeCard(
            onTap: () => context.push('/studio/videos/${v.id}'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        v.title,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: ForgeTokens.of(context).onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          _statusLabel(v.status),
                          if (v.videoType == 'short') 'Short',
                          if (v.visibility != null) v.visibility!,
                          '${v.viewCount} views',
                          if (v.durationSeconds != null && v.durationSeconds! > 0)
                            _formatDuration(v.durationSeconds!),
                          if (scheduledFuture)
                            'scheduled ${_formatTimeUntil(v.scheduledPublishAt!)}',
                        ].join(' · '),
                        style: TextStyle(
                          fontSize: 13,
                          color: _statusColor(context, v.status),
                        ),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: Icon(Icons.more_vert, color: ForgeTokens.of(context).outline),
                  onSelected: (action) async {
                    if (action == 'edit') {
                      context.push('/studio/videos/${v.id}');
                      return;
                    }
                    if (action == 'view') {
                      final path = v.videoType == 'short'
                          ? '/shorts?v=${v.id}'
                          : '/watch/${v.id}';
                      context.push(path);
                      return;
                    }
                    if (action == 'copy') {
                      final path = v.videoType == 'short'
                          ? '/shorts?v=${v.id}'
                          : '/watch/${v.id}';
                      await Clipboard.setData(
                        ClipboardData(text: '${AppConstants.webBaseUrl}$path'),
                      );
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Link copied')),
                      );
                      return;
                    }
                    if (action == 'publish') {
                      try {
                        await ref.read(studioRepositoryProvider).updateVideo(
                              v.id,
                              title: v.title,
                              description: v.description,
                              visibility: v.visibility ?? 'public',
                              scheduledPublishAt: null,
                            );
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not publish now')),
                        );
                      }
                      return;
                    }
                    if (action == 'cancel_schedule') {
                      try {
                        await ref.read(studioRepositoryProvider).updateVideo(
                              v.id,
                              title: v.title,
                              description: v.description,
                              visibility: 'private',
                              scheduledPublishAt: null,
                            );
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not cancel schedule')),
                        );
                      }
                      return;
                    }
                    if (action == 'cancel_upload') {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Cancel upload?'),
                          content: const Text(
                            'This removes the incomplete or failed upload from Studio.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Keep'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: Text(
                                'Cancel upload',
                                style: TextStyle(color: ForgeTokens.of(ctx).error),
                              ),
                            ),
                          ],
                        ),
                      );
                      if (ok != true) return;
                      try {
                        await ref.read(studioRepositoryProvider).cancelUpload(v.id);
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not cancel upload')),
                        );
                      }
                      return;
                    }
                    if (action == 'retry') {
                      try {
                        await ref.read(studioRepositoryProvider).retryTranscode(v.id);
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not retry processing')),
                        );
                      }
                      return;
                    }
                    if (action == 'delete') {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Delete video?'),
                          content: const Text(
                            'This permanently deletes the video. You can’t undo this.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Cancel'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: Text(
                                'Delete',
                                style: TextStyle(color: ForgeTokens.of(ctx).error),
                              ),
                            ),
                          ],
                        ),
                      );
                      if (ok != true) return;
                      try {
                        await ref.read(studioRepositoryProvider).deleteVideo(v.id);
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not delete video')),
                        );
                      }
                      return;
                    }
                    if (action.startsWith('vis:')) {
                      final next = action.substring(4);
                      try {
                        await ref.read(studioRepositoryProvider).setVisibility(v.id, next);
                        await _load();
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not update visibility')),
                        );
                      }
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit')),
                    if (v.status == 'ready')
                      const PopupMenuItem(value: 'view', child: Text('View')),
                    if (canCopy) const PopupMenuItem(value: 'copy', child: Text('Copy link')),
                    if (scheduledFuture)
                      const PopupMenuItem(value: 'publish', child: Text('Publish now')),
                    if (scheduledFuture)
                      const PopupMenuItem(
                        value: 'cancel_schedule',
                        child: Text('Cancel schedule'),
                      ),
                    if (canRetry)
                      const PopupMenuItem(value: 'retry', child: Text('Retry processing')),
                    if (canCancelUpload)
                      PopupMenuItem(
                        value: 'cancel_upload',
                        child: Text(
                          'Cancel upload',
                          style: TextStyle(color: ForgeTokens.of(context).error),
                        ),
                      ),
                    if (canDelete) ...[
                      const PopupMenuDivider(),
                      PopupMenuItem(
                        enabled: false,
                        child: Text(
                          'Visibility',
                          style: TextStyle(
                            fontSize: 12,
                            color: ForgeTokens.of(context).onSurfaceVariant,
                          ),
                        ),
                      ),
                      PopupMenuItem(
                        value: 'vis:public',
                        child: Text(v.visibility == 'public' ? '✓ Public' : 'Public'),
                      ),
                      PopupMenuItem(
                        value: 'vis:unlisted',
                        child: Text(v.visibility == 'unlisted' ? '✓ Unlisted' : 'Unlisted'),
                      ),
                      PopupMenuItem(
                        value: 'vis:private',
                        child: Text(v.visibility == 'private' ? '✓ Private' : 'Private'),
                      ),
                      PopupMenuItem(
                        value: 'vis:followers',
                        child: Text(
                          v.visibility == 'followers' ? '✓ Subscribers' : 'Subscribers',
                        ),
                      ),
                      const PopupMenuDivider(),
                      PopupMenuItem(
                        value: 'delete',
                        child: Text(
                          'Delete',
                          style: TextStyle(color: ForgeTokens.of(context).error),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatDuration(double seconds) {
    final total = seconds.round();
    final h = total ~/ 3600;
    final m = (total % 3600) ~/ 60;
    final s = total % 60;
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String _formatTimeUntil(DateTime when) {
    final diff = when.difference(DateTime.now());
    if (diff.isNegative) return 'soon';
    if (diff.inMinutes < 1) return 'in under a minute';
    if (diff.inMinutes < 60) return 'in ${diff.inMinutes}m';
    if (diff.inHours < 24) return 'in ${diff.inHours}h';
    if (diff.inDays < 30) return 'in ${diff.inDays}d';
    return '${when.month}/${when.day}/${when.year}';
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      case 'failed':
        return 'Failed';
      case 'draft':
        return 'Draft';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  }

  Color _statusColor(BuildContext context, String status) {
    switch (status) {
      case 'ready':
        return ForgeTokens.of(context).secondary;
      case 'processing':
      case 'uploading':
      case 'pending':
        return ForgeTokens.of(context).primary;
      case 'failed':
        return ForgeTokens.of(context).error;
      case 'draft':
        return ForgeTokens.of(context).onSurfaceVariant;
      default:
        return ForgeTokens.of(context).onSurfaceVariant;
    }
  }
}
