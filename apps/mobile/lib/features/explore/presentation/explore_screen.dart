import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';
import '../data/search_history_storage.dart';
import '../data/search_repository.dart';

final exploreCategoriesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get('/categories');
  final list = res.data['data'] as List<dynamic>? ?? [];
  return list.map((e) => e as Map<String, dynamic>).toList();
});

class ExploreScreen extends ConsumerStatefulWidget {
  /// Optional query to prefill the search box (used by the dedicated `/search`
  /// route for deep links). When non-empty, results load immediately.
  final String? initialQuery;

  /// Focus the search field on open (search-first entry, e.g. `/search`).
  final bool autofocusSearch;

  const ExploreScreen({super.key, this.initialQuery, this.autofocusSearch = false});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  Timer? _suggestDebounce;
  String _lastQuery = '';
  Future<SearchResults>? _searchFuture;
  Future<SearchSuggestions>? _suggestFuture;
  String _sort = 'relevance';
  String _kind = 'any';
  String _duration = 'any';
  String _uploaded = 'any';
  String _captions = 'any';
  List<String> _recentSearches = [];

  @override
  void initState() {
    super.initState();
    _loadRecentSearches();
    final q = widget.initialQuery?.trim() ?? '';
    if (q.length >= 2) {
      _controller.text = q;
      // Safe in initState: for q>=2 this only arms a debounce Timer (no
      // synchronous setState); the result loads after the first frame.
      _scheduleSearch(q);
    }
  }

  Future<void> _loadRecentSearches() async {
    final history = await readSearchHistory();
    if (!mounted) return;
    setState(() => _recentSearches = history);
  }

  Future<void> _rememberSearch(String raw) async {
    final term = raw.trim();
    if (term.length < 2) return;
    final next = await pushSearchHistory(term);
    if (!mounted) return;
    setState(() => _recentSearches = next);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _suggestDebounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _scheduleSearch(String raw) {
    _debounce?.cancel();
    final q = raw.trim();
    _lastQuery = q;
    if (q.length < 2) {
      setState(() {
        _searchFuture = null;
        _suggestFuture = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted || _lastQuery != q) return;
      setState(() {
        _suggestFuture = null;
        _searchFuture = ref.read(searchRepositoryProvider).search(
              q,
              sort: _sort,
              kind: _kind,
              duration: _duration,
              uploaded: _uploaded,
              captions: _captions,
            );
      });
    });
  }

  void _scheduleSuggestions(String raw) {
    _suggestDebounce?.cancel();
    final q = raw.trim();
    if (q.length < 2) {
      setState(() => _suggestFuture = null);
      return;
    }
    _suggestDebounce = Timer(const Duration(milliseconds: 200), () {
      if (!mounted || _controller.text.trim() != q) return;
      setState(() {
        _suggestFuture = ref.read(searchRepositoryProvider).suggestions(q);
      });
    });
  }

  void _applyFilters() {
    final q = _controller.text.trim();
    if (q.length >= 2) {
      setState(() {
        _searchFuture = ref.read(searchRepositoryProvider).search(
              q,
              sort: _sort,
              kind: _kind,
              duration: _duration,
              uploaded: _uploaded,
              captions: _captions,
            );
      });
    }
  }

  void _commitSearch(String raw) {
    final q = raw.trim();
    if (q.length < 2) return;
    unawaited(_rememberSearch(q));
    _scheduleSearch(q);
  }

  Widget _filterChip({
    required String label,
    required String value,
    required String selected,
    required ValueChanged<String> onSelected,
  }) {
    final active = value == selected;
    return FilterChip(
      label: Text(label),
      selected: active,
      onSelected: (_) {
        onSelected(value);
        _applyFilters();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Explore')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              autofocus: widget.autofocusSearch,
              style: TextStyle(color: ForgeTokens.of(context).onSurface),
              decoration: InputDecoration(
                hintText: 'Search videos and creators',
                hintStyle: TextStyle(color: ForgeTokens.of(context).outline),
                prefixIcon: Icon(Icons.search, color: ForgeTokens.of(context).outline),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        icon: Icon(Icons.clear, color: ForgeTokens.of(context).outline),
                        onPressed: () {
                          _controller.clear();
                          _scheduleSearch('');
                        },
                      ),
                filled: true,
                fillColor: ForgeTokens.of(context).surfaceContainerLow,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: ForgeTokens.of(context).outlineVariant.withValues(alpha: 0.4)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: ForgeTokens.of(context).outlineVariant.withValues(alpha: 0.4)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: ForgeTokens.of(context).primary),
                ),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: _commitSearch,
              onChanged: (v) {
                setState(() {});
                _scheduleSuggestions(v);
                _scheduleSearch(v);
              },
            ),
          ),
          if (_controller.text.trim().length >= 2)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Row(
                children: [
                  _filterChip(
                    label: 'Relevance',
                    value: 'relevance',
                    selected: _sort,
                    onSelected: (v) => setState(() => _sort = v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: 'Upload date',
                    value: 'date',
                    selected: _sort,
                    onSelected: (v) => setState(() => _sort = v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: 'View count',
                    value: 'views',
                    selected: _sort,
                    onSelected: (v) => setState(() => _sort = v),
                  ),
                  const SizedBox(width: 12),
                  _filterChip(
                    label: 'Videos',
                    value: 'video',
                    selected: _kind,
                    onSelected: (v) => setState(() => _kind = _kind == v ? 'any' : v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: 'Shorts',
                    value: 'short',
                    selected: _kind,
                    onSelected: (v) => setState(() => _kind = _kind == v ? 'any' : v),
                  ),
                  const SizedBox(width: 12),
                  _filterChip(
                    label: 'Under 4 min',
                    value: 'short',
                    selected: _duration,
                    onSelected: (v) => setState(() => _duration = _duration == v ? 'any' : v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: '4–20 min',
                    value: 'medium',
                    selected: _duration,
                    onSelected: (v) => setState(() => _duration = _duration == v ? 'any' : v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: 'Over 20 min',
                    value: 'long',
                    selected: _duration,
                    onSelected: (v) => setState(() => _duration = _duration == v ? 'any' : v),
                  ),
                  const SizedBox(width: 12),
                  _filterChip(
                    label: 'This week',
                    value: 'week',
                    selected: _uploaded,
                    onSelected: (v) => setState(() => _uploaded = _uploaded == v ? 'any' : v),
                  ),
                  const SizedBox(width: 6),
                  _filterChip(
                    label: 'This month',
                    value: 'month',
                    selected: _uploaded,
                    onSelected: (v) => setState(() => _uploaded = _uploaded == v ? 'any' : v),
                  ),
                  const SizedBox(width: 12),
                  _filterChip(
                    label: 'Subtitles',
                    value: 'yes',
                    selected: _captions,
                    onSelected: (v) => setState(() => _captions = _captions == v ? 'any' : v),
                  ),
                ],
              ),
            ),
          Expanded(child: _buildResultsArea()),
        ],
      ),
    );
  }

  Widget _buildResultsArea() {
    final q = _controller.text.trim();
    final suggest = _suggestFuture;
    if (suggest != null && q.length >= 2 && _searchFuture == null) {
      return FutureBuilder<SearchSuggestions>(
        future: suggest,
        builder: (context, snapshot) {
          final data = snapshot.data;
          if (data == null || (data.titles.isEmpty && data.channels.isEmpty)) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return Center(child: CircularProgressIndicator(color: ForgeTokens.of(context).primary));
            }
            return const SizedBox.shrink();
          }
          return ListView(
            children: [
              ...data.channels.map(
                (c) => ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(c.displayName),
                  subtitle: Text('@${c.username}'),
                  onTap: () => context.push('/profile/${c.username}'),
                ),
              ),
              ...data.titles.map(
                (t) => ListTile(
                  leading: const Icon(Icons.search),
                  title: Text(t),
                  onTap: () {
                    _controller.text = t;
                    setState(() {});
                    _commitSearch(t);
                  },
                ),
              ),
            ],
          );
        },
      );
    }
    if (q.isEmpty) {
      final categoriesAsync = ref.watch(exploreCategoriesProvider);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_recentSearches.isNotEmpty) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Recent searches',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      letterSpacing: 0.08,
                      color: ForgeTokens.of(context).outline,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    await clearSearchHistory();
                    if (!mounted) return;
                    setState(() => _recentSearches = []);
                  },
                  child: const Text('Clear'),
                ),
              ],
            ),
            const SizedBox(height: 4),
            ..._recentSearches.map(
              (term) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.history, color: ForgeTokens.of(context).outline),
                title: Text(term),
                onTap: () {
                  _controller.text = term;
                  setState(() {});
                  _commitSearch(term);
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
          categoriesAsync.when(
            data: (cats) {
              if (cats.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Categories',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      letterSpacing: 0.08,
                      color: ForgeTokens.of(context).outline,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: cats.map((c) {
                      final name = c['name'] as String? ?? '';
                      return ActionChip(
                        label: Text(name),
                        onPressed: () {
                          _controller.text = name;
                          setState(() {});
                          _commitSearch(name);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          Text(
            'Or search above for videos and creators.',
            textAlign: TextAlign.center,
            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13),
          ),
        ],
      );
    }
    if (q.length < 2) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Enter at least 2 characters to search.', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
        ),
      );
    }

    final future = _searchFuture;
    if (future == null) {
      return Center(child: CircularProgressIndicator(color: ForgeTokens.of(context).primary));
    }

    return FutureBuilder<SearchResults>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator(color: ForgeTokens.of(context).primary));
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline, size: 48, color: ForgeTokens.of(context).error),
                  const SizedBox(height: 12),
                  Text('Search failed', style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
                  const SizedBox(height: 8),
                  TextButton(onPressed: () => _scheduleSearch(q), child: const Text('Retry')),
                ],
              ),
            ),
          );
        }
        final data = snapshot.data;
        if (data == null) return const SizedBox.shrink();
        if (data.videos.isEmpty && data.users.isEmpty && data.playlists.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.search_off, size: 48, color: ForgeTokens.of(context).outline),
                  const SizedBox(height: 12),
                  Text('No results for "${data.query}"', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
                ],
              ),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            if (data.videos.isNotEmpty) ...[
              Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Text('Videos', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
              ),
              ...data.videos.map((v) => _VideoSearchTile(video: v)),
            ],
            if (data.playlists.isNotEmpty) ...[
              Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('Playlists', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
              ),
              ...data.playlists.map((p) => _PlaylistSearchTile(playlist: p)),
            ],
            if (data.users.isNotEmpty) ...[
              Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('Creators', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
              ),
              ...data.users.map((u) => _UserSearchTile(user: u)),
            ],
          ],
        );
      },
    );
  }
}

class _VideoSearchTile extends StatelessWidget {
  final VideoModel video;
  const _VideoSearchTile({required this.video});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 96,
          height: 54,
          child: video.thumbnailUrl != null
              ? CachedNetworkImage(
                  imageUrl: video.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: ForgeTokens.of(context).surfaceContainerHigh),
                  errorWidget: (_, __, ___) => Container(color: ForgeTokens.of(context).surfaceContainerHigh),
                )
              : Container(color: ForgeTokens.of(context).surfaceContainerHigh),
        ),
      ),
      title: Text(video.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: ForgeTokens.of(context).onSurface)),
      subtitle: Text('@${video.user.username}', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
      onTap: () => context.push('/watch/${video.id}'),
    );
  }
}

class _UserSearchTile extends StatelessWidget {
  final UserModel user;
  const _UserSearchTile({required this.user});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: ForgeTokens.of(context).primaryContainer,
        backgroundImage: user.avatarUrl != null ? CachedNetworkImageProvider(user.avatarUrl!) : null,
        child: user.avatarUrl == null
            ? Text(
                user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                style: TextStyle(color: ForgeTokens.of(context).onPrimary, fontWeight: FontWeight.bold),
              )
            : null,
      ),
      title: Text(user.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: ForgeTokens.of(context).onSurface)),
      subtitle: Text('@${user.username}', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
      onTap: () => context.push('/profile/${user.username}'),
    );
  }
}

class _PlaylistSearchTile extends StatelessWidget {
  final PlaylistSearchHit playlist;
  const _PlaylistSearchTile({required this.playlist});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
        child: Icon(Icons.playlist_play, color: ForgeTokens.of(context).primary),
      ),
      title: Text(
        playlist.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: ForgeTokens.of(context).onSurface),
      ),
      subtitle: Text(
        '${playlist.videoCount} videos${playlist.owner != null ? ' · @${playlist.owner!.username}' : ''}',
        style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
      ),
      onTap: () => context.push('/playlists/${playlist.id}'),
    );
  }
}
