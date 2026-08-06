import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/studio_repository.dart';

class StudioVideosScreen extends ConsumerStatefulWidget {
  const StudioVideosScreen({super.key});

  @override
  ConsumerState<StudioVideosScreen> createState() => _StudioVideosScreenState();
}

class _StudioVideosScreenState extends ConsumerState<StudioVideosScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String _sort = 'recent';
  String _status = '';
  String _visibility = '';
  final List<VideoModel> _videos = [];
  int _page = 1;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
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
                _search.isNotEmpty || _status.isNotEmpty || _visibility.isNotEmpty
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
                          if (v.visibility != null) v.visibility!,
                          '${v.viewCount} views',
                          if (v.scheduledPublishAt != null) 'scheduled',
                        ].join(' · '),
                        style: TextStyle(
                          fontSize: 13,
                          color: _statusColor(context, v.status),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
              ],
            ),
          ),
        );
      },
    );
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
